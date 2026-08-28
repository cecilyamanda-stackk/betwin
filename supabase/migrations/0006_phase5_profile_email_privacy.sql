-- Phase 5 security review fix: `profiles.email` (real PII) was reachable
-- by ANY authenticated user for ANY other user's row, because the only
-- SELECT policy on `profiles` was `using (true)`. The app itself never
-- queries another user's `email` column — every non-admin/non-self read
-- in the codebase selects only `id, username, display_name` — but RLS is
-- row-level, not column-level, so that policy still let anyone hit the
-- Supabase REST API directly (with their own logged-in session) and pull
-- every user's email address. Nothing in the schema or app logic stopped
-- it; only the fact that the UI never asked for it.
--
-- Fix: narrow the base `profiles` SELECT policy to "own row, or an
-- admin", and add a `public_profile_cards` view carrying only the
-- public-safe fields (no email) for the one legitimate other-users-profile
-- read in the app (the challenge participant list). Admin pages keep
-- reading `profiles` directly — they're covered by the `is_admin()` half
-- of the new policy, so this migration requires no admin-side code
-- changes. `leaderboard_scores` (0003) already avoided this: it's a
-- SECURITY DEFINER-equivalent view that lists only points/username, never
-- email, so it needs no change here.

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;

create policy "Users can view their own profile or admins can view any"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- Public-safe subset for the app's one other-users-profile lookup
-- (challenge participant list). Deliberately excludes email. A plain view
-- inherits the querying role's RLS on its base table by default in
-- Postgres, which would just reintroduce the same restriction we want to
-- lift for these specific columns — so this is owned by a security
-- definer-style function instead of relying on view RLS pass-through.
create or replace function public.get_profile_cards(profile_ids uuid[])
returns table (id uuid, username text, display_name text, avatar_url text, country text)
language sql
security definer set search_path = public
stable
as $$
  select id, username, display_name, avatar_url, country
  from public.profiles
  where id = any(profile_ids);
$$;

grant execute on function public.get_profile_cards(uuid[]) to authenticated, anon;
