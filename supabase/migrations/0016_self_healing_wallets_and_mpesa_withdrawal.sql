-- Betwin — self-healing wallet rows + M-Pesa-only withdrawal by phone number
--
-- Two things in one migration because they touch the same functions:
--
-- 1. The backfill in 0015 fixes every *existing* gap, but the underlying
--    fragility remains: any function that assumes a wallets/
--    responsible_gambling_settings row exists will hard-fail again the
--    next time a user account turns out not to have one (a future
--    similar trigger-ordering slip, a row created some other way, etc).
--    ensure_wallet/ensure_responsible_gambling_settings below make that
--    self-healing — called at the top of every function that needs one,
--    instead of each of those functions separately trusting the row is
--    there.
--
-- 2. Withdrawals move from "pick a stored payment method" to a direct
--    phone-number input, since M-Pesa is the only option for now — a
--    payment-method dropdown was scaffolding for a multi-provider future
--    that doesn't exist yet. The closed-loop rule still applies: the
--    number has to match one that actually funded a completed deposit.

create or replace function public.ensure_wallet(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.ensure_responsible_gambling_settings(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.responsible_gambling_settings (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- Neither is granted to anon/authenticated/service_role — they're only
-- ever called from inside another security-definer function below, which
-- runs as this migration's role regardless of who invoked it, the same
-- way every other internal helper in this schema (e.g. set_updated_at)
-- needs no explicit grant of its own.

-- ── place_bet: self-heals both rows before using them ───────────────────
-- Same signature as the Phase 5/6 migrations (uuid, numeric, text
-- default null) — CREATE OR REPLACE is enough, no drop needed.
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

  perform public.ensure_wallet(v_user_id);
  perform public.ensure_responsible_gambling_settings(v_user_id);

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

-- ── adjust_wallet_balance: self-heals the target wallet ──────────────────
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

  perform public.ensure_wallet(p_user_id);

  update public.wallets
  set
    withdrawable_cash = withdrawable_cash + case when p_bucket = 'withdrawable_cash' then p_amount else 0 end,
    bonus_funds = bonus_funds + case when p_bucket = 'bonus_funds' then p_amount else 0 end
  where user_id = p_user_id;

  insert into public.transactions (user_id, type, status, amount, metadata)
  values (p_user_id, 'ADJUSTMENT', 'COMPLETED', p_amount, jsonb_build_object('bucket', p_bucket, 'reason', p_reason));
end;
$$;

-- ── resolve_manual_deposit_request: self-heals the depositor's wallet ────
create or replace function public.resolve_manual_deposit_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_req public.manual_deposit_requests%rowtype;
  v_payment_method_id uuid;
  v_transaction_id uuid;
begin
  select * into v_req from public.manual_deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Manual deposit request % not found.', p_request_id;
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'Request % has already been %.', p_request_id, lower(v_req.status::text);
  end if;

  if not p_approve then
    update public.manual_deposit_requests
    set status = 'REJECTED', admin_note = p_note, reviewed_by = p_admin_user_id, reviewed_at = now()
    where id = p_request_id;
    return;
  end if;

  perform public.ensure_wallet(v_req.user_id);

  select id into v_payment_method_id
  from public.payment_methods
  where user_id = v_req.user_id
    and provider = 'MPESA'
    and payment_method_token = v_req.mpesa_phone
    and active
  limit 1;

  if v_payment_method_id is null then
    insert into public.payment_methods (user_id, provider, payment_method_token, display_label)
    values (v_req.user_id, 'MPESA', v_req.mpesa_phone, 'M-Pesa (' || v_req.mpesa_phone || ')')
    returning id into v_payment_method_id;
  end if;

  update public.wallets
  set withdrawable_cash = withdrawable_cash + v_req.claimed_amount
  where user_id = v_req.user_id;

  insert into public.transactions (user_id, type, status, amount, payment_method_id, metadata)
  values (
    v_req.user_id, 'DEPOSIT', 'COMPLETED', v_req.claimed_amount, v_payment_method_id,
    jsonb_build_object('mpesa_code', v_req.mpesa_code, 'manual_deposit_request_id', v_req.id)
  )
  returning id into v_transaction_id;

  update public.manual_deposit_requests
  set
    status = 'APPROVED',
    admin_note = p_note,
    transaction_id = v_transaction_id,
    reviewed_by = p_admin_user_id,
    reviewed_at = now()
  where id = p_request_id;
end;
$$;

-- ── request_withdrawal: now takes a phone number, not a stored method ───
-- M-Pesa is the only option for now, so asking the user to pick from a
-- dropdown of "payment methods" was scaffolding for a multi-provider
-- future that doesn't exist yet — a plain phone number input is what the
-- roadmap's Phase 6 wallet page actually needs today. The closed-loop
-- rule is unchanged in spirit: the number has to match one that actually
-- funded a completed deposit, it just checks that against
-- payment_methods.payment_method_token directly instead of a pre-picked id.
--
-- Signature changes (numeric, uuid) -> (numeric, text), so the old
-- function has to be dropped first (CREATE OR REPLACE can't change a
-- function's parameter list).
drop function if exists public.request_withdrawal(numeric, uuid);

create function public.request_withdrawal(
  p_amount numeric,
  p_mpesa_phone text
)
returns table (transaction_id uuid, status public.transaction_status, estimated_processing_hours integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment_method_id uuid;
  v_withdrawable numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero.';
  end if;
  if p_mpesa_phone is null or trim(p_mpesa_phone) = '' then
    raise exception 'Enter the M-Pesa number to send the withdrawal to.';
  end if;

  perform public.ensure_wallet(v_user_id);

  -- Closed-loop rule, enforced here rather than only in the withdrawal
  -- form's UI (per the roadmap: "this must be a backend check"): the
  -- number must be one that has actually funded a completed deposit on
  -- this account. Looked up by the phone number itself now, not a
  -- pre-selected payment_method_id.
  select pm.id into v_payment_method_id
  from public.payment_methods pm
  where pm.user_id = v_user_id
    and pm.provider = 'MPESA'
    and pm.payment_method_token = trim(p_mpesa_phone)
    and pm.active
    and exists (
      select 1 from public.transactions t
      where t.user_id = v_user_id
        and t.payment_method_id = pm.id
        and t.type = 'DEPOSIT'
        and t.status = 'COMPLETED'
    )
  limit 1;

  if v_payment_method_id is null then
    raise exception 'Withdrawals can only go to an M-Pesa number that has funded a completed deposit on this account.';
  end if;

  select withdrawable_cash into v_withdrawable
  from public.wallets
  where user_id = v_user_id
  for update;

  if v_withdrawable < p_amount then
    raise exception 'Insufficient withdrawable balance.';
  end if;

  update public.wallets
  set withdrawable_cash = withdrawable_cash - p_amount
  where user_id = v_user_id;

  insert into public.transactions (user_id, type, status, amount, payment_method_id)
  values (v_user_id, 'WITHDRAWAL', 'PENDING_REVIEW', -p_amount, v_payment_method_id)
  returning id into v_transaction_id;

  return query select v_transaction_id, 'PENDING_REVIEW'::public.transaction_status, 24;
end;
$$;

revoke all on function public.request_withdrawal(numeric, text) from public;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;
