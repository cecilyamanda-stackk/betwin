"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

export interface CompetitionInput {
  sportId: string;
  name: string;
  slug: string;
  country?: string;
  logoUrl?: string;
  active: boolean;
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function createCompetition(
  input: CompetitionInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("competitions")
    .insert({
      sport_id: input.sportId,
      name: input.name,
      slug: input.slug,
      country: input.country || null,
      logo_url: input.logoUrl || null,
      active: input.active,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "COMPETITION_CREATED",
    entityType: "COMPETITION",
    entityId: data.id,
    metadata: { name: input.name, sportId: input.sportId },
  });

  revalidatePath("/admin/competitions");
  return { data };
}

export async function updateCompetition(
  id: string,
  input: CompetitionInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("competitions")
    .update({
      sport_id: input.sportId,
      name: input.name,
      slug: input.slug,
      country: input.country || null,
      logo_url: input.logoUrl || null,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "COMPETITION_UPDATED",
    entityType: "COMPETITION",
    entityId: id,
    metadata: { name: input.name, active: input.active },
  });

  revalidatePath("/admin/competitions");
  return { data: { id } };
}
