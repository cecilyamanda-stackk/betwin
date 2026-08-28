"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface AdjustWalletBalanceInput {
  userId: string;
  amount: number; // signed: positive credits, negative debits
  bucket: "withdrawable_cash" | "bonus_funds";
  reason: string;
}

/**
 * Phase 7 explicitly anticipates "manual balance adjustments" as an
 * audited admin action; this is that function, wired now because it's
 * also — until Phase 0 picks a payment processor — the only way a
 * wallet gets funded at all (see the Phase 3 migration's scope note).
 * There is no self-serve deposit endpoint; crediting a wallet always
 * goes through here or through a future processor webhook.
 */
export async function adjustWalletBalance(input: AdjustWalletBalanceInput): Promise<ActionResult<{ userId: string }>> {
  const { user } = await requireAdmin();

  if (!input.reason.trim()) {
    return { error: "A reason is required for every balance adjustment." };
  }
  if (!input.amount) {
    return { error: "Amount can't be zero." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("adjust_wallet_balance", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_bucket: input.bucket,
    p_reason: input.reason,
  });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "WALLET_ADJUSTED",
    entityType: "WALLET",
    entityId: input.userId,
    metadata: { amount: input.amount, bucket: input.bucket, reason: input.reason },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  return { data: { userId: input.userId } };
}

/**
 * Approves or rejects a PENDING_REVIEW withdrawal (Phase 7's compliance
 * review step). Rejecting refunds the escrowed amount back to
 * withdrawable_cash inside resolve_withdrawal — this action just gates
 * who can call it and records the audit trail.
 */
export async function resolveWithdrawal(
  transactionId: string,
  approve: boolean
): Promise<ActionResult<{ transactionId: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("resolve_withdrawal", {
    p_transaction_id: transactionId,
    p_approve: approve,
  });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: approve ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
    entityType: "WALLET",
    entityId: transactionId,
    metadata: { transactionId },
  });

  revalidatePath("/admin/transactions");
  return { data: { transactionId } };
}

/**
 * Manual M-Pesa deposit reconciliation (stopgap until Daraja API access
 * exists — see submitManualDepositRequest in actions/wallet.ts). Approving
 * calls resolve_manual_deposit_request, which credits the wallet as a
 * real DEPOSIT transaction (not a generic ADJUSTMENT) tied to an M-Pesa
 * payment method, so a future withdrawal's closed-loop check still works
 * correctly against it.
 */
export async function resolveManualDepositRequest(
  requestId: string,
  approve: boolean,
  note?: string
): Promise<ActionResult<{ requestId: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("resolve_manual_deposit_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_admin_user_id: user.id,
    p_note: note ?? null,
  });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: approve ? "MANUAL_DEPOSIT_APPROVED" : "MANUAL_DEPOSIT_REJECTED",
    entityType: "WALLET",
    entityId: requestId,
    metadata: { requestId, note },
  });

  revalidatePath("/admin/deposits");
  return { data: { requestId } };
}
