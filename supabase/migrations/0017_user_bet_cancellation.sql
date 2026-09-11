-- Bet606 — Wagering roadmap follow-up: user-initiated bet cancellation
--
-- Gap this closes: a user who places the same bet twice by mistake (two
-- separate placeBet calls — a double-tap that generated two idempotency
-- keys, or genuinely meaning to change their mind) previously had no way
-- to undo it. Active Bets was read-only. This adds a narrow, safe
-- cancellation path: a PENDING bet on an event that hasn't started yet
-- can be cancelled by its own owner, which refunds the stake and marks
-- the bet VOID — the same status/refund shape settle_bets_for_event
-- already uses for an admin-voided bet, so every downstream display
-- (MyBetsManager's "Refunded" badge, the ledger) already knows how to
-- show it without any UI-side branching for "cancelled" vs "voided".
--
-- Deliberately scoped tighter than "any PENDING bet": once an event goes
-- LIVE (or later), letting a user cancel would let them dodge a bet
-- that's started losing — so cancellation is only allowed while the
-- event is still PUBLISHED (published, not yet kicked off).
create or replace function public.cancel_bet(p_bet_id uuid)
returns table (refunded_amount numeric)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_event_status public.event_status;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id
  for update;

  if not found then
    raise exception 'Bet not found.';
  end if;
  if v_bet.user_id <> v_user_id then
    raise exception 'This isn''t your bet.';
  end if;
  if v_bet.status <> 'PENDING' then
    raise exception 'Only pending bets can be cancelled.';
  end if;

  select status into v_event_status from public.events where id = v_bet.event_id;
  if v_event_status is distinct from 'PUBLISHED' then
    raise exception 'This bet can no longer be cancelled — the event has already started.';
  end if;

  -- Refund goes to withdrawable_cash, same bucket settle_bets_for_event
  -- refunds a VOID bet's stake to — the split across withdrawable_cash /
  -- bonus_funds at placement time isn't tracked per-bet, so mirroring
  -- the existing VOID convention is what keeps this consistent with
  -- every other refund in the ledger, not a new one-off rule.
  update public.wallets
  set withdrawable_cash = withdrawable_cash + v_bet.stake_amount
  where user_id = v_user_id;

  update public.bets
  set status = 'VOID', settled_at = now()
  where id = p_bet_id;

  insert into public.transactions (user_id, type, status, amount, bet_id, metadata)
  values (
    v_user_id, 'BET_REFUND', 'COMPLETED', v_bet.stake_amount, p_bet_id,
    jsonb_build_object('reason', 'user_cancelled')
  );

  return query select v_bet.stake_amount;
end;
$$;

revoke all on function public.cancel_bet(uuid) from public;
grant execute on function public.cancel_bet(uuid) to authenticated;
