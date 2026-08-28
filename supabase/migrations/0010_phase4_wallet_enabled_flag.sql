-- Betwin — Phase 4 (Wagering Roadmap): header balance + deposit button
--
-- Phase 8 of the roadmap calls for feature-flagging "the whole wallet
-- system" behind a platform_settings row so it can ship to admins only,
-- then a beta cohort, then everyone. Introducing it now — the moment
-- wallet UI first becomes visible to end users at all — rather than
-- waiting for Phase 8, so this header change doesn't show a live-looking
-- Deposit button to real users before deposits actually work (there is
-- still no payment processor — see the Phase 3 migration).

insert into public.platform_settings (key, value)
values ('wallet_enabled', 'false'::jsonb)
on conflict (key) do nothing;
