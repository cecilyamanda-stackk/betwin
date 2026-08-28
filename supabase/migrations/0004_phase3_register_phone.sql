-- Betwin — Phase 3 addendum: phone number on registration
--
-- RegisterForm now collects a phone number. It's passed through
-- supabase.auth.signUp's `options.data` (raw_user_meta_data) rather than
-- signUp's top-level `phone` field, since that field is for SMS/OTP-based
-- auth identity (a different, unused feature here) — this phone number is
-- just a profile attribute.
--
-- Nullable: existing profiles (and any created without going through the
-- public register form, e.g. scripts/seed-admin.ts) won't have one. The
-- register form enforces "required" at the UI layer instead.

alter table public.profiles add column phone text;

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

  insert into public.profiles (id, username, email, display_name, phone)
  values (
    new.id,
    final_username,
    new.email,
    split_part(new.email, '@', 1),
    new.raw_user_meta_data ->> 'phone'
  );

  return new;
end;
$$;
