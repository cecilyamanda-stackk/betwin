# Bet606 — Phase 1: Foundation

Working name for the sports prediction platform described in the product spec.
`Bet606` is a placeholder — see [`src/lib/branding.ts`](src/lib/branding.ts) and
[`src/components/layout/BrandLogo.tsx`](src/components/layout/BrandLogo.tsx),
the only two files a future rebrand needs to touch.

## What's in Phase 1

- Next.js 14 App Router + TypeScript + Tailwind, wired to the palette from
  the spec (`tailwind.config.ts`).
- Supabase Auth: register, login, logout (via session, not a page), password
  reset. Login/Register open as floating modals from the header
  (`src/components/auth/AuthModal.tsx`) as well as working as standalone
  pages at `/auth/login` and `/auth/register` — both share the same
  `LoginForm`/`RegisterForm` components.
- Admin seeding script (`npm run seed:admin`) — no manual SQL required to
  create your first `SUPER_ADMIN`.
- `profiles` table with `USER / ADMIN / SUPER_ADMIN` roles, auto-created on
  sign-up via a database trigger.
- Row Level Security on `profiles` and `audit_logs`, plus a reusable
  `is_admin()` SQL helper every future table's policies can call.
- Two independent app shells (Next.js "multiple root layouts" pattern):
  - **Public** (`src/app/(public)`) — Header, sticky Sidebar (independent
    scroll from the main content), Footer, mobile bottom nav, homepage
    with honest empty states (no fake data).
  - **Admin** (`src/app/admin`) — separate shell, gated by
    `middleware.ts` (fast redirect) *and* `requireAdmin()` server-side on
    every page/action (the check that actually matters).
- `audit_logs` table + `writeAuditLog()` helper, ready for Phase 4's admin
  mutations to call.

## Setup

1. Create a Supabase project.
2. Run the migration:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   (or paste `supabase/migrations/0001_phase1_foundation.sql` into the SQL
   editor).
3. Copy `.env.example` to `.env.local` and fill in your project's URL and
   keys from Supabase → Project Settings → API.
4. Seed your first admin:
   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-now npm run seed:admin
   ```
   This creates (or promotes, if it already exists) a confirmed auth user
   and sets their profile `role` to `SUPER_ADMIN` — safe to re-run.
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Public site: `http://localhost:3000`. Admin: `http://localhost:3000/admin/login`.

## What's next

Phase 5 (Polish) just landed — see [`ROADMAP.md`](ROADMAP.md) for what it
added (Realtime, pagination, loading/error states, an accessibility and
security pass).

**Before you deploy or pull latest**, run the new migration:

```bash
supabase db push
```

(or paste `supabase/migrations/0006_phase5_profile_email_privacy.sql` into
the SQL editor). It closes a real gap the Phase 5 security review found —
see [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) for the full write-up —
where any signed-in user could read any other user's email address
directly through the Supabase API. It isn't retroactive on its own.

Also worth doing once, regardless of this phase: the `.env.local` in this
repo's history has a live service-role key and a plaintext admin
password in it. Rotate both in Supabase → Project Settings → API before
this goes anywhere near production.

Want a bigger demo dataset to click around in (more than the ~9 seeded
events)? `npm run seed:games -- --bulk` adds 30 more.
