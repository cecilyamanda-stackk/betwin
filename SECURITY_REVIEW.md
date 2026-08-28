# Betwin — Phase 5 Security Review

A pass over every RLS policy and every Server Action against section 29,
as called for in the roadmap. Scope: `supabase/migrations/*.sql`,
`src/actions/**`, `src/middleware.ts`, `src/lib/auth/**`,
`src/lib/supabase/**`.

## Fixed during this review

**PII exposure in `profiles.email` (fixed — migration `0006`).**
The only SELECT policy on `profiles` was `using (true)` for any
authenticated user, on every column, including `email`. The app itself
never queries another user's email — every non-admin/non-self read in the
codebase selected only `id, username, display_name` — but RLS is
row-level, not column-level, so nothing stopped a signed-in user from
hitting the Supabase REST API directly with their own session and pulling
every user's email address. Fixed by narrowing the base policy to "own
row, or an admin" and adding a `get_profile_cards()` RPC (SECURITY
DEFINER, explicit safe column list, no email) for the one legitimate
other-users read in the app — the challenge participant list in
`/challenges/[slug]`. **This migration needs to be applied** (`supabase
db push` or paste `0006_phase5_profile_email_privacy.sql` into the SQL
editor) — it isn't retroactive on its own.

**Build-breaking duplicate route (fixed).** `src/app/admin/dashboard/page.tsx`
was a stale Phase 1 stub — the ROADMAP notes it as removed in both Phase 3
and Phase 4, but it shipped again in this zip and collided with
`admin/(console)/dashboard/page.tsx`, failing `next build` outright.
Deleted.

**Missing Suspense boundary (fixed).** `/admin/login` called
`useSearchParams()` (for `?redirectTo=`) without a Suspense boundary,
which fails Next's static-export step. Split the form into its own
component wrapped in `<Suspense>`.

**Outdated Next.js (fixed).** `next@14.2.5` has a known CVE
(nextjs.org/blog/security-update-2025-12-11). Bumped to `14.2.35`, the
latest patched 14.x release — a deliberate choice to stay off Next 15/16,
since this project's App Router usage (`searchParams`/`params` as plain
props, not Promises) is written for Next 14's API shape.

## Confirmed sound, no change needed

- **Every table has RLS enabled**, and every policy follows the same
  shape: public/authenticated read on published or active rows, admin
  (or SUPER_ADMIN, for role changes) write via `is_admin()`.
- **`is_admin()`** is `security definer set search_path = public` — the
  `search_path` is pinned, which avoids the classic search-path-hijack
  hole in SECURITY DEFINER functions.
- **Self-escalation is blocked twice**: at the RLS layer (`profiles`'
  UPDATE policy's `with check` compares the incoming `role` to the
  existing stored value) and at the app layer (`updateUserRole` requires
  SUPER_ADMIN and explicitly rejects `userId === user.id`).
- **Self-suspension is blocked** the same way (`setUserSuspended` rejects
  suspending your own account).
- **Every admin Server Action calls `requireAdmin()` or
  `requireSuperAdmin()` as its first line** — checked across all of
  `src/actions/admin/*.ts`, no exceptions.
- **`createAdminClient()` (service-role key) is marked `server-only`**,
  which breaks the build if it's ever imported into a Client Component —
  and every call site that uses it also writes an `audit_logs` row.
- **`submitPrediction` re-validates event/market/selection state
  server-side** (status, whether the selection belongs to the market,
  whether the market belongs to the event) rather than trusting the
  client-submitted IDs' relationships — closes the obvious IDOR angle on
  predictions.
- **Middleware is explicitly documented as defense-in-depth, not the
  source of truth** — every admin page/action re-checks role
  server-side, so a middleware bug alone can't expose admin data.
- **No `dangerouslySetInnerHTML` anywhere** in the codebase — React's
  default JSX escaping covers stored-XSS risk on user-supplied text
  (notifications, display names, etc.) without needing a sanitizer.
- **`leaderboard_scores` intentionally exposes points + username, never
  which selection someone picked** — the one deliberate "wider than RLS"
  view, and it doesn't touch `email` or any other sensitive column.

## Not fixed — flagged for the developer's decision

**Real secrets in the uploaded project.** `.env.local` (correctly
`.gitignore`d, but present in the zip you uploaded) contains a live
`SUPABASE_SERVICE_ROLE_KEY` and a plaintext admin password. Rotate the
service-role key in Supabase → Project Settings → API, and change that
admin account's password. Nothing in this repo reads `.env.local` values
except at runtime/seed-time — they weren't used for anything here.

**No runtime schema validation on Server Action inputs.** `zod` is a
dependency but unused. Every action does manual checks (`.trim()`,
required-field checks, DB foreign-key/status checks), and TypeScript
covers the app's own callers — but a Server Action is a public HTTP
endpoint; anyone can POST an arbitrary payload to it, bypassing
TypeScript entirely. No exploit was found (every action's manual checks
happen to cover the fields that matter), but there's no length cap on
free-text fields like notification `title`/`body` or display names.
Worth a follow-up pass wrapping each `*Input` interface in a matching
`zod` schema and `.parse()`-ing at the top of each action, since the
dependency is already there.

**Sidebar links to five routes that don't exist**: `/featured`,
`/highlights`, `/how-it-works`, `/faq`, `/contact`. `/live` (linked from
`MobileNav`) is fixed in this phase since it maps to real data (LIVE
events); these five are either content pages with no product copy yet
(How It Works / FAQ / Contact) or need a schema decision the ROADMAP
already flagged as unresolved (`Featured` — "no `featured` flag exists on
events yet"). Left as-is rather than guessed at, but worth tracking so
they don't stay silent 404s.
