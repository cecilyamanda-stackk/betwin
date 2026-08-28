"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";
import type { MpesaPaymentMethod } from "@/lib/mpesa";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export type PlatformSettingKey = "maintenance_mode" | "registration_enabled" | "wallet_enabled";

export async function updateSetting(
  key: PlatformSettingKey,
  value: boolean
): Promise<ActionResult<{ key: string; value: boolean }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("platform_settings")
    .update({ value, updated_by: user.id })
    .eq("key", key);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SETTINGS_UPDATED",
    entityType: "SETTINGS",
    entityId: key,
    metadata: { value },
  });

  // Settings are read on effectively every page (middleware checks
  // maintenance_mode on every request), so revalidate broadly rather
  // than trying to enumerate every affected path.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { data: { key, value } };
}

export interface MpesaPaymentConfigInput {
  method: MpesaPaymentMethod;
  /** Required (and only meaningful) when method is "TILL". */
  tillNumber?: string;
  /** Required (and only meaningful) when method is "PAYBILL". */
  paybillNumber?: string;
  /** Required (and only meaningful) when method is "PAYBILL". */
  accountNumber?: string;
}

/**
 * Till and Paybill aren't just two labels for the same field — Till
 * (Buy Goods) only needs the till number itself, while Paybill needs a
 * business number *and* a separate account number the payer types in.
 * Validating that difference here (not just in the form) means a
 * crafted request can't save a Paybill config with no account number and
 * silently break the deposit instructions for every user.
 */
export async function updateMpesaPaymentConfig(input: MpesaPaymentConfigInput): Promise<ActionResult<null>> {
  const { user } = await requireAdmin();

  if (input.method === "TILL") {
    if (!input.tillNumber?.trim()) return { error: "Enter a Till number." };
  } else {
    if (!input.paybillNumber?.trim()) return { error: "Enter a Paybill (business) number." };
    if (!input.accountNumber?.trim()) return { error: "Enter the account number payers should use." };
  }

  const value = {
    method: input.method,
    till_number: input.method === "TILL" ? input.tillNumber!.trim() : null,
    paybill_number: input.method === "PAYBILL" ? input.paybillNumber!.trim() : null,
    account_number: input.method === "PAYBILL" ? input.accountNumber!.trim() : null,
  };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ value, updated_by: user.id })
    .eq("key", "mpesa_payment_config");

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SETTINGS_UPDATED",
    entityType: "SETTINGS",
    entityId: "mpesa_payment_config",
    metadata: value,
  });

  // Deposit instructions using this config are shown on the header's
  // Deposit modal and /account/wallet, both outside /admin.
  revalidatePath("/", "layout");
  revalidatePath("/account/wallet");
  revalidatePath("/admin/settings");
  return { data: null };
}
