-- Bet606 — Phase 3 (Wagering Roadmap): wallet & transactions
--
-- Scope note: Phase 0's payment-processor question is still unanswered
-- (see Bet606_Wagering_Wallet_Roadmap.md), so there is deliberately no
-- self-serve "deposit" path in this migration — a same-request "tell us
-- how much you paid, we'll credit it" endpoint would let any authenticated
-- user print money. What's built instead:
--   - the ledger schema a real processor's webhook would write into once
--     Phase 0 picks one (record/adjust functions, admin-only for now)
--   - place_bet: the real, wallet-debiting version of Phase 2's placeBet,
--     now that there's a wallet to debit
--   - request_withdrawal: safe to expose today because it only moves a
--     user's own existing balance into escrow, never creates funds
--   - wallet-aware settlement: winning/void bets now actually pay out

-- ── Enums ────────────────────────────────────────────────────────────────
create type public.transaction_type as enum (
  'DEPOSIT', 'WITHDRAWAL', 'BET_DEBIT', 'BET_PAYOUT', 'BET_REFUND', 'ADJUSTMENT'
);

create type public.transaction_status as enum (
  'COMPLETED', 'PENDING_REVIEW', 'REJECTED'
);

-- ── Wallets ──────────────────────────────────────────────────────────────
create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  withdrawable_cash numeric(14, 2) not null default 0 check (withdrawable_cash >= 0),
  -- Bonus/promo credit, kept separate per the roadmap spec. This
  -- migration moves money in and out of it (place_bet can debit it,
  -- adjust_wallet_balance can credit it) but does not implement a
  -- wagering-requirements engine — that's a separate promo-mechanics
  -- decision, not a schema gap.
  bonus_funds numeric(14, 2) not null default 0 check (bonus_funds >= 0),
  total_balance numeric(14, 2) generated always as (withdrawable_cash + bonus_funds) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

-- Every user gets a zero-balance wallet at signup, same pattern as
-- handle_new_user creating a profiles row.
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();

-- ── Payment methods ──────────────────────────────────────────────────────
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Free text rather than an enum: Phase 0 hasn't picked a processor
  -- (Stripe? a card processor? Mpesa via a local PSP?), and each has a
  -- different tokenization flow — pinning this down to an enum now would
  -- just mean an awkward migration later.
  provider text not null,
  payment_method_token text not null,
  display_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index payment_methods_user_id_idx on public.payment_methods (user_id);

-- ── Transactions (append-only ledger) ────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  status public.transaction_status not null default 'COMPLETED',
  -- Signed: positive credits the wallet, negative debits it. Lets a
  -- correction (e.g. reversing a wrongly-settled bet, or refunding a
  -- rejected withdrawal) just be another row with the opposite sign,
  -- rather than an update to a "historical" row — the ledger stays
  -- append-only in practice, not just in name.
  amount numeric(14, 2) not null check (amount <> 0),
  bet_id uuid references public.bets (id),
  payment_method_id uuid references public.payment_methods (id),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_bet_id_idx on public.transactions (bet_id);
create index transactions_status_idx on public.transactions (status);
-- A repeated Idempotency-Key from the same client retry should hit the
-- same row rather than create a second one; global uniqueness (not
-- per-user) matches a client-generated UUID key being globally unique.
create unique index transactions_idempotency_key_idx on public.transactions (idempotency_key)
  where idempotency_key is not null;

comment on column public.transactions.amount is
  'Signed. Positive = credited to the wallet (DEPOSIT, BET_PAYOUT, '
  'BET_REFUND, a positive ADJUSTMENT). Negative = debited (WITHDRAWAL '
  'escrow, BET_DEBIT, a negative ADJUSTMENT). wallets.withdrawable_cash / '
  'bonus_funds are a cache maintained alongside each insert here, never '
  'hand-edited directly — see place_bet / settle_bets_for_event / '
  'adjust_wallet_balance below, which are the only writers.';

-- ── Idempotency keys ─────────────────────────────────────────────────────
-- No RLS policies at all (table below still enables RLS) — this table is
-- never queried through PostgREST directly by a client; only the
-- security-definer functions below (running as their owner, which
-- bypasses RLS on tables that owner created) touch it.
create table public.idempotency_keys (
  key text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  request_payload jsonb not null,
  response jsonb,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.wallets enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.idempotency_keys enable row level security;

create policy "Users can view their own wallet"
  on public.wallets for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all wallets"
  on public.wallets for select
  to authenticated
  using (public.is_admin());

create policy "Users can view their own payment methods"
  on public.payment_methods for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all payment methods"
  on public.payment_methods for select
  to authenticated
  using (public.is_admin());

create policy "Users can view their own transactions"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all transactions"
  on public.transactions for select
  to authenticated
  using (public.is_admin());

-- No insert/update policies anywhere above: every write to wallets,
-- transactions, or payment_methods happens inside one of the
-- security-definer functions below, never as a direct client insert —
-- that's what keeps "insufficient balance" and "closed-loop withdrawal"
-- checks impossible to bypass from the client.

-- ── place_bet: the real Phase 2 placeBet, now with a wallet to debit ────
-- Re-does every check src/actions/bets.ts's placeholder already did
-- (selection priced and active, market OPEN, event PUBLISHED/LIVE), then
-- adds the part that couldn't exist before this migration: locks the
-- wallet row, confirms funds cover the stake, debits it, and inserts the
-- bet + a matching BET_DEBIT transaction in the same transaction block —
-- so a bet can never exist without a matching debit, or vice versa.
create or replace function public.place_bet(
  p_selection_id uuid,
  p_stake_amount numeric
)
returns table (bet_id uuid, odds_at_placement numeric, potential_payout numeric)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_market_id uuid;
  v_event_id uuid;
  v_selection_active boolean;
  v_odds numeric;
  v_market_status public.market_status;
  v_event_status public.event_status;
  v_withdrawable numeric;
  v_bonus numeric;
  v_from_withdrawable numeric;
  v_from_bonus numeric;
  v_bet_id uuid;
  v_payout numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;
  if p_stake_amount is null or p_stake_amount <= 0 then
    raise exception 'Stake must be greater than zero.';
  end if;

  -- Lock the selection row so its odds can't move underneath us between
  -- the read below and the insert — same "never trust/reuse a stale odds
  -- value" concern the roadmap calls out, extended to concurrent requests.
  select ms.market_id, ms.active, ms.current_odds, m.event_id, m.status, e.status
  into v_market_id, v_selection_active, v_odds, v_event_id, v_market_status, v_event_status
  from public.market_selections ms
  join public.markets m on m.id = ms.market_id
  join public.events e on e.id = m.event_id
  where ms.id = p_selection_id
  for update of ms;

  if not found then
    raise exception 'Selection not found.';
  end if;
  if not v_selection_active then
    raise exception 'This selection is no longer active.';
  end if;
  if v_odds is null then
    raise exception 'This selection hasn''t been priced yet.';
  end if;
  if v_market_status <> 'OPEN' then
    raise exception 'This market is closed for betting.';
  end if;
  if v_event_status not in ('PUBLISHED', 'LIVE') then
    raise exception 'Betting is closed for this event.';
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

  -- Debit withdrawable_cash first, bonus_funds for any remainder. A real
  -- wagering-requirements engine (how much of a bonus credit still needs
  -- to be played through before it counts as withdrawable) is a promo-
  -- mechanics decision on top of this, not implemented here — this just
  -- keeps both buckets from going negative.
  v_from_withdrawable := least(v_withdrawable, p_stake_amount);
  v_from_bonus := p_stake_amount - v_from_withdrawable;

  update public.wallets
  set
    withdrawable_cash = withdrawable_cash - v_from_withdrawable,
    bonus_funds = bonus_funds - v_from_bonus
  where user_id = v_user_id;

  v_payout := round(p_stake_amount * v_odds, 2);

  insert into public.bets (user_id, event_id, market_id, selection_id, stake_amount, odds_at_placement)
  values (v_user_id, v_event_id, v_market_id, p_selection_id, p_stake_amount, v_odds)
  returning id into v_bet_id;

  insert into public.transactions (user_id, type, status, amount, bet_id)
  values (v_user_id, 'BET_DEBIT', 'COMPLETED', -p_stake_amount, v_bet_id);

  return query select v_bet_id, v_odds, v_payout;
end;
$$;

revoke all on function public.place_bet(uuid, numeric) from public;
grant execute on function public.place_bet(uuid, numeric) to authenticated;

-- ── request_withdrawal: safe to expose directly — moves existing funds
-- into escrow, never creates new ones ─────────────────────────────────
create or replace function public.request_withdrawal(
  p_amount numeric,
  p_payment_method_id uuid
)
returns table (transaction_id uuid, status public.transaction_status, estimated_processing_hours integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_withdrawable numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero.';
  end if;

  if not exists (
    select 1 from public.payment_methods
    where id = p_payment_method_id and user_id = v_user_id and active
  ) then
    raise exception 'That payment method isn''t on file for your account.';
  end if;

  -- Closed-loop rule, enforced here rather than only in the withdrawal
  -- form's UI (per the roadmap: "this must be a backend check"): the
  -- payout method must be one that has actually funded a completed
  -- deposit on this account.
  if not exists (
    select 1 from public.transactions
    where user_id = v_user_id
      and payment_method_id = p_payment_method_id
      and type = 'DEPOSIT'
      and status = 'COMPLETED'
  ) then
    raise exception 'Withdrawals can only go to a method that has funded a completed deposit on this account.';
  end if;

  select withdrawable_cash into v_withdrawable
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found.';
  end if;
  if v_withdrawable < p_amount then
    raise exception 'Insufficient withdrawable balance.';
  end if;

  -- Pessimistic: the funds leave withdrawable_cash immediately (this is
  -- the escrow) and only fully leave the ledger once resolve_withdrawal
  -- marks this COMPLETED after compliance review.
  update public.wallets
  set withdrawable_cash = withdrawable_cash - p_amount
  where user_id = v_user_id;

  insert into public.transactions (user_id, type, status, amount, payment_method_id)
  values (v_user_id, 'WITHDRAWAL', 'PENDING_REVIEW', -p_amount, p_payment_method_id)
  returning id into v_transaction_id;

  return query select v_transaction_id, 'PENDING_REVIEW'::public.transaction_status, 24;
end;
$$;

revoke all on function public.request_withdrawal(numeric, uuid) from public;
grant execute on function public.request_withdrawal(numeric, uuid) to authenticated;

-- ── resolve_withdrawal: admin-only (Phase 7's compliance review) ────────
-- Not exposed to authenticated/anon at all — only reachable via the
-- service-role client, same trust boundary as every other admin action
-- in this codebase (requireAdmin() gates the Server Action that calls
-- this, not this function itself).
create or replace function public.resolve_withdrawal(
  p_transaction_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_txn public.transactions%rowtype;
begin
  select * into v_txn from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction % not found.', p_transaction_id;
  end if;
  if v_txn.type <> 'WITHDRAWAL' or v_txn.status <> 'PENDING_REVIEW' then
    raise exception 'Transaction % is not a pending withdrawal.', p_transaction_id;
  end if;

  if p_approve then
    update public.transactions set status = 'COMPLETED' where id = p_transaction_id;
  else
    update public.transactions set status = 'REJECTED' where id = p_transaction_id;
    update public.wallets
    set withdrawable_cash = withdrawable_cash + abs(v_txn.amount)
    where user_id = v_txn.user_id;
    insert into public.transactions (user_id, type, status, amount, metadata)
    values (
      v_txn.user_id, 'ADJUSTMENT', 'COMPLETED', abs(v_txn.amount),
      jsonb_build_object('reversed_transaction_id', v_txn.id, 'reason', 'withdrawal_rejected')
    );
  end if;
end;
$$;

revoke all on function public.resolve_withdrawal(uuid, boolean) from public;
grant execute on function public.resolve_withdrawal(uuid, boolean) to service_role;

-- ── adjust_wallet_balance: admin-only manual correction ─────────────────
-- Phase 7 explicitly anticipates "manual balance adjustments" as an
-- audited admin action; this is that function. It's also, for now, the
-- only way a wallet gets funded at all — there is intentionally no
-- self-serve deposit path until Phase 0 picks a payment processor (see
-- the migration's top-of-file scope note).
create or replace function public.adjust_wallet_balance(
  p_user_id uuid,
  p_amount numeric,
  p_bucket text,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Adjustment amount can''t be zero.';
  end if;
  if p_bucket not in ('withdrawable_cash', 'bonus_funds') then
    raise exception 'Unknown wallet bucket: %', p_bucket;
  end if;

  update public.wallets
  set
    withdrawable_cash = withdrawable_cash + case when p_bucket = 'withdrawable_cash' then p_amount else 0 end,
    bonus_funds = bonus_funds + case when p_bucket = 'bonus_funds' then p_amount else 0 end
  where user_id = p_user_id;

  if not found then
    raise exception 'Wallet not found for user %.', p_user_id;
  end if;

  insert into public.transactions (user_id, type, status, amount, metadata)
  values (p_user_id, 'ADJUSTMENT', 'COMPLETED', p_amount, jsonb_build_object('bucket', p_bucket, 'reason', p_reason));
end;
$$;

revoke all on function public.adjust_wallet_balance(uuid, numeric, text, text) from public;
grant execute on function public.adjust_wallet_balance(uuid, numeric, text, text) to service_role;

-- ── settle_bets_for_event: now pays out ─────────────────────────────────
-- Phase 2's version only flipped bets.status. Replaced here (same
-- signature) to also move real money: a WON bet credits its full
-- potential_payout (stake already included, per decimal-odds
-- convention), a VOID bet refunds its stake (it was debited in full at
-- placement), and a LOST bet needs nothing further — its stake was
-- already spent at placement and never comes back.
create or replace function public.settle_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_home_score integer;
  v_away_score integer;
  v_bet record;
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
end;
$$;

-- ── reopen_bets_for_event: wallet-aware counterpart to the reopen half
-- of resettleEventBets ──────────────────────────────────────────────────
-- Reverses whatever settle_bets_for_event already paid out for this
-- event's WON/VOID bets (so re-running settlement after a score
-- correction can't double-pay), then resets those bets to PENDING so
-- settle_bets_for_event can re-grade them. Admin-only, same trust
-- boundary as resolve_withdrawal/adjust_wallet_balance.
--
-- Edge case worth knowing about: if the user has since spent or
-- withdrawn a payout being reversed here, this update can violate
-- wallets.withdrawable_cash's >= 0 check and the whole call fails
-- loudly rather than silently letting a balance go negative — that's
-- intentional (an admin then has to resolve it manually, e.g. via
-- adjust_wallet_balance once the wallet has room), not a bug.
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
end;
$$;

revoke all on function public.reopen_bets_for_event(uuid) from public;
grant execute on function public.reopen_bets_for_event(uuid) to service_role;
