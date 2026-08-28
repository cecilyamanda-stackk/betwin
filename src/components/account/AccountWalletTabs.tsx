"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MpesaDepositForm } from "@/components/wallet/MpesaDepositForm";
import { requestWithdrawal, type ManualDepositRequestSummary } from "@/actions/wallet";
import type { MpesaPaymentConfig } from "@/lib/mpesa";

interface DepositPaymentMethod {
  id: string;
  displayLabel: string;
}

interface PendingWithdrawal {
  id: string;
  amount: number; // already abs()'d by the server component for display
  createdAt: string;
}

interface AccountWalletTabsProps {
  withdrawableCash: number;
  bonusFunds: number;
  mpesaConfig: MpesaPaymentConfig;
  manualDepositRequests: ManualDepositRequestSummary[];
  /** Only methods that have actually funded a completed deposit — the same set request_withdrawal's closed-loop check allows server-side. */
  withdrawEligibleMethods: DepositPaymentMethod[];
  pendingWithdrawals: PendingWithdrawal[];
}

function WithdrawForm({
  withdrawableCash,
  eligibleMethods,
}: {
  withdrawableCash: number;
  eligibleMethods: DepositPaymentMethod[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(eligibleMethods[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!(parsed > 0)) {
      setMessage({ kind: "error", text: "Enter an amount greater than zero." });
      return;
    }
    if (!paymentMethodId) {
      setMessage({ kind: "error", text: "Choose a payout method." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await requestWithdrawal({ amount: parsed, paymentMethodId });
    setLoading(false);
    if (result.error || !result.data) {
      setMessage({ kind: "error", text: result.error ?? "Something went wrong." });
      return;
    }
    setMessage({
      kind: "success",
      text: `Requested — pending review, usually resolved within ${result.data.estimatedProcessingHours}h.`,
    });
    setAmount("");
    router.refresh();
  }

  if (eligibleMethods.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-text-secondary">
        No eligible payout method yet — withdrawals can only go to a method that has funded a
        completed deposit on this account (the closed-loop rule).
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-secondary">Payout method</span>
        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
        >
          {eligibleMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayLabel}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-secondary">Amount (up to ${withdrawableCash.toFixed(2)} withdrawable)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
        />
      </label>

      {message && (
        <p role="alert" className={`text-sm ${message.kind === "error" ? "text-live" : "text-success"}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Requesting..." : "Request withdrawal"}
      </button>
    </form>
  );
}

/** Wagering roadmap Phase 6: Wallet sidebar item's Deposit/Withdraw tabs. */
export function AccountWalletTabs({
  withdrawableCash,
  bonusFunds,
  mpesaConfig,
  manualDepositRequests,
  withdrawEligibleMethods,
  pendingWithdrawals,
}: AccountWalletTabsProps) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Withdrawable</p>
          <p className="font-display text-xl font-bold text-text-primary">${withdrawableCash.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Bonus funds</p>
          <p className="font-display text-xl font-bold text-text-primary">${bonusFunds.toFixed(2)}</p>
        </div>
      </div>

      <div className="card p-5">
        <div role="tablist" aria-label="Wallet" className="mb-4 flex gap-1 border-b border-border">
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? "border-b-2 border-gold text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "deposit" ? (
          <MpesaDepositForm config={mpesaConfig} showHistory requests={manualDepositRequests} />
        ) : (
          <WithdrawForm withdrawableCash={withdrawableCash} eligibleMethods={withdrawEligibleMethods} />
        )}
      </div>

      {pendingWithdrawals.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-sm font-semibold text-text-primary">Pending withdrawals</h2>
          <div className="flex flex-col gap-2">
            {pendingWithdrawals.map((w) => (
              <div key={w.id} className="card flex items-center justify-between p-3 text-sm">
                <span className="text-text-primary">${w.amount.toFixed(2)}</span>
                <span className="text-xs text-text-secondary">
                  Requested {new Date(w.createdAt).toLocaleDateString()} · Pending review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
