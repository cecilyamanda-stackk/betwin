"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DepositLimitPeriod } from "@/types/database";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface ResponsibleGamblingSettings {
  depositLimitAmount: number | null;
  depositLimitPeriod: DepositLimitPeriod | null;
  excludedUntil: string | null;
}

export async function getResponsibleGamblingSettings(): Promise<ActionResult<ResponsibleGamblingSettings>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("responsible_gambling_settings")
    .select("deposit_limit_amount, deposit_limit_period, excluded_until")
    .eq("user_id", user.id)
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      depositLimitAmount: data.deposit_limit_amount,
      depositLimitPeriod: data.deposit_limit_period,
      excludedUntil: data.excluded_until,
    },
  };
}

/** Pass both null to clear an existing limit. */
export async function setDepositLimit(
  amount: number | null,
  period: DepositLimitPeriod | null
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { error } = await supabase.rpc("set_deposit_limit", {
    p_amount: amount,
    p_period: period,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/responsible-gambling");
  return { data: null };
}

/**
 * One-directional (see start_self_exclusion in the Phase 6 migration) —
 * there is deliberately no corresponding "cancel" action here. Ending an
 * exclusion early is a compliance decision, not a self-service one.
 */
export async function startSelfExclusion(days: number): Promise<ActionResult<{ excludedUntil: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data, error } = await supabase.rpc("start_self_exclusion", { p_days: days });
  if (error) return { error: error.message };

  revalidatePath("/account/responsible-gambling");
  return { data: { excludedUntil: data } };
}
