import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { NotificationsManager } from "./NotificationsManager";

/**
 * /admin/notifications (section 31): compose system-wide announcements.
 * Storage-only for now — see the comment on system_notifications in the
 * Phase 4 migration for what a public-facing inbox would add later.
 */
export default async function AdminNotificationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("system_notifications")
    .select("id, title, body, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(50);

  const authorIds = [...new Set((notifications ?? []).map((n) => n.created_by).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", authorIds)
    : { data: [] };
  const authorNameById = new Map((authors ?? []).map((a) => [a.id, a.username]));

  return (
    <NotificationsManager
      notifications={(notifications ?? []).map((n) => ({
        ...n,
        authorUsername: n.created_by ? authorNameById.get(n.created_by) ?? "—" : "—",
      }))}
    />
  );
}
