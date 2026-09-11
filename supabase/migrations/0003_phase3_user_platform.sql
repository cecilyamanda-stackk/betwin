-- Bet606 — Phase 3: User Platform
-- Predictions, achievements, follows (backs the leaderboard's "Friends"
-- view), and prediction challenges. Settlement (writing WON/LOST/VOID +
-- points_earned) is a Phase 4 admin action — this migration only creates
-- the shape predictions live in; every points_earned/status column here
-- is expected to sit at its default until Phase 4 lands.

-- ── Enums ────────────────────────────────────────────────────────────────
create type public.prediction_status as enum ('PENDING', 'WON', 'LOST', 'VOID');
create type public.challenge_status as enum ('DRAFT', 'ACTIVE', 'CLOSED');

-- ── Predictions ──────────────────────────────────────────────────────────
-- One prediction per user/event/market (a user can predict Match Result
-- AND Total Goals on the same event — those are different markets — but
-- can't submit two different Match Result picks). Users may change their
-- pick up until the market closes, so this is an upsert target, not
-- insert-only.
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  selection_id uuid not null references public.market_selections (id) on delete cascade,
  status public.prediction_status not null default 'PENDING',
  points_earned integer,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint predictions_one_pick_per_market unique (user_id, event_id, market_id),
  constraint predictions_points_only_when_settled
    check (status = 'PENDING' or settled_at is not null)
);

create index predictions_user_id_idx on public.predictions (user_id);
create index predictions_event_id_idx on public.predictions (event_id);
create index predictions_market_id_idx on public.predictions (market_id);
create index predictions_status_idx on public.predictions (status);
create index predictions_settled_at_idx on public.predictions (settled_at);

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- ── Achievements ─────────────────────────────────────────────────────────
-- Reference table of achievement definitions. `criteria` is evaluated in
-- application code right after a prediction is submitted (see
-- lib/achievements/evaluate.ts) — kept as jsonb rather than a rigid set of
-- columns so new achievement types don't need a migration every time.
-- Example: {"type": "prediction_count", "threshold": 5}
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null default '🏆',
  criteria jsonb not null,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),

  constraint user_achievements_unique unique (user_id, achievement_id)
);

create index user_achievements_user_id_idx on public.user_achievements (user_id);
create index user_achievements_achievement_id_idx on public.user_achievements (achievement_id);

-- ── Follows ──────────────────────────────────────────────────────────────
-- Not in the original table list but required to back the leaderboard's
-- "Friends" view (section 19) with something real instead of a fake tab —
-- a lightweight one-way follow rather than a mutual-friend-request system.
create table public.user_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (follower_id, followee_id),
  constraint user_follows_no_self_follow check (follower_id <> followee_id)
);

create index user_follows_followee_idx on public.user_follows (followee_id);

-- ── Prediction challenges ────────────────────────────────────────────────
create table public.prediction_challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.challenge_status not null default 'DRAFT',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prediction_challenges_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint prediction_challenges_time_order check (end_time > start_time)
);

create trigger prediction_challenges_set_updated_at
  before update on public.prediction_challenges
  for each row execute function public.set_updated_at();

create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.prediction_challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  points_earned integer not null default 0,
  joined_at timestamptz not null default now(),

  constraint challenge_entries_unique unique (challenge_id, user_id)
);

create index challenge_entries_challenge_id_idx on public.challenge_entries (challenge_id);
create index challenge_entries_user_id_idx on public.challenge_entries (user_id);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.predictions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_follows enable row level security;
alter table public.prediction_challenges enable row level security;
alter table public.challenge_entries enable row level security;

-- Predictions are private: a user's pick is only visible to themselves
-- and admins. The public leaderboard is served from the
-- `leaderboard_scores` view below, which exposes points/username only —
-- never which selection someone picked.
create policy "Users can view their own predictions"
  on public.predictions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all predictions"
  on public.predictions for select
  to authenticated
  using (public.is_admin());

create policy "Users can submit their own predictions"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can change their own pending predictions"
  on public.predictions for update
  to authenticated
  using (auth.uid() = user_id and status = 'PENDING')
  with check (auth.uid() = user_id and status = 'PENDING');

create policy "Admins can update any prediction"
  on public.predictions for update
  to authenticated
  using (public.is_admin());

-- Achievement definitions are reference data — readable by everyone,
-- writable only through the service-role client (same defense-in-depth
-- pattern as sports/competitions/teams).
create policy "Achievements are viewable by everyone"
  on public.achievements for select
  using (true);

create policy "Admins can write achievements"
  on public.achievements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Earned achievements are public accomplishments (shown on profile pages),
-- same visibility model as profiles.
create policy "User achievements are viewable by authenticated users"
  on public.user_achievements for select
  to authenticated
  using (true);

create policy "Admins can grant achievements"
  on public.user_achievements for insert
  to authenticated
  with check (public.is_admin());

-- Follows: who-follows-whom is not sensitive, and the "Friends"
-- leaderboard needs to read other users' follow lists to build a shared
-- circle in later iterations, so reads are open to any signed-in user.
-- Only the follower can create/remove their own follow rows.
create policy "Follows are viewable by authenticated users"
  on public.user_follows for select
  to authenticated
  using (true);

create policy "Users can follow others"
  on public.user_follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.user_follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- Challenges: public once ACTIVE/CLOSED (DRAFT is admin-only preview),
-- same active/draft pattern as events.
create policy "Non-draft challenges are viewable by everyone"
  on public.prediction_challenges for select
  using (status <> 'DRAFT' or public.is_admin());

create policy "Admins can write challenges"
  on public.prediction_challenges for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Challenge entries: participant lists and running points are shown on
-- the challenge detail page (mini-leaderboard), so reads are open to any
-- signed-in user. Users can only join/leave for themselves; points_earned
-- is only ever written by admin/service-role settlement code.
create policy "Challenge entries are viewable by authenticated users"
  on public.challenge_entries for select
  to authenticated
  using (true);

create policy "Users can join a challenge"
  on public.challenge_entries for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.prediction_challenges c
      where c.id = challenge_entries.challenge_id and c.status = 'ACTIVE'
    )
  );

create policy "Users can leave a challenge they joined"
  on public.challenge_entries for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can update challenge entries"
  on public.challenge_entries for update
  to authenticated
  using (public.is_admin());

-- ── Leaderboard view ─────────────────────────────────────────────────────
-- Deliberately NOT `security_invoker` — this view intentionally bypasses
-- the row-level "own predictions only" policy above to aggregate WON
-- predictions across all users, but only exposes points/profile fields,
-- never the underlying selection someone picked. Points stay null/empty
-- until Phase 4 settlement starts writing WON rows; until then every
-- leaderboard tab shows its honest empty state.
create view public.leaderboard_scores as
select
  p.user_id,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  pr.country,
  p.points_earned,
  p.settled_at,
  e.competition_id
from public.predictions p
join public.profiles pr on pr.id = p.user_id
join public.events e on e.id = p.event_id
where p.status = 'WON';

grant select on public.leaderboard_scores to authenticated, anon;
