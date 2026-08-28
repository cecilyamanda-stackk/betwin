-- Betwin — Phase 2: Sports Management
-- Sports catalogue: sports, competitions, teams, events, markets, and
-- market selections, plus the indexes/RLS admins and the public site need.
-- Predictions (Phase 3) reference markets/market_selections but are
-- created in their own migration so each phase stays independently
-- reviewable.

-- ── Enums ────────────────────────────────────────────────────────────────
-- Event state machine (section 23): DRAFT -> PUBLISHED -> LIVE ->
-- SUSPENDED / FINISHED / CANCELLED. SUSPENDED can return to LIVE.
create type public.event_status as enum (
  'DRAFT', 'PUBLISHED', 'LIVE', 'SUSPENDED', 'FINISHED', 'CANCELLED'
);

-- Market type is intentionally open-ended (OTHER) so admins aren't blocked
-- waiting on a migration every time a new market shape is needed.
create type public.market_type as enum (
  'MATCH_RESULT', 'CORRECT_SCORE', 'TOTAL_GOALS', 'BOTH_TEAMS_SCORE', 'OTHER'
);

create type public.market_status as enum ('OPEN', 'SUSPENDED', 'SETTLED');

-- ── Sports ───────────────────────────────────────────────────────────────
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sports_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create trigger sports_set_updated_at
  before update on public.sports
  for each row execute function public.set_updated_at();

-- ── Competitions ─────────────────────────────────────────────────────────
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  name text not null,
  slug text not null unique,
  country text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint competitions_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index competitions_sport_id_idx on public.competitions (sport_id);

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function public.set_updated_at();

-- ── Teams ────────────────────────────────────────────────────────────────
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  name text not null,
  short_name text,
  logo_url text,
  country text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_competition_id_idx on public.teams (competition_id);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ── Events ───────────────────────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  start_time timestamptz not null,
  status public.event_status not null default 'DRAFT',
  home_score integer,
  away_score integer,
  -- Convenience flag derived from status so RLS/queries don't need to
  -- enumerate "everything except DRAFT" by hand. status stays the single
  -- source of truth for the state machine.
  published boolean generated always as (status <> 'DRAFT') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_distinct_teams check (home_team_id <> away_team_id)
);

create index events_status_idx on public.events (status);
create index events_start_time_idx on public.events (start_time);
create index events_competition_id_idx on public.events (competition_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ── Markets ──────────────────────────────────────────────────────────────
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  type public.market_type not null default 'OTHER',
  status public.market_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index markets_event_id_idx on public.markets (event_id);

create trigger markets_set_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

-- ── Market selections ────────────────────────────────────────────────────
create table public.market_selections (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  name text not null,
  value text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index market_selections_market_id_idx on public.market_selections (market_id);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.sports enable row level security;
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.events enable row level security;
alter table public.markets enable row level security;
alter table public.market_selections enable row level security;

-- Public read: active/published rows only. Admins read everything
-- (including drafts/inactive rows) so the admin UI has one query shape
-- regardless of role. All writes are admin-only; in practice writes go
-- through the service-role client (lib/supabase/admin.ts), but these
-- policies are defense-in-depth if that ever changes (same pattern as
-- audit_logs in the Phase 1 migration).

create policy "Sports are viewable by everyone"
  on public.sports for select
  using (active or public.is_admin());

create policy "Admins can write sports"
  on public.sports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Competitions are viewable by everyone"
  on public.competitions for select
  using (active or public.is_admin());

create policy "Admins can write competitions"
  on public.competitions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Teams are viewable by everyone"
  on public.teams for select
  using (active or public.is_admin());

create policy "Admins can write teams"
  on public.teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Published events are viewable by everyone"
  on public.events for select
  using (published or public.is_admin());

create policy "Admins can write events"
  on public.events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Markets on published events are viewable by everyone"
  on public.markets for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = markets.event_id and e.published
    )
  );

create policy "Admins can write markets"
  on public.markets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Selections on published events are viewable by everyone"
  on public.market_selections for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.markets m
      join public.events e on e.id = m.event_id
      where m.id = market_selections.market_id and e.published
    )
  );

create policy "Admins can write market selections"
  on public.market_selections for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
