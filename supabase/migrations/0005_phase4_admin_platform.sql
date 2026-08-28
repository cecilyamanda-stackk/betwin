-- Betwin — Phase 4: Admin Platform
--
-- Adds what the admin console needs for user management, manual result
-- entry / settlement, system announcements, and site-wide settings.

-- ── Users: suspension ───────────────────────────────────────────────────
-- `suspended` is a fast, RLS-readable flag for listing/filtering in
-- /admin/users. The actual sign-in block is enforced by Supabase Auth's
-- own ban mechanism (auth.admin.updateUserById ban_duration), set by the
-- same Server Action that flips this column — see actions/admin/users.ts.
-- Keeping both means the admin UI never has to call the Auth Admin API
-- just to render a list.
alter table public.profiles add column suspended boolean not null default false;
create index profiles_suspended_idx on public.profiles (suspended);

-- ── Results: winning selection per market ───────────────────────────────
-- Manual result entry (section 24) records which selection won. Settling
-- a market (see below) walks every PENDING prediction on it and marks
-- WON/LOST based on whether it matches this column.
alter table public.markets add column winning_selection_id uuid references public.market_selections (id);

-- Settles every PENDING prediction on a market against its
-- winning_selection_id: WON + points for the matching selection, LOST +
-- zero points for everything else. Re-running it (e.g. after a correction)
-- only touches PENDING rows, so it's safe to call again after
-- update_market_result flips a market back and re-settles it.
--
-- security definer so the admin Server Action (running as the signed-in
-- admin via the service-role client) can call it without needing broader
-- table privileges than RLS would otherwise grant.
create or replace function public.settle_market(
  p_market_id uuid,
  p_winning_selection_id uuid,
  p_points_for_win integer default 10
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.predictions
  set
    status = case when selection_id = p_winning_selection_id then 'WON' else 'LOST' end,
    points_earned = case when selection_id = p_winning_selection_id then p_points_for_win else 0 end,
    settled_at = now()
  where market_id = p_market_id
    and status = 'PENDING';
end;
$$;

-- ── Platform settings ────────────────────────────────────────────────────
-- Small key/value store for /admin/settings. Kept generic (jsonb value)
-- so new settings don't need a migration each time; only the keys the
-- admin UI and middleware actually read need documenting here.
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value) values
  ('maintenance_mode', 'false'::jsonb),
  ('registration_enabled', 'true'::jsonb);

-- ── System notifications ────────────────────────────────────────────────
-- Admin-composed announcements (section 31). Delivery/read-state is out
-- of scope here — this is the authoring + storage half; a notification
-- bell/inbox on the public side can read the same table in a later phase.
create table public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index system_notifications_created_at_idx on public.system_notifications (created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table public.platform_settings enable row level security;
alter table public.system_notifications enable row level security;

-- Settings must be readable by signed-out visitors too (middleware checks
-- maintenance_mode before a session necessarily exists) but only writable
-- by admins.
create policy "Anyone can read platform settings"
  on public.platform_settings for select
  to anon, authenticated
  using (true);

create policy "Admins can update platform settings"
  on public.platform_settings for update
  to authenticated
  using (public.is_admin());

-- Notifications: readable by any signed-in user (future inbox), authored
-- by admins only.
create policy "Authenticated users can read notifications"
  on public.system_notifications for select
  to authenticated
  using (true);

create policy "Admins can create notifications"
  on public.system_notifications for insert
  to authenticated
  with check (public.is_admin());
