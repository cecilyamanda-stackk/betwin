-- Bet606 — Phase 6 (Wagering Roadmap): Responsible Gambling controls
--
-- Scope note: Phase 0's groundwork calls for a drafted Responsible
-- Gambling *policy* (a legal/compliance document) before this UI tab
-- exists — that draft still hasn't happened, and this migration doesn't
-- pretend otherwise. What it adds is the mechanical half regulators and
-- policies universally require regardless of jurisdiction specifics:
-- user-controlled deposit limits and self-exclusion, actually enforced
-- server-side rather than left as a UI-only suggestion. Once Phase 0's
-- policy is drafted, the copy/thresholds in the account page can change;
-- the enforcement plumbing here shouldn't need to.

create type public.deposit_limit_period as enum ('DAILY', 'WEEKLY', 'MONTHLY');

create table public.responsible_gambling_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deposit_limit_amount numeric(12, 2) check (deposit_limit_amount is null or deposit_limit_amount > 0),
  deposit_limit_period public.deposit_limit_period,
  -- Covers both "cool-off" (a short, user-chosen break) and
  -- "self-exclusion" (a long one) — they're the same mechanism at
  -- different durations, not different mechanics, so one column serves
  -- both rather than duplicating the same block-until-a-date logic twice.
  excluded_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint responsible_gambling_settings_limit_needs_period check (
    (deposit_limit_amount is null) = (deposit_limit_period is null)
  )
);

create trigger responsible_gambling_settings_set_updated_at
  before update on public.responsible_gambling_settings
  for each row execute function public.set_updated_at();

-- Every user gets a row (all nulls = no restrictions) at signup, same
-- pattern as wallets.
create or replace function public.handle_new_user_responsible_gambling()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.responsible_gambling_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_responsible_gambling
  after insert on auth.users
  for each row execute function public.handle_new_user_responsible_gambling();

alter table public.responsible_gambling_settings enable row level security;

create policy "Users can view their own responsible gambling settings"
  on public.responsible_gambling_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all responsible gambling settings"
  on public.responsible_gambling_settings for select
  to authenticated
  using (public.is_admin());

-- No insert/update policy: both writes below go through security-definer
-- functions, which is what makes self-exclusion actually irreversible by
-- the user rather than a checkbox they could just uncheck.

-- ── set_deposit_limit: user-callable, takes effect immediately ─────────
-- Simplification worth flagging: a real responsible-gambling
-- implementation typically delays a limit *increase* by 24-48 hours
-- (so someone can't raise their own limit mid-session to keep chasing
-- losses) while a *decrease* applies immediately. This applies both
-- directions immediately. Tightening that is a policy decision for
-- Phase 0's draft to make, not something to guess at here.
create or replace function public.set_deposit_limit(
  p_amount numeric,
  p_period public.deposit_limit_period
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;
  if (p_amount is null) <> (p_period is null) then
    raise exception 'A deposit limit needs both an amount and a period, or neither to clear it.';
  end if;
  if p_amount is not null and p_amount <= 0 then
    raise exception 'Deposit limit must be greater than zero.';
  end if;

  update public.responsible_gambling_settings
  set deposit_limit_amount = p_amount, deposit_limit_period = p_period
  where user_id = v_user_id;

  if not found then
    raise exception 'Responsible gambling settings not found for this account.';
  end if;
end;
$$;

revoke all on function public.set_deposit_limit(numeric, public.deposit_limit_period) from public;
grant execute on function public.set_deposit_limit(numeric, public.deposit_limit_period) to authenticated;

-- ── start_self_exclusion: user-callable, one-directional ────────────────
-- Can only push excluded_until further into the future, never shorten or
-- clear it — that irreversibility (until an admin/compliance override,
-- which is Phase 7 territory and intentionally not built here) is the
-- entire point of self-exclusion as a control. "Permanent" is just a very
-- long p_days from the UI (e.g. 36500 ≈ 100 years) rather than a special
-- case, so the same one-directional check covers it for free.
create or replace function public.start_self_exclusion(p_days integer)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current timestamptz;
  v_new timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;
  if p_days is null or p_days <= 0 then
    raise exception 'Duration must be at least one day.';
  end if;

  v_new := now() + (p_days || ' days')::interval;

  select excluded_until into v_current
  from public.responsible_gambling_settings
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Responsible gambling settings not found for this account.';
  end if;
  if v_current is not null and v_current > v_new then
    raise exception 'You''re already excluded until %, which is later than that.', v_current;
  end if;

  update public.responsible_gambling_settings
  set excluded_until = v_new
  where user_id = v_user_id;

  return v_new;
end;
$$;

revoke all on function public.start_self_exclusion(integer) from public;
grant execute on function public.start_self_exclusion(integer) to authenticated;

-- ── Enforcement: place_bet now also checks exclusion ─────────────────────
-- Same signature as the Phase 5 migration (uuid, numeric, text default
-- null) — CREATE OR REPLACE is enough, no drop needed. Withdrawals are
-- deliberately left unaffected by exclusion (an excluded user can still
-- get their existing balance out, which is the standard industry
-- practice — exclusion blocks new action, not access to your own money).
create or replace function public.place_bet(
  p_selection_id uuid,
  p_stake_amount numeric,
  p_idempotency_key text default null
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
  v_excluded_until timestamptz;
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

  if p_idempotency_key is not null then
    select b.id, b.odds_at_placement, b.potential_payout
    into v_bet_id, v_odds, v_payout
    from public.transactions t
    join public.bets b on b.id = t.bet_id
    where t.idempotency_key = p_idempotency_key
      and t.user_id = v_user_id
    limit 1;

    if found then
      return query select v_bet_id, v_odds, v_payout;
      return;
    end if;
  end if;

  select excluded_until into v_excluded_until
  from public.responsible_gambling_settings
  where user_id = v_user_id;

  if v_excluded_until is not null and v_excluded_until > now() then
    raise exception 'Your account is self-excluded from betting until %.', v_excluded_until;
  end if;

  if p_stake_amount is null or p_stake_amount <= 0 then
    raise exception 'Stake must be greater than zero.';
  end if;

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

  insert into public.transactions (user_id, type, status, amount, bet_id, idempotency_key)
  values (v_user_id, 'BET_DEBIT', 'COMPLETED', -p_stake_amount, v_bet_id, p_idempotency_key);

  return query select v_bet_id, v_odds, v_payout;
end;
$$;
