-- Backfill: wallets / responsible_gambling_settings for pre-existing users
--
-- Root cause of "Wallet not found for user <id>" (and the same gap for
-- responsible_gambling_settings, which would show up as place_bet
-- silently skipping the exclusion check, or getResponsibleGamblingSettings
-- erroring "no rows"): both tables only ever get a row via an AFTER
-- INSERT trigger on auth.users (handle_new_user_wallet in migration
-- 0009, handle_new_user_responsible_gambling in migration 0012). A
-- trigger like that only fires for rows inserted *after* the trigger
-- itself was created — any account that existed before those migrations
-- ran (including one created by scripts/seed-admin.ts before wallets
-- shipped) has no corresponding row, so every function that assumes one
-- exists (place_bet, resolve_manual_deposit_request,
-- adjust_wallet_balance, request_withdrawal, ...) fails against it.
--
-- One-time backfill, safe to re-run: it only fills gaps for users who
-- don't already have a row, never touches or overwrites an existing one.
insert into public.wallets (user_id)
select u.id
from auth.users u
left join public.wallets w on w.user_id = u.id
where w.user_id is null
on conflict (user_id) do nothing;

insert into public.responsible_gambling_settings (user_id)
select u.id
from auth.users u
left join public.responsible_gambling_settings r on r.user_id = u.id
where r.user_id is null
on conflict (user_id) do nothing;
