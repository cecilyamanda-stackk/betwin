import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountWalletTabs } from "@/components/account/AccountWalletTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseMpesaPaymentConfig } from "@/lib/mpesa";

export default async function AccountWalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: walletSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "wallet_enabled")
    .single();
  if (!Boolean(walletSetting?.value ?? false)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <EmptyState title="Wallet isn't enabled on this account yet." />
      </div>
    );
  }

  const [
    { data: wallet },
    { data: methods },
    { data: pendingWithdrawals },
    { data: manualDeposits },
    { data: mpesaSetting },
  ] = await Promise.all([
    supabase.from("wallets").select("withdrawable_cash, bonus_funds").eq("user_id", user.id).single(),
    supabase
      .from("payment_methods")
      .select("id, display_label")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("transactions")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "WITHDRAWAL")
      .eq("status", "PENDING_REVIEW")
      .order("created_at", { ascending: false }),
    supabase
      .from("manual_deposit_requests")
      .select("id, mpesa_code, mpesa_phone, claimed_amount, status, admin_note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("value").eq("key", "mpesa_payment_config").single(),
  ]);

  const mpesaConfig = parseMpesaPaymentConfig(mpesaSetting?.value);

  const depositMethods = (methods ?? []).map((m) => ({ id: m.id, displayLabel: m.display_label }));

  // Closed-loop rule for the dropdown itself (request_withdrawal enforces
  // the same thing server-side regardless — this just avoids offering a
  // method the request would immediately reject).
  let withdrawEligibleMethods = depositMethods;
  if (depositMethods.length > 0) {
    const { data: completedDeposits } = await supabase
      .from("transactions")
      .select("payment_method_id")
      .eq("user_id", user.id)
      .eq("type", "DEPOSIT")
      .eq("status", "COMPLETED")
      .in(
        "payment_method_id",
        depositMethods.map((m) => m.id)
      );
    const eligibleIds = new Set((completedDeposits ?? []).map((t) => t.payment_method_id));
    withdrawEligibleMethods = depositMethods.filter((m) => eligibleIds.has(m.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Wallet</h1>
      <AccountWalletTabs
        withdrawableCash={wallet?.withdrawable_cash ?? 0}
        bonusFunds={wallet?.bonus_funds ?? 0}
        mpesaConfig={mpesaConfig}
        manualDepositRequests={(manualDeposits ?? []).map((r) => ({
          id: r.id,
          mpesaCode: r.mpesa_code,
          mpesaPhone: r.mpesa_phone,
          claimedAmount: r.claimed_amount,
          status: r.status,
          adminNote: r.admin_note,
          createdAt: r.created_at,
        }))}
        withdrawEligibleMethods={withdrawEligibleMethods}
        pendingWithdrawals={(pendingWithdrawals ?? []).map((t) => ({
          id: t.id,
          amount: Math.abs(t.amount),
          createdAt: t.created_at,
        }))}
      />
    </div>
  );
}
