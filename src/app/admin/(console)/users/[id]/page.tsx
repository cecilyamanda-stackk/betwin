import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { UserDetailManager } from "./UserDetailManager";

/**
 * /admin/users/[id] (section 20/29): role changes and suspension, plus a
 * quick read-only view of the user's prediction activity so an admin has
 * context before acting.
 */
export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { profile: currentAdmin } = await requireAdmin();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, email, phone, role, suspended, created_at")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  const [{ count: totalPredictions }, { count: wonPredictions }] = await Promise.all([
    supabase.from("predictions").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("status", "WON"),
  ]);

  return (
    <UserDetailManager
      profile={profile}
      totalPredictions={totalPredictions ?? 0}
      wonPredictions={wonPredictions ?? 0}
      isSuperAdmin={currentAdmin.role === "SUPER_ADMIN"}
      isSelf={currentAdmin.id === profile.id}
    />
  );
}
