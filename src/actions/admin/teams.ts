"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

export interface TeamInput {
  competitionId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  country?: string;
  active: boolean;
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function createTeam(input: TeamInput): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("teams")
    .insert({
      competition_id: input.competitionId,
      name: input.name,
      short_name: input.shortName || null,
      logo_url: input.logoUrl || null,
      country: input.country || null,
      active: input.active,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "TEAM_CREATED",
    entityType: "TEAM",
    entityId: data.id,
    metadata: { name: input.name, competitionId: input.competitionId },
  });

  revalidatePath("/admin/teams");
  return { data };
}

export async function updateTeam(
  id: string,
  input: TeamInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("teams")
    .update({
      competition_id: input.competitionId,
      name: input.name,
      short_name: input.shortName || null,
      logo_url: input.logoUrl || null,
      country: input.country || null,
      active: input.active,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "TEAM_UPDATED",
    entityType: "TEAM",
    entityId: id,
    metadata: { name: input.name, active: input.active },
  });

  revalidatePath("/admin/teams");
  return { data: { id } };
}
