"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface NotificationInput {
  title: string;
  body: string;
}

export async function createNotification(
  input: NotificationInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();

  if (!input.title.trim() || !input.body.trim()) {
    return { error: "Title and body are both required." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("system_notifications")
    .insert({ title: input.title.trim(), body: input.body.trim(), created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "NOTIFICATION_SENT",
    entityType: "NOTIFICATION",
    entityId: data.id,
    metadata: { title: input.title.trim() },
  });

  revalidatePath("/admin/notifications");
  return { data };
}
