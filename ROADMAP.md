# Bet606 — Roadmap

Tracks progress against the phased plan in the product spec (section 48).
Update the checkboxes as each phase lands.

## ✅ Phase 1 — Foundation (done)

- [x] Next.js + TypeScript + Tailwind project, themed to the spec palette
- [x] Supabase project wiring (browser client, server client, service-role
      admin client)
- [x] Auth: register, login, logout, password reset
- [x] `profiles` table, `USER/ADMIN/SUPER_ADMIN` roles, auto-provisioned
      on signup
- [x] Row Level Security + `is_admin()` helper for future tables to reuse
- [x] `audit_logs` table + `writeAuditLog()` helper
- [x] Public shell: Header, Sidebar, Footer, mobile bottom nav
- [x] Admin shell, visually separate, gated by middleware + server-side
      `requireAdmin()`
- [x] Homepage with real (not fake) empty states
- [x] Reusable primitives: `BrandLogo`, `EmptyState`, `LoadingSkeleton`,
      `FormField`
- [x] Sidebar is sticky and scrolls independently of page content
      (`position: sticky` under the header, its own internal scroll)
- [x] Login/Register render as floating modals from the header
      (`Modal`, `AuthModal`, `AuthButtons`), sharing the same
      `LoginForm`/`RegisterForm` used by the standalone `/auth/login` and
      `/auth/register` pages — one source of truth for the auth logic
- [x] Admin seeding script (`npm run seed:admin`) — creates or promotes a
      `SUPER_ADMIN` from env vars, no manual SQL needed

**Files to look at first:** `README.md` for setup, `src/lib/branding.ts` +
`BrandLogo.tsx` for the rebrand seam, `supabase/migrations/0001_phase1_foundation.sql`
for the schema, `scripts/seed-admin.ts` to create your first admin.

---

## ✅ Phase 2 — Sports Management

Goal: give admins everything they need to manually build out the sports
catalogue (section 22–25).

**Database** (new migration `0002_phase2_sports_management.sql`):
- [x] `sports` (id, name, slug, icon, active)
- [x] `competitions` (id, sport_id, name, slug, country, logo_url, active)
- [x] `teams` (id, competition_id, name, short_name, logo_url, country, active)
- [x] `events` (id, competition_id, home_team_id, away_team_id, start_time,
      status, home_score, away_score, published) with the state machine:
      `DRAFT → PUBLISHED → LIVE → SUSPENDED / FINISHED / CANCELLED`
- [x] `markets` (id, event_id, name, type, status) — type examples:
      `MATCH_RESULT`, `CORRECT_SCORE`, `TOTAL_GOALS`, `BOTH_TEAMS_SCORE`
- [x] `market_selections` (id, market_id, name, value, active)
- [x] Indexes from spec section 45 (`events.status`, `events.start_time`,
      `events.competition_id`, etc.)
- [x] RLS: public read on published/active rows, admin-only writes

**Admin UI** (`src/app/admin/sports`, `/competitions`, `/teams`, `/events`,
`/markets`):
- [x] List + create + edit pages for sports, competitions, teams
- [x] Event creation form (section 23) with market/selection builder
- [x] Save Draft / Publish Event actions, each writing an `audit_logs` row
      (`EVENT_CREATED`, `EVENT_PUBLISHED`, etc. — the `AuditAction` type in
      `lib/auth/audit.ts` already has these)
- [x] `AdminSidebar`, `AdminHeader`, `AdminTable`, `AdminForm`,
      `ConfirmDialog` components (section 42)

**Server Actions** (`src/actions/admin/`):
- [x] `createSport`, `createCompetition`, `createTeam`
- [x] `createEvent`, `updateEventStatus`, `createMarket`, `createSelection`
- [x] Every mutation calls `requireAdmin()` first, then `writeAuditLog()`

Once this phase lands, regenerate `src/types/database.ts` from the real
schema instead of hand-editing it. In the meantime it's been hand-edited
to include the `__InternalSupabase` version marker and `Relationships: []`
per table that current `@supabase/supabase-js` typegen expects — omitting
either silently collapses every query result to `never`. `@supabase/ssr`
was also bumped from `^0.4.0` to `^0.12.5`; the pinned 0.4.x was built
against an older `@supabase/supabase-js` typing shape and caused the same
`never` collapse regardless of the `Database` type's own correctness.

**Seeding**: `scripts/seed-games.ts` (`npm run seed:games`) seeds two
sports, two competitions, eight teams, and four demo events — one in each
state (DRAFT, PUBLISHED, LIVE, FINISHED) — each with a Match Result
market and selections. Safe to re-run; sports/competitions/teams are
matched and reused rather than duplicated.

---

## ✅ Phase 3 — User Platform

Goal: let users actually browse and predict (sections 11–19).

**Database** (new migration `0003_phase3_user_platform.sql`):
- [x] `predictions` (user_id, event_id, market_id, selection_id, status,
      points_earned, settled_at) — one row per user/event/market
      (`predictions_one_pick_per_market` unique constraint), doubling as
      "prediction_results": settlement writes `WON/LOST/VOID` +
      `points_earned` straight onto the same row instead of a second
      table, since a prediction and its result are 1:1 and never queried
      independently
- [x] `achievements` (jsonb `criteria`, evaluated in app code) +
      `user_achievements`
- [x] `user_follows` — not in the original table list, added to back the
      leaderboard's "Friends" view with something real (a lightweight
      one-way follow) instead of a fake tab
- [x] `prediction_challenges` + `challenge_entries`
- [x] `leaderboard_scores` view — aggregates WON predictions across users
      without exposing what anyone actually picked; RLS on `predictions`
      itself stays "own rows only"
- [x] RLS on every new table, admin-only writes where relevant

**Components** (`src/components/events`, `leaderboard`, `achievements`,
`challenges`, `social`, `profile`):
- [x] `EventCard`, `LiveEventCard`, `TeamDisplay`, `EventTabs`,
      `MarketPredictionCard` — `EventStatusBadge` (built in Phase 2) is
      reused as-is rather than rebuilt
- [x] `LeaderboardTable`, `CompetitionFilter`, `AchievementBadge`,
      `ChallengeCard` + `ChallengeJoinButton`, `FollowButton`
- [x] Homepage's `EmptyState` blocks replaced with real queries (Live /
      Featured / Popular Competitions / Upcoming / Leaderboard preview) —
      no `featured` flag exists on events yet, so "Featured" stands in
      with the soonest published events rather than fabricating a flag
- [x] Sidebar's "Sports" section (previously stubbed out with a forward
      reference) now lists real active sports

**Pages**:
- [x] `/sports`, `/sports/[sport]`, `/competitions/[competition]`,
      `/events/[event]`
- [x] Event detail page: Overview / Predictions tabs only (section 14) —
      Statistics/Lineups/Timeline are intentionally left out, since no
      stats/lineup/play-by-play schema exists yet; see the comment in
      `EventTabs.tsx`
- [x] Prediction submission (`submitPrediction` Server Action) — one pick
      per user/event/market, changeable until the market closes
- [x] `/predictions`, `/predictions/history`
- [x] `/leaderboard` (Global / Weekly / Monthly / Friends views, optional
      competition filter), current user's row highlighted, inline
      Follow/Unfollow per row
- [x] `achievements` auto-granted after each prediction submission
      (`lib/achievements/evaluate.ts`), `/profile/achievements`
- [x] `/profile`, `/profile/settings`
- [x] Global search (section 30) — `/search` now queries sports,
      competitions, and teams; wired to the `SearchBar` built in Phase 1
- [x] `/challenges`, `/challenges/[slug]` — join/leave + a mini-leaderboard
      per challenge

**Seeding**: `scripts/seed-games.ts` now also seeds 6 achievement
definitions and one demo `ACTIVE` challenge ("Weekend Warmup"), in
addition to the sports/competitions/teams/events it already seeded in
Phase 2. Fully idempotent — safe to re-run.

**Also fixed while in here**: a stale `src/app/admin/dashboard/page.tsx`
left over from before the Phase 2 `(console)` route group duplicated
`/admin/dashboard` and would have failed the Next.js build; removed. A
missing `Relationships: []` on the new `leaderboard_scores` view type
broke structural typing for the *entire* `Database` schema, collapsing
every table's query result to `never` — fixed; `npx tsc --noEmit` is now
clean across the whole project.

**Addendum** (`0004_phase3_register_phone.sql`): register now also
collects a phone number and a confirm-password field, and every password
input across the public site (register, login, reset-password) has a
show/hide eye toggle (`ui/PasswordField.tsx`). Phone is passed through
`signUp`'s `options.data` and picked up by the `handle_new_user()`
trigger into a new nullable `profiles.phone` column — nullable so
existing profiles and admin-created accounts aren't affected; the register
form enforces "required" at the UI layer. The header's Login/Register
buttons are now replaced with the signed-in user's email + a sign-out
button once authenticated, driven by `user.email` already fetched in
`(public)/layout.tsx`.

---

## ✅ Phase 4 — Admin Platform

Goal: full operational control (sections 20–21, 24, 29, 31).

**Database** (new migration `0005_phase4_admin_platform.sql`):
- [x] `profiles.suspended` — fast, RLS-readable flag mirrored alongside a
      real Supabase Auth ban (`auth.admin.updateUserById` with
      `ban_duration`), so a suspended user is actually blocked from
      signing in, not just cosmetically flagged
- [x] `markets.winning_selection_id` + `settle_market()` Postgres
      function — walks every PENDING prediction on a market and marks it
      WON/LOST against the recorded winner
- [x] `platform_settings` (key/value, publicly readable, admin-writable)
      and `system_notifications` tables

- [x] Admin dashboard stat cards (Users / Events / Live) — the
      `AdminDashboardPage` placeholder from Phase 1 gets real queries here,
      plus a "Needs a result" count linking straight to Results
- [x] `/admin/users`, `/admin/users/[id]` — role changes (SUPER_ADMIN
      only, to avoid an ADMIN self-escalating), suspension (writes
      `USER_ROLE_CHANGED`, `USER_SUSPENDED`/`USER_UNSUSPENDED` audit
      entries)
- [x] Manual result entry (`/admin/results`, section 24) — pick the
      winning selection per market; `setMarketResult`/`resettleMarket`
      Server Actions call `settle_market()` and are safe to re-run for
      corrections
- [x] `/admin/predictions` — admin-wide read-only view across every
      user's predictions (the one place picks aren't hidden, for support
      and dispute investigation)
- [x] `/admin/leaderboards` — standings aggregated live from
      `leaderboard_scores`; there's no separate table to "recompute",
      entering a result in Results *is* the recompute
- [x] `/admin/notifications` — compose system announcements
      (storage + authoring only; a public-facing inbox is a later phase)
- [x] `/admin/audit-logs` — searchable/filterable view over the
      `audit_logs` table that's existed since Phase 1
- [x] `/admin/settings` — `maintenance_mode` (wired into `middleware.ts`,
      redirects non-admins to `/maintenance`) and `registration_enabled`
      (checked client-side by `RegisterForm` itself via RLS-readable
      `platform_settings`, so it covers both the standalone register page
      and the header's `AuthModal`)

**Also fixed while in here**: `src/app/admin/dashboard/page.tsx` was a
second, stale copy of the dashboard route left over from before the
`(console)` route group existed — it resolved to the same `/admin/dashboard`
path as `admin/(console)/dashboard/page.tsx` and would have failed the
Next.js build with a duplicate-route error; removed.

---

## ✅ Phase 5 — Polish

- [x] Loading states for every remaining dynamic section — `LoadingSkeleton.tsx`
      grew `TableSkeleton`, `EventCardGridSkeleton`, `StatCardsSkeleton`,
      `ProfileSkeleton`, `ListSkeleton`, `PageHeaderSkeleton`; every route
      segment that was missing a `loading.tsx` (public and admin) now has
      one shaped to match its page, so nothing flashes a blank screen or
      layout-shifts once data arrives.
- [x] Empty/error states for every remaining page — `(public)/error.tsx`,
      `(public)/not-found.tsx`, `admin/(console)/error.tsx`, and a root
      `global-error.tsx` (the one boundary Next requires to render its own
      `<html>/<body>`, for the rare case a root layout itself throws). All
      four are recoverable (a "Try again" that calls `reset()`), never
      leak raw error detail, and keep the site's own look rather than
      Next's default crash screen.
- [x] Full accessibility pass — skip-to-content links + `#main-content`/
      `#admin-main-content` landmarks added to both root layouts. Audited
      the rest against WCAG basics (focus order, labels, contrast): the
      existing codebase already had `:focus-visible` styling, `aria-current`
      on nav links, `aria-hidden` on decorative icons, and properly
      labelled form/password fields since Phase 1–4, so no further changes
      were needed there.
- [x] Supabase Realtime for live scores + leaderboard updates (section 38)
      — added only where it provides real value, per the roadmap's own
      caveat: the event detail page (score/status/market-close updates in
      place), the homepage's Live Now rail, the new `/live` page, and the
      leaderboard (refreshes standings the moment an admin settles a
      market). Implemented as one small hook (`useRealtimeRefresh`) plus
      an invisible `<RealtimeRefresher>` component that calls
      `router.refresh()` on a debounce — no client-side data-fetching
      duplicated from the server components.
- [x] Performance: pagination on all admin tables, image optimization,
      query review against the indexes from section 45 — `lib/utils/pagination.ts`
      + `components/ui/Pagination.tsx` added; wired into `/admin/users`,
      `/admin/events`, `/admin/predictions`, `/admin/audit-logs`, and the
      public `/predictions/history`, replacing their flat `.limit(200)`
      with `.range()` + `count`. No new image usage was added this phase
      (the project still deliberately avoids fabricated crest/avatar
      images — see `TeamDisplay.tsx`), so there was nothing to optimize
      there. Existing indexes from section 45 already cover every query
      pattern these list pages use.
- [x] Security review: re-check every RLS policy and Server Action against
      section 29 — see `SECURITY_REVIEW.md`. Found and fixed a real PII
      gap (`profiles.email` was readable by any authenticated user for any
      other user's row — new migration `0006_phase5_profile_email_privacy.sql`,
      **needs to be applied**, it isn't retroactive), a build-breaking
      stale duplicate route, a missing Suspense boundary that broke static
      export, and bumped `next` off a CVE'd version. Confirmed sound:
      universal RLS coverage, doubled self-escalation/self-suspension
      guards, every admin action gating on `requireAdmin()`/
      `requireSuperAdmin()`, the service-role client's `server-only`
      import, and IDOR-safe validation in `submitPrediction`. Flagged
      (not fixed, needs a product/dev decision): real secrets shipped in
      the uploaded `.env.local` — rotate them — and `zod` being an unused
      dependency despite every Server Action being a public HTTP endpoint.

**Also fixed while in here** (found via `npm run build`, not from a
spec section, but each would have blocked shipping): `src/app/admin/dashboard/page.tsx`
was a stale Phase 1 stub colliding with `admin/(console)/dashboard/page.tsx`
— the ROADMAP already claimed this was deleted twice (Phase 3, Phase 4)
but it was back in this zip; removed for good this time. `/admin/login`'s
`useSearchParams()` had no Suspense boundary, which fails `next build`'s
static-export step; split into an inner form component wrapped in
`<Suspense>`. `next` bumped `14.2.5` → `14.2.35` (patched CVE, same major
version, no App Router API changes). Added a minimal `.eslintrc.json`
(`next/core-web-vitals`) so `npm run lint` runs non-interactively, and
fixed the four pre-existing `react/no-unescaped-entities` errors it
surfaced. `MobileNav` has linked to `/live` since Phase 1 with the route
never existing — added `/live` (every currently-LIVE event, Realtime-backed)
to close that gap; see `SECURITY_REVIEW.md` for the other dead Sidebar
links that were *not* fixed and why.

**Seeding**: `scripts/seed-games.ts` now also seeds a third sport (Tennis
— ATP Tour, four players as `teams` rows so `MATCH_RESULT`-shaped markets
work unmodified) and a second football competition (La Liga), plus a
second concurrent LIVE match — useful for exercising `/live` and the new
Realtime wiring with more than one card on screen at once. New `--bulk`
flag (`npm run seed:games -- --bulk`) additively seeds 30 more PUBLISHED
events across the existing competitions, specifically for exercising this
phase's admin-table pagination without hand-creating dozens of events in
the UI — always additive, safe to run repeatedly for more volume.

---

## Deferred indefinitely (explicitly out of scope until the client decides)

- Real-money deposits, withdrawals, wagering balances
- Age verification / responsible-gambling / licensing flows
- External sports-data provider integration (architecture is ready for it —
  see spec section 39/49 — but nothing calls out to one yet)
