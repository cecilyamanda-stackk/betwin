"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionStatus } from "@/types/database";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface WalletBalance {
  withdrawableCash: number;
  bonusFunds: number;
  totalBalance: number;
}

/** Feeds the header balance display (Phase 4) and the account Wallet tab (Phase 6). */
export async function getWalletBalance(): Promise<ActionResult<WalletBalance>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("wallets")
    .select("withdrawable_cash, bonus_funds, total_balance")
    .eq("user_id", user.id)
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      withdrawableCash: data.withdrawable_cash,
      bonusFunds: data.bonus_funds,
      totalBalance: data.total_balance,
    },
  };
}

export interface SubmitManualDepositRequestInput {
  mpesaPhone: string;
  mpesaCode: string;
  amount: number;
}

export interface ManualDepositRequestSummary {
  id: string;
  mpesaCode: string;
  mpesaPhone: string;
  claimedAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
}

/**
 * Manual M-Pesa deposit reconciliation stopgap: the client hasn't applied
 * for Daraja API access yet, so there's no automated way to confirm a
 * payment happened (see requestWithdrawal's sibling situation below).
 * The user pays via M-Pesa outside the app and forwards the confirmation
 * code here; an admin who can see it actually landed approves it via
 * resolveManualDepositRequest in actions/admin/wallet.ts, which is what
 * actually credits the wallet. This action only records the claim.
 *
 * Safe to expose directly (no admin gate needed here) because inserting
 * a PENDING claim doesn't move any money by itself — see the RLS policy
 * on manual_deposit_requests, which pins every insert to PENDING and to
 * the submitter's own id.
 */
export async function submitManualDepositRequest(
  input: SubmitManualDepositRequestInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  if (!input.mpesaCode.trim()) return { error: "Enter the M-Pesa confirmation code." };
  if (!input.mpesaPhone.trim()) return { error: "Enter the phone number the payment was sent from." };
  if (!(input.amount > 0)) return { error: "Enter an amount greater than zero." };

  // Self-exclusion blocks new deposits too, not only new bets.
  const { data: rg } = await supabase
    .from("responsible_gambling_settings")
    .select("excluded_until")
    .eq("user_id", user.id)
    .single();
  if (rg?.excluded_until && new Date(rg.excluded_until) > new Date()) {
    return { error: `Your account is self-excluded until ${new Date(rg.excluded_until).toLocaleString()}.` };
  }

  const { data, error } = await supabase
    .from("manual_deposit_requests")
    .insert({
      user_id: user.id,
      mpesa_code: input.mpesaCode.trim(),
      mpesa_phone: input.mpesaPhone.trim(),
      claimed_amount: input.amount,
    })
    .select("id")
    .single();

  if (error) {
    // The unique index on active (mpesa_code) surfaces as a generic
    // Postgres constraint-violation message; give a clearer one instead.
    if (error.code === "23505") {
      return { error: "That M-Pesa code has already been submitted and is pending or approved." };
    }
    return { error: error.message };
  }

  revalidatePath("/account/wallet");
  return { data: { id: data.id } };
}

export interface RequestWithdrawalInput {
  amount: number;
  mpesaPhone: string;
}

export interface RequestWithdrawalResult {
  transactionId: string;
  status: TransactionStatus;
  estimatedProcessingHours: number;
}

/**
 * Unlike placeBet, this is safe to expose directly to an authenticated
 * user rather than needing a payment-processor confirmation step first:
 * it only moves a balance the user already has into escrow (pessimistic
 * — see request_withdrawal in the Phase 3 migration), it never creates
 * new funds. M-Pesa is the only payout option for now, so this takes a
 * phone number directly rather than a stored "payment method" — the
 * closed-loop check (that number must match one that funded a completed
 * deposit) is enforced inside request_withdrawal itself, not just here.
 */
export async function requestWithdrawal(
  input: RequestWithdrawalInput
): Promise<ActionResult<RequestWithdrawalResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  if (!(input.amount > 0)) {
    return { error: "Withdrawal amount must be greater than zero." };
  }
  if (!input.mpesaPhone.trim()) {
    return { error: "Enter the M-Pesa number to send the withdrawal to." };
  }

  const { data, error } = await supabase
    .rpc("request_withdrawal", {
      p_amount: input.amount,
      p_mpesa_phone: input.mpesaPhone.trim(),
    })
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      transactionId: data.transaction_id,
      status: data.status,
      estimatedProcessingHours: data.estimated_processing_hours,
    },
  };
}
