/**
 * Seeds (or promotes) a SUPER_ADMIN account.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-now npm run seed:admin
 *
 * Optional:
 *   ADMIN_USERNAME=youradmin npm run seed:admin   (defaults to the email's local-part)
 *
 * Safe to re-run: if the auth user already exists, this just makes sure
 * their profile role is SUPER_ADMIN rather than creating a duplicate.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL to be
 * set (e.g. via .env.local — this script loads that file automatically).
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const usernameInput = process.env.ADMIN_USERNAME;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first."
  );
}
if (!email || !password) {
  fail(
    "Missing ADMIN_EMAIL or ADMIN_PASSWORD. Example:\n\n  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-now npm run seed:admin"
  );
}
if (password!.length < 8) {
  fail("ADMIN_PASSWORD must be at least 8 characters.");
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Does an auth user with this email already exist? admin.listUsers()
  // doesn't filter by email server-side, so page through until we find it
  // or run out of pages — fine for the small user counts this script is
  // meant for (bootstrapping, not bulk ops).
  let existingUserId: string | null = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());
    if (match) {
      existingUserId = match.id;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  let userId = existingUserId;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) fail(`Could not create admin user: ${error?.message}`);
    userId = data.user!.id;
    console.log(`✓ Created auth user ${email}`);
  } else {
    console.log(`✓ Found existing auth user ${email}, promoting to SUPER_ADMIN`);
  }

  // The handle_new_user trigger already inserted a profiles row (with a
  // random username and USER role) for a freshly created user. Update it
  // — and do the same for a pre-existing user — to guarantee SUPER_ADMIN.
  const updates: Record<string, unknown> = { role: "SUPER_ADMIN" };
  if (usernameInput) updates.username = usernameInput;

  const { error: updateError } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (updateError) fail(`Could not set profile role: ${updateError.message}`);

  console.log(`\n✓ ${email} is now SUPER_ADMIN. Sign in at /admin/login.\n`);
}

main();
