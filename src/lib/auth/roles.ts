import { createClient } from "@/lib/supabase/server";

export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Loads the current user and their profile role from the server.
 * Throws UnauthorizedError if there's no session.
 *
 * Every Server Action and Route Handler under actions/admin/* must call
 * requireAdmin() (below) rather than trusting any role sent from the client.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, username, display_name")
    .eq("id", user.id)
    .single();

  if (error || !profile) throw new UnauthorizedError();

  return { user, profile };
}

/** Throws ForbiddenError unless the caller is ADMIN or SUPER_ADMIN. */
export async function requireAdmin() {
  const { user, profile } = await getCurrentUser();
  if (profile.role !== "ADMIN" && profile.role !== "SUPER_ADMIN") {
    throw new ForbiddenError();
  }
  return { user, profile };
}

/** Throws ForbiddenError unless the caller is SUPER_ADMIN. */
export async function requireSuperAdmin() {
  const { user, profile } = await getCurrentUser();
  if (profile.role !== "SUPER_ADMIN") {
    throw new ForbiddenError();
  }
  return { user, profile };
}
