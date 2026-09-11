-- Bet606 — Phase 1: Foundation
-- Profiles, roles, RLS, and audit logging.
-- Sports/competitions/teams/events/markets/predictions land in Phase 2/3
-- migrations, kept separate so each phase is reviewable on its own.

-- ── Roles ────────────────────────────────────────────────────────────────
create type public.user_role as enum ('USER', 'ADMIN', 'SUPER_ADMIN');

-- ── Profiles ─────────────────────────────────────────────────────────────
-- One row per auth.users row, created automatically by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  email text not null,
  avatar_url text,
  country text,
  role public.user_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_length check (char_length(username) between 3 and 32),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

create index profiles_role_idx on public.profiles (role);

-- Keep updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
-- Username is derived from the email local-part + a short random suffix
-- to avoid collisions; users can change it afterwards from Settings.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user' || base_username;
  end if;
  final_username := left(base_username, 20) || '_' || substr(md5(random()::text), 1, 6);

  insert into public.profiles (id, username, email, display_name)
  values (new.id, final_username, new.email, split_part(new.email, '@', 1));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Audit logs ───────────────────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is the current user an admin? Used by RLS policies across every
-- future table, so it lives here in the foundation migration.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

-- Profiles: anyone signed in can read public profile fields for all users
-- (needed for leaderboards); users can only update their own row and can
-- never set their own role. Admins can read/update every profile.
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile (not role)"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- Audit logs: admin-only, insert-only from the client (writes normally go
-- through the service-role client in lib/supabase/admin.ts, but this policy
-- keeps things safe if that ever changes).
create policy "Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin() and actor_user_id = auth.uid());
