-- Betwin — Phase 5 (Wagering Roadmap): bet slip idempotency
--
-- Phase 5's spec pairs the bet slip's submit-protection (button disables
-- on click, stays disabled until the server responds) with "the
-- idempotency key from Phase 3" so double-submission is a non-issue at
-- both layers — the button state prevents a second click from a patient
-- user, the key prevents a second insert from a retried request (a
-- flaky connection, a double-tap, a client bug) that goes through
-- anyway. Phase 3 built the mechanism (transactions.idempotency_key,
-- unique) for deposit/withdraw; this extends place_bet to use it too.
--
-- Signature changes (uuid, numeric) -> (uuid, numeric, text default
-- null), so existing two-argument callers still work unchanged — but the
-- old two-arg function has to be dropped first, since CREATE OR REPLACE
-- can't change a function's parameter list, only its body.
drop function if exists public.place_bet(uuid, numeric);

create function public.place_bet(
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

  -- Idempotent replay: a request that already succeeded under this key
  -- returns the same result again instead of placing a second bet. Keyed
  -- to this user too, so one user can't guess/replay another's key.
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

revoke all on function public.place_bet(uuid, numeric, text) from public;
grant execute on function public.place_bet(uuid, numeric, text) to authenticated;
