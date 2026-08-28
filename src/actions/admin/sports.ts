"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

export interface SportInput {
  name: string;
  slug: string;
  icon?: string;
  active: boolean;
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function createSport(input: SportInput): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sports")
    .insert({
      name: input.name,
      slug: input.slug,
      icon: input.icon || null,
      active: input.active,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SPORT_CREATED",
    entityType: "SPORT",
    entityId: data.id,
    metadata: { name: input.name, slug: input.slug },
  });

  revalidatePath("/admin/sports");
  return { data };
}

export async function updateSport(
  id: string,
  input: SportInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("sports")
    .update({
      name: input.name,
      slug: input.slug,
      icon: input.icon || null,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SPORT_UPDATED",
    entityType: "SPORT",
    entityId: id,
    metadata: { name: input.name, slug: input.slug, active: input.active },
  });

  revalidatePath("/admin/sports");
  return { data: { id } };
}
