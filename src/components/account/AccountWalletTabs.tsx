"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MpesaDepositForm } from "@/components/wallet/MpesaDepositForm";
import { requestWithdrawal, type ManualDepositRequestSummary } from "@/actions/wallet";
import type { MpesaPaymentConfig } from "@/lib/mpesa";
import { formatKES } from "@/lib/currency";

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
  /** Phone numbers that have actually funded a completed deposit — the same set request_withdrawal's closed-loop check allows server-side. */
  withdrawEligiblePhones: string[];
  pendingWithdrawals: PendingWithdrawal[];
}

/**
 * M-Pesa is the only withdrawal option for now, so this takes the phone
 * number directly rather than a "payment method" dropdown — that
 * dropdown was scaffolding for a multi-provider future that doesn't
 * exist yet.
 */
function WithdrawForm({
  withdrawableCash,
  eligiblePhones,
}: {
  withdrawableCash: number;
  eligiblePhones: string[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState(eligiblePhones[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!(parsed > 0)) {
      setMessage({ kind: "error", text: "Enter an amount greater than zero." });
      return;
    }
    if (!mpesaPhone.trim()) {
      setMessage({ kind: "error", text: "Enter the M-Pesa number to send the withdrawal to." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await requestWithdrawal({ amount: parsed, mpesaPhone });
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

  if (eligiblePhones.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-text-secondary">
        No eligible M-Pesa number yet — withdrawals can only go to a number that has funded a
        completed deposit on this account (the closed-loop rule). Make a deposit first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-secondary">Method</span>
        <span className="inline-flex w-fit items-center rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold">
          M-Pesa
        </span>
        <span className="text-xs text-text-secondary">The only payout option for now.</span>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-secondary">M-Pesa number to receive the withdrawal</span>
        <input
          type="tel"
          value={mpesaPhone}
          onChange={(e) => setMpesaPhone(e.target.value)}
          placeholder="07XXXXXXXX"
          list="eligible-mpesa-numbers"
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
        />
        <datalist id="eligible-mpesa-numbers">
          {eligiblePhones.map((phone) => (
            <option key={phone} value={phone} />
          ))}
        </datalist>
        <span className="text-xs text-text-secondary">
          Must match a number that funded a completed deposit: {eligiblePhones.join(", ")}
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-text-secondary">Amount (up to {formatKES(withdrawableCash)} withdrawable)</span>
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
  withdrawEligiblePhones,
  pendingWithdrawals,
}: AccountWalletTabsProps) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Withdrawable</p>
          <p className="font-display text-xl font-bold text-text-primary">{formatKES(withdrawableCash)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Bonus funds</p>
          <p className="font-display text-xl font-bold text-text-primary">{formatKES(bonusFunds)}</p>
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
          <WithdrawForm withdrawableCash={withdrawableCash} eligiblePhones={withdrawEligiblePhones} />
        )}
      </div>

      {pendingWithdrawals.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-sm font-semibold text-text-primary">Pending withdrawals</h2>
          <div className="flex flex-col gap-2">
            {pendingWithdrawals.map((w) => (
              <div key={w.id} className="card flex items-center justify-between p-3 text-sm">
                <span className="text-text-primary">{formatKES(w.amount)}</span>
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
