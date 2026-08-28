"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";
import type { Role } from "@/types/database";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/**
 * Role changes are SUPER_ADMIN-only (an ADMIN promoting themselves or a
 * peer to SUPER_ADMIN would be a privilege-escalation hole). Suspension
 * below stays ADMIN-accessible since it's reversible and lower-stakes.
 */
export async function updateUserRole(userId: string, role: Role): Promise<ActionResult<{ id: string }>> {
  const { user, profile } = await requireSuperAdmin();

  if (userId === user.id) {
    return { error: "You can't change your own role." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "USER_ROLE_CHANGED",
    entityType: "USER",
    entityId: userId,
    metadata: { role, changedBy: profile.username },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { data: { id: userId } };
}

/**
 * Suspends or restores a user. Sets the real Supabase Auth ban (so a
 * suspended user's existing session and future sign-ins are actually
 * blocked, not just cosmetically flagged) and mirrors the state onto
 * profiles.suspended for fast listing.
 */
export async function setUserSuspended(
  userId: string,
  suspended: boolean
): Promise<ActionResult<{ id: string; suspended: boolean }>> {
  const { user } = await requireAdmin();

  if (userId === user.id) {
    return { error: "You can't suspend your own account." };
  }

  const supabase = createAdminClient();

  const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: suspended ? "876000h" : "none", // ~100 years / lift the ban
  });
  if (banError) return { error: banError.message };

  const { error } = await supabase.from("profiles").update({ suspended }).eq("id", userId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: suspended ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
    entityType: "USER",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { data: { id: userId, suspended } };
}
