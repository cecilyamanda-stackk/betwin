import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * SERVER-ONLY. The `server-only` import above will break the build if this
 * file is ever imported from a Client Component. Use this exclusively
 * inside Route Handlers / Server Actions that have already verified the
 * caller is an authenticated ADMIN or SUPER_ADMIN (see lib/auth/roles.ts).
 *
 * Every call site that uses this client for a write should also write an
 * audit_logs row (see lib/auth/audit.ts).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
