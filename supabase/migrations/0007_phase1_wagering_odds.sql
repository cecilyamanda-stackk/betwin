-- Betwin — Phase 1 (Wagering Roadmap): richer markets & odds
--
-- Scope note (see Betwin_Wagering_Wallet_Roadmap.md): this migration only
-- adds the *data model* for real-money markets/odds/stakes. It does not
-- wire up money movement — there is still no wallet/transactions table
-- (that's Phase 3) and no placeBet Server Action (Phase 2). Phase 0's
-- open questions (licensing jurisdiction, payment processor, currency,
-- points-vs-wagering coexistence) are still unanswered, so this migration
-- makes the conservative choice on the one decision it can't defer:
--
--   The existing free-to-play `predictions` / `leaderboard_scores` tables
--   are left completely untouched. `bets` is a new, parallel table rather
--   than a modification of `predictions`, so the points game keeps
--   working exactly as it does today regardless of how the coexistence
--   question above eventually gets answered. If the answer turns out to
--   be "replace the points game," migrating `predictions` rows into
--   `bets` (or dropping `predictions`) is a follow-up migration, not a
--   change to this one.

-- ── Market types: add the five requested families ──────────────────────
-- Existing values (MATCH_RESULT, CORRECT_SCORE, TOTAL_GOALS,
-- BOTH_TEAMS_SCORE, OTHER) are kept as-is for any markets already using
-- them — nothing here renames or removes a value.
-- Note: ALTER TYPE ... ADD VALUE takes effect immediately for reads/writes
-- in *other* transactions once this migration commits; we deliberately
-- avoid referencing any of these new values later in this same file so
-- the migration doesn't hit Postgres's "unsafe use of new value" guard.
alter type public.market_type add value if not exists 'MATCH_WINNER_3WAY';
alter type public.market_type add value if not exists 'MONEYLINE';
alter type public.market_type add value if not exists 'OVER_UNDER';
alter type public.market_type add value if not exists 'HANDICAP';
alter type public.market_type add value if not exists 'BOTH_TEAMS_TO_SCORE';
alter type public.market_type add value if not exists 'DOUBLE_CHANCE';

-- ── Markets: line value for Over/Under and Handicap ─────────────────────
alter table public.markets
  add column line_value numeric(6, 2);

comment on column public.markets.line_value is
  'The number a market''s outcomes are compared against — e.g. 2.5 for '
  'an Over/Under market, or the point spread for a Handicap market. Null '
  'for market types that don''t use a line (Match Winner, BTTS, Double '
  'Chance).';

-- ── Market selections: odds + internal risk probability ─────────────────
alter table public.market_selections
  add column current_odds numeric(8, 2) check (current_odds is null or current_odds > 1),
  add column true_probability numeric(6, 5) check (
    true_probability is null or (true_probability >= 0 and true_probability <= 1)
  );

comment on column public.market_selections.current_odds is
  'Decimal odds shown to users and locked into bets.odds_at_placement at '
  'bet time. Nullable so existing points-game selections (and brand-new '
  'selections before an admin prices them) don''t need a value.';

comment on column public.market_selections.true_probability is
  'Internal risk-desk estimate of the outcome''s real probability, used '
  'to price/monitor margin. Never sent to the client — enforced below via '
  'column-level privileges, not just application code, since this table '
  'already has a "viewable by everyone" RLS policy for its other columns.';

-- Lock true_probability out of the anon/authenticated grants that Supabase
-- applies by default, while leaving every other existing column readable
-- exactly as before (the table's RLS policy still governs which *rows*
-- are visible). service_role (used by every admin Server Action via
-- lib/supabase/admin.ts) is unaffected and keeps full column access.
revoke select on public.market_selections from anon, authenticated;
grant select (id, market_id, name, value, active, created_at, current_odds)
  on public.market_selections to anon, authenticated;

-- ── Bets ─────────────────────────────────────────────────────────────────
create type public.bet_status as enum ('PENDING', 'WON', 'LOST', 'VOID');

-- Deliberately its own table rather than an alter of `predictions` — see
-- the scope note at the top of this file. One row per stake; a user can
-- have both a `predictions` row (points) and a `bets` row (money) against
-- the same market once the coexistence question is answered.
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  selection_id uuid not null references public.market_selections (id) on delete cascade,
  stake_amount numeric(12, 2) not null check (stake_amount > 0),
  -- Locked at placement time from market_selections.current_odds; never
  -- recalculated even if the market's odds move afterward (roadmap
  -- Phase 2: placeBet re-reads current_odds server-side and copies it
  -- here, it does not trust a client-supplied value).
  odds_at_placement numeric(8, 2) not null check (odds_at_placement > 1),
  -- Generated rather than written by application code so it can never
  -- drift from stake_amount * odds_at_placement.
  potential_payout numeric(14, 2) generated always as
    (stake_amount * odds_at_placement) stored,
  status public.bet_status not null default 'PENDING',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bets_settled_at_only_when_settled
    check (status = 'PENDING' or settled_at is not null)
);

create index bets_user_id_idx on public.bets (user_id);
create index bets_event_id_idx on public.bets (event_id);
create index bets_market_id_idx on public.bets (market_id);
create index bets_status_idx on public.bets (status);

create trigger bets_set_updated_at
  before update on public.bets
  for each row execute function public.set_updated_at();

alter table public.bets enable row level security;

-- Placement (insert) and settlement (status/settled_at update) are both
-- Phase 2 concerns — placement needs a wallet debit in the same
-- transaction, settlement is an admin-only action extending the existing
-- Results flow. No insert/update policy is added here for authenticated
-- users; until Phase 2's placeBet Server Action lands (via the
-- service-role client, like every other write path in this schema),
-- there is intentionally no way to create a bet row at all. Select-only
-- policies are added now so Phase 2/6 (bet history) have something to
-- build against without a follow-up migration.
create policy "Users can view their own bets"
  on public.bets for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can view all bets"
  on public.bets for select
  to authenticated
  using (public.is_admin());
