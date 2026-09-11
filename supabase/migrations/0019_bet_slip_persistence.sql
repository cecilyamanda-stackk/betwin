-- Bet606 — Bet slip persistence ("just like a shopping cart")
--
-- The bet slip previously lived only in React state — a refresh (or
-- closing the tab) silently threw away every selection. This adds a
-- second, safer place to remember it: one JSON row per signed-in user,
-- not money-moving in any way (it's a list of selections + stakes that
-- haven't been placed yet), so plain RLS-scoped CRUD from the browser
-- client is enough — none of the security-definer/wallet-locking
-- machinery `bets`/`accumulator_bets` need applies here.
--
-- Guests get the same "survives a refresh" behavior from localStorage
-- on the client instead (see BetSlipContext) — this table is purely the
-- signed-in, cross-device half of that.
create table public.bet_slip_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Whole-slip snapshot (mode, items, shared stake, per-item stakes) as
  -- one JSON blob rather than normalized rows: the slip is edited as a
  -- unit from the client and read back as a unit on load, so there's no
  -- benefit to per-item rows here the way there is for `bets` (which
  -- needs to be queried/joined/settled per row).
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger bet_slip_state_set_updated_at
  before update on public.bet_slip_state
  for each row execute function public.set_updated_at();

alter table public.bet_slip_state enable row level security;

create policy "Users can view their own bet slip"
  on public.bet_slip_state for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can save their own bet slip"
  on public.bet_slip_state for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own bet slip"
  on public.bet_slip_state for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can clear their own bet slip"
  on public.bet_slip_state for delete
  to authenticated
  using (user_id = auth.uid());
