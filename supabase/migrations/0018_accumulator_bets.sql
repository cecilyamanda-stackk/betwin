-- Bet606 — Accumulator (Multiples) betting
--
-- Until now `bets` was the only wager shape: one row, one selection, one
-- stake (see the Phase 1 migration's own note that a parlay "would need
-- its own tables and settlement logic, not a UI change on top of this
-- one"). This migration is that follow-up: an accumulator combines
-- several selections — from different matches — into a single stake
-- whose odds are the *product* of every leg's odds, and which only
-- pays out if every leg wins. It's deliberately a new table pair rather
-- than a reshaping of `bets`, so every existing single-bet query,
-- report, and RLS policy keeps working untouched.

-- ── Accumulator bets ─────────────────────────────────────────────────────
create table public.accumulator_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stake_amount numeric(12, 2) not null check (stake_amount > 0),
  -- Product of every leg's odds_at_placement, locked at placement the same
  -- way bets.odds_at_placement is. Recomputed (legs with a VOID outcome
  -- dropped from the product) once every leg is resolved — see
  -- finalize_accumulator_bets — so this column reflects "what it settled
  -- at", not just "what it was quoted at", once status leaves PENDING.
  total_odds_at_placement numeric(14, 4) not null check (total_odds_at_placement > 1),
  potential_payout numeric(14, 2) generated always as
    (stake_amount * total_odds_at_placement) stored,
  status public.bet_status not null default 'PENDING',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accumulator_bets_settled_at_only_when_settled
    check (status = 'PENDING' or settled_at is not null)
);

create index accumulator_bets_user_id_idx on public.accumulator_bets (user_id);
create index accumulator_bets_status_idx on public.accumulator_bets (status);

create trigger accumulator_bets_set_updated_at
  before update on public.accumulator_bets
  for each row execute function public.set_updated_at();

-- ── Accumulator legs ─────────────────────────────────────────────────────
-- One row per selection in the accumulator. Each leg is graded
-- independently against its own event's final score (reusing
-- evaluate_bet_outcome, unchanged) — the accumulator's own status is
-- then derived from all its legs together in finalize_accumulator_bets,
-- not stored redundantly on each leg.
create table public.accumulator_bet_legs (
  id uuid primary key default gen_random_uuid(),
  accumulator_bet_id uuid not null references public.accumulator_bets (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  selection_id uuid not null references public.market_selections (id) on delete cascade,
  odds_at_placement numeric(8, 2) not null check (odds_at_placement > 1),
  status public.bet_status not null default 'PENDING',
  settled_at timestamptz,
  created_at timestamptz not null default now(),

  -- One leg per match, same "no correlated same-game legs" rule
  -- place_accumulator_bet enforces at placement — a unique constraint on
  -- (accumulator_bet_id, event_id) backstops it at the data layer too.
  constraint accumulator_bet_legs_one_per_event unique (accumulator_bet_id, event_id)
);

create index accumulator_bet_legs_accumulator_bet_id_idx on public.accumulator_bet_legs (accumulator_bet_id);
create index accumulator_bet_legs_event_id_idx on public.accumulator_bet_legs (event_id);
create index accumulator_bet_legs_status_idx on public.accumulator_bet_legs (status);

alter table public.accumulator_bets enable row level security;
alter table public.accumulator_bet_legs enable row level security;

create policy "Users can view their own accumulator bets"
  on public.accumulator_bets for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all accumulator bets"
  on public.accumulator_bets for select
  to authenticated
  using (public.is_admin());

create policy "Users can view their own accumulator legs"
  on public.accumulator_bet_legs for select
  to authenticated
  using (exists (
    select 1 from public.accumulator_bets ab
    where ab.id = accumulator_bet_legs.accumulator_bet_id and ab.user_id = auth.uid()
  ));

create policy "Admins can view all accumulator legs"
  on public.accumulator_bet_legs for select
  to authenticated
  using (public.is_admin());

-- No insert/update policies — same trust boundary as `bets`: every write
-- happens inside a security-definer function below, never a direct
-- client insert.

-- ── transactions: link to an accumulator, same as bet_id ────────────────
alter table public.transactions
  add column accumulator_bet_id uuid references public.accumulator_bets (id);

alter table public.transactions
  add constraint transactions_one_bet_reference_only
  check (bet_id is null or accumulator_bet_id is null);

comment on column public.transactions.accumulator_bet_id is
  'Set instead of bet_id for a transaction tied to an accumulator rather '
  'than a single bet (BET_DEBIT at placement, BET_PAYOUT/BET_REFUND at '
  'settlement) — a transaction is never tied to both.';

create index transactions_accumulator_bet_id_idx on public.transactions (accumulator_bet_id);

-- ── place_accumulator_bet ─────────────────────────────────────────────────
-- Same shape and same guarantees as place_bet: locks every selection
-- row so odds can't move underneath the request, verifies each is
-- priced/active/open, debits the wallet exactly once for the combined
-- stake, and inserts the accumulator + its legs + one BET_DEBIT
-- transaction together — so an accumulator can never exist without a
-- matching debit, or with a leg that wasn't actually valid to bet on.
--
-- Idempotent the same way place_bet is: a retried request under the same
-- key returns the same result rather than placing a second accumulator.
create or replace function public.place_accumulator_bet(
  p_selection_ids uuid[],
  p_stake_amount numeric,
  p_idempotency_key text default null
)
returns table (accumulator_bet_id uuid, total_odds numeric, potential_payout numeric)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_acc_id uuid;
  v_total_odds numeric := 1;
  v_payout numeric;
  v_leg_count integer;
  v_matched_count integer := 0;
  v_event_ids uuid[] := '{}';
  v_legs jsonb := '[]'::jsonb;
  v_leg record;
  v_withdrawable numeric;
  v_bonus numeric;
  v_from_withdrawable numeric;
  v_from_bonus numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if p_idempotency_key is not null then
    select ab.id, ab.total_odds_at_placement, ab.potential_payout
    into v_acc_id, v_total_odds, v_payout
    from public.transactions t
    join public.accumulator_bets ab on ab.id = t.accumulator_bet_id
    where t.idempotency_key = p_idempotency_key
      and t.user_id = v_user_id
    limit 1;

    if found then
      return query select v_acc_id, v_total_odds, v_payout;
      return;
    end if;

    -- No existing bet for this idempotency key: SELECT INTO on zero
    -- rows nulls out its targets, so reset the accumulator back to
    -- its starting value before it's used below.
    v_acc_id := null;
    v_total_odds := 1;
    v_payout := null;
  end if;

  if p_stake_amount is null or p_stake_amount <= 0 then
    raise exception 'Stake must be greater than zero.';
  end if;

  v_leg_count := coalesce(array_length(p_selection_ids, 1), 0);
  if v_leg_count < 2 then
    raise exception 'An accumulator needs at least 2 selections.';
  end if;
  if v_leg_count <> (select count(distinct x) from unnest(p_selection_ids) x) then
    raise exception 'The same selection was included twice.';
  end if;

  -- Locked in a fixed order (by selection id) so two concurrent
  -- accumulator placements sharing a selection can't deadlock against
  -- each other — same concern place_bet's single-row lock doesn't have
  -- to think about, but a multi-row lock does.
  for v_leg in
    select ms.id as selection_id, ms.market_id, ms.active, ms.current_odds,
           m.event_id, m.status as market_status, e.status as event_status
    from unnest(p_selection_ids) as sel(id)
    join public.market_selections ms on ms.id = sel.id
    join public.markets m on m.id = ms.market_id
    join public.events e on e.id = m.event_id
    order by ms.id
    for update of ms
  loop
    v_matched_count := v_matched_count + 1;

    if not v_leg.active then
      raise exception 'One of your selections is no longer active.';
    end if;
    if v_leg.current_odds is null then
      raise exception 'One of your selections hasn''t been priced yet.';
    end if;
    if v_leg.market_status <> 'OPEN' then
      raise exception 'One of your selections'' market is closed for betting.';
    end if;
    if v_leg.event_status not in ('PUBLISHED', 'LIVE') then
      raise exception 'Betting is closed for one of your selected events.';
    end if;
    if v_leg.event_id = any(v_event_ids) then
      raise exception 'An accumulator can only include one selection per match.';
    end if;

    v_event_ids := array_append(v_event_ids, v_leg.event_id);
    v_total_odds := v_total_odds * v_leg.current_odds;
    v_legs := v_legs || jsonb_build_object(
      'selection_id', v_leg.selection_id, 'market_id', v_leg.market_id,
      'event_id', v_leg.event_id, 'odds', v_leg.current_odds
    );
  end loop;

  if v_matched_count <> v_leg_count then
    raise exception 'One or more selections could not be found.';
  end if;

  select withdrawable_cash, bonus_funds into v_withdrawable, v_bonus
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found.';
  end if;
  if (v_withdrawable + v_bonus) < p_stake_amount then
    raise exception 'Insufficient balance.';
  end if;

  v_from_withdrawable := least(v_withdrawable, p_stake_amount);
  v_from_bonus := p_stake_amount - v_from_withdrawable;

  update public.wallets
  set
    withdrawable_cash = withdrawable_cash - v_from_withdrawable,
    bonus_funds = bonus_funds - v_from_bonus
  where user_id = v_user_id;

  v_total_odds := round(v_total_odds, 4);
  v_payout := round(p_stake_amount * v_total_odds, 2);

  insert into public.accumulator_bets (user_id, stake_amount, total_odds_at_placement)
  values (v_user_id, p_stake_amount, v_total_odds)
  returning id into v_acc_id;

  insert into public.accumulator_bet_legs (accumulator_bet_id, event_id, market_id, selection_id, odds_at_placement)
  select v_acc_id, (leg ->> 'event_id')::uuid, (leg ->> 'market_id')::uuid,
         (leg ->> 'selection_id')::uuid, (leg ->> 'odds')::numeric
  from jsonb_array_elements(v_legs) as leg;

  insert into public.transactions (user_id, type, status, amount, accumulator_bet_id, idempotency_key)
  values (v_user_id, 'BET_DEBIT', 'COMPLETED', -p_stake_amount, v_acc_id, p_idempotency_key);

  return query select v_acc_id, v_total_odds, v_payout;
end;
$$;

revoke all on function public.place_accumulator_bet(uuid[], numeric, text) from public;
grant execute on function public.place_accumulator_bet(uuid[], numeric, text) to authenticated;

-- ── finalize_accumulator_bets ─────────────────────────────────────────────
-- Given a set of accumulator ids whose legs may have just changed,
-- settles every one that now has *no PENDING legs left* (an accumulator
-- spanning several events only becomes decidable once the last of those
-- events has a final score). Called from settle_bets_for_event below
-- after it grades that event's legs.
--
-- Grading rule: any LOST leg sinks the whole accumulator (stake already
-- spent, nothing more happens). Otherwise every leg is WON or VOID —
-- VOID legs are dropped from the odds product (industry-standard "void
-- leg treated as 1.0"), and if every leg turned out VOID the accumulator
-- itself is VOID (full stake refunded, there was nothing left to grade).
create or replace function public.finalize_accumulator_bets(p_accumulator_bet_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_acc record;
  v_has_lost boolean;
  v_pending_count integer;
  v_won_odds numeric;
  v_won_count integer;
begin
  for v_acc in
    select id, user_id, stake_amount
    from public.accumulator_bets
    where id = any(p_accumulator_bet_ids)
      and status = 'PENDING'
    for update
  loop
    select
      count(*) filter (where status = 'PENDING'),
      bool_or(status = 'LOST'),
      coalesce(product(odds_at_placement) filter (where status = 'WON'), 1),
      count(*) filter (where status = 'WON')
    into v_pending_count, v_has_lost, v_won_odds, v_won_count
    from public.accumulator_bet_legs
    where accumulator_bet_id = v_acc.id;

    if v_pending_count > 0 then
      continue; -- still waiting on another event to finish
    end if;

    if v_has_lost then
      update public.accumulator_bets
      set status = 'LOST', settled_at = now()
      where id = v_acc.id;
      -- Stake was already debited at placement; nothing further happens.

    elsif v_won_count = 0 then
      -- Every leg voided — nothing to grade a win or loss on, refund in full.
      update public.accumulator_bets
      set status = 'VOID', settled_at = now(), total_odds_at_placement = 1
      where id = v_acc.id;

      update public.wallets
      set withdrawable_cash = withdrawable_cash + v_acc.stake_amount
      where user_id = v_acc.user_id;

      insert into public.transactions (user_id, type, status, amount, accumulator_bet_id, metadata)
      values (v_acc.user_id, 'BET_REFUND', 'COMPLETED', v_acc.stake_amount, v_acc.id, jsonb_build_object('reason', 'all_legs_void'));

    else
      update public.accumulator_bets
      set status = 'WON', settled_at = now(), total_odds_at_placement = round(v_won_odds, 4)
      where id = v_acc.id;

      update public.wallets
      set withdrawable_cash = withdrawable_cash + round(v_acc.stake_amount * v_won_odds, 2)
      where user_id = v_acc.user_id;

      insert into public.transactions (user_id, type, status, amount, accumulator_bet_id)
      values (v_acc.user_id, 'BET_PAYOUT', 'COMPLETED', round(v_acc.stake_amount * v_won_odds, 2), v_acc.id);
    end if;
  end loop;
end;
$$;

revoke all on function public.finalize_accumulator_bets(uuid[]) from public;
grant execute on function public.finalize_accumulator_bets(uuid[]) to service_role;

-- Postgres has no built-in product() aggregate (only sum/avg/etc.) —
-- numeric_mul is the same internal multiplication function "*" already
-- uses for the numeric type, reused here as the aggregate's step
-- function. Odds are always > 1 (checked on both bets.odds_at_placement
-- and accumulator_bet_legs.odds_at_placement), so there's no zero/null
-- edge case to guard against.
create aggregate public.product(numeric) (
  sfunc = numeric_mul,
  stype = numeric,
  initcond = 1
);

-- ── settle_bets_for_event: now grades accumulator legs too ──────────────
-- Same signature/behavior as before for singles (0009's version,
-- unchanged), plus: grades this event's accumulator legs the same way,
-- then calls finalize_accumulator_bets for every accumulator that had a
-- leg on this event, in case this was the last event it was waiting on.
create or replace function public.settle_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_home_score integer;
  v_away_score integer;
  v_bet record;
  v_affected_acc_ids uuid[];
begin
  select home_score, away_score into v_home_score, v_away_score
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event % not found.', p_event_id;
  end if;
  if v_home_score is null or v_away_score is null then
    raise exception 'Event % has no final score yet.', p_event_id;
  end if;

  for v_bet in
    update public.bets b
    set
      status = public.evaluate_bet_outcome(
        m.type, m.line_value, ms.outcome_code, v_home_score, v_away_score
      ),
      settled_at = now()
    from public.markets m
    join public.market_selections ms on ms.market_id = m.id
    where b.market_id = m.id
      and b.selection_id = ms.id
      and b.event_id = p_event_id
      and b.status = 'PENDING'
      and m.type in (
        'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
        'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE'
      )
    returning b.id, b.user_id, b.stake_amount, b.potential_payout, b.status
  loop
    if v_bet.status = 'WON' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash + v_bet.potential_payout
      where user_id = v_bet.user_id;

      insert into public.transactions (user_id, type, status, amount, bet_id)
      values (v_bet.user_id, 'BET_PAYOUT', 'COMPLETED', v_bet.potential_payout, v_bet.id);

    elsif v_bet.status = 'VOID' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash + v_bet.stake_amount
      where user_id = v_bet.user_id;

      insert into public.transactions (user_id, type, status, amount, bet_id)
      values (v_bet.user_id, 'BET_REFUND', 'COMPLETED', v_bet.stake_amount, v_bet.id);
    end if;
    -- LOST: stake was already debited at placement; nothing further happens.
  end loop;

  update public.markets
  set status = 'SETTLED'
  where event_id = p_event_id
    and status = 'OPEN'
    and type in (
      'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
      'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE'
    );

  -- Accumulator legs on this event, graded the same way singles are.
  update public.accumulator_bet_legs l
  set
    status = public.evaluate_bet_outcome(
      m.type, m.line_value, ms.outcome_code, v_home_score, v_away_score
    ),
    settled_at = now()
  from public.markets m
  join public.market_selections ms on ms.market_id = m.id
  where l.market_id = m.id
    and l.selection_id = ms.id
    and l.event_id = p_event_id
    and l.status = 'PENDING';

  select array_agg(distinct accumulator_bet_id) into v_affected_acc_ids
  from public.accumulator_bet_legs
  where event_id = p_event_id;

  if v_affected_acc_ids is not null then
    perform public.finalize_accumulator_bets(v_affected_acc_ids);
  end if;
end;
$$;

-- ── reopen_accumulator_bets_for_event: wallet-aware reversal for
-- accumulators, called from reopen_bets_for_event below ────────────────
-- Mirrors reopen_bets_for_event's own logic: reverses whatever
-- finalize_accumulator_bets already paid out for any accumulator with a
-- leg on this event, resets that accumulator to PENDING, and resets
-- every leg on this event back to PENDING so a re-run of
-- settle_bets_for_event can re-grade them (and re-finalize the
-- accumulator once every leg is settled again).
create or replace function public.reopen_accumulator_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_acc record;
begin
  for v_acc in
    select distinct ab.id, ab.user_id, ab.stake_amount, ab.potential_payout, ab.status
    from public.accumulator_bets ab
    join public.accumulator_bet_legs l on l.accumulator_bet_id = ab.id
    where l.event_id = p_event_id
      and ab.status in ('WON', 'LOST', 'VOID')
    for update of ab
  loop
    if v_acc.status = 'WON' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash - v_acc.potential_payout
      where user_id = v_acc.user_id;

      insert into public.transactions (user_id, type, status, amount, accumulator_bet_id, metadata)
      values (
        v_acc.user_id, 'ADJUSTMENT', 'COMPLETED', -v_acc.potential_payout, v_acc.id,
        jsonb_build_object('reason', 'resettlement_reversal')
      );
    elsif v_acc.status = 'VOID' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash - v_acc.stake_amount
      where user_id = v_acc.user_id;

      insert into public.transactions (user_id, type, status, amount, accumulator_bet_id, metadata)
      values (
        v_acc.user_id, 'ADJUSTMENT', 'COMPLETED', -v_acc.stake_amount, v_acc.id,
        jsonb_build_object('reason', 'resettlement_reversal')
      );
    end if;
    -- LOST: nothing was ever credited, nothing to reverse.

    update public.accumulator_bets set status = 'PENDING', settled_at = null where id = v_acc.id;
  end loop;

  update public.accumulator_bet_legs
  set status = 'PENDING', settled_at = null
  where event_id = p_event_id
    and status <> 'PENDING';
end;
$$;

revoke all on function public.reopen_accumulator_bets_for_event(uuid) from public;
grant execute on function public.reopen_accumulator_bets_for_event(uuid) to service_role;

-- ── reopen_bets_for_event: now reopens accumulators too ──────────────────
-- Same body as the Phase 3 migration's version for singles, plus a call
-- to reopen_accumulator_bets_for_event so a score correction can't leave
-- an accumulator's payout stuck at a now-wrong figure.
create or replace function public.reopen_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bet record;
begin
  for v_bet in
    select id, user_id, stake_amount, potential_payout, status
    from public.bets
    where event_id = p_event_id
      and status in ('WON', 'LOST', 'VOID')
    for update
  loop
    if v_bet.status = 'WON' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash - v_bet.potential_payout
      where user_id = v_bet.user_id;

      insert into public.transactions (user_id, type, status, amount, bet_id, metadata)
      values (
        v_bet.user_id, 'ADJUSTMENT', 'COMPLETED', -v_bet.potential_payout, v_bet.id,
        jsonb_build_object('reason', 'resettlement_reversal')
      );
    elsif v_bet.status = 'VOID' then
      update public.wallets
      set withdrawable_cash = withdrawable_cash - v_bet.stake_amount
      where user_id = v_bet.user_id;

      insert into public.transactions (user_id, type, status, amount, bet_id, metadata)
      values (
        v_bet.user_id, 'ADJUSTMENT', 'COMPLETED', -v_bet.stake_amount, v_bet.id,
        jsonb_build_object('reason', 'resettlement_reversal')
      );
    end if;

    update public.bets set status = 'PENDING', settled_at = null where id = v_bet.id;
  end loop;

  update public.markets
  set status = 'OPEN'
  where event_id = p_event_id
    and status = 'SETTLED'
    and type in (
      'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
      'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE'
    );

  perform public.reopen_accumulator_bets_for_event(p_event_id);
end;
$$;

revoke all on function public.reopen_bets_for_event(uuid) from public;
grant execute on function public.reopen_bets_for_event(uuid) to service_role;