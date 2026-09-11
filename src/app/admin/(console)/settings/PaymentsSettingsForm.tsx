"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMpesaPaymentConfig } from "@/actions/admin/settings";
import type { MpesaPaymentConfig, MpesaPaymentMethod } from "@/lib/mpesa";

/**
 * Admin settings > Payments. Till and Paybill drive genuinely different
 * user-facing instructions (see MpesaDepositForm), not just a different
 * label on the same field — that's why this is its own method switch
 * with its own fields, not one generic "business number" input.
 */
export function PaymentsSettingsForm({ initialConfig }: { initialConfig: MpesaPaymentConfig }) {
  const router = useRouter();
  const [method, setMethod] = useState<MpesaPaymentMethod>(initialConfig.method);
  const [tillNumber, setTillNumber] = useState(initialConfig.tillNumber ?? "");
  const [paybillNumber, setPaybillNumber] = useState(initialConfig.paybillNumber ?? "");
  const [accountNumber, setAccountNumber] = useState(initialConfig.accountNumber ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const result = await updateMpesaPaymentConfig({
      method,
      tillNumber,
      paybillNumber,
      accountNumber,
    });
    setLoading(false);
    if (result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "success", text: "Saved — deposit instructions updated for every user." });
    router.refresh();
  }

  return (
    <div className="card max-w-xl p-6">
      <h2 className="mb-1 font-display text-lg font-bold">Payments</h2>
      <p className="mb-5 text-sm text-text-secondary">
        Controls the M-Pesa instructions shown on the deposit form (header and{" "}
        <code className="text-xs">/account/wallet</code>). There&apos;s no Daraja API access yet, so
        this only changes what users are told to do, not anything automated.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex gap-2" role="radiogroup" aria-label="M-Pesa method">
          {(["PAYBILL", "TILL"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                method === m
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-text-secondary hover:border-gold/60 hover:text-text-primary"
              }`}
            >
              {m === "PAYBILL" ? "Paybill" : "Till (Buy Goods)"}
            </button>
          ))}
        </div>

        {method === "TILL" ? (
          <label className="flex max-w-xs flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Till number</span>
            <input
              type="text"
              value={tillNumber}
              onChange={(e) => setTillNumber(e.target.value)}
              placeholder="e.g. 123456"
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-text-primary focus:border-gold/60"
            />
            <span className="text-xs text-text-secondary">
              Till (Buy Goods) payments don&apos;t need an account number — the payer just enters this
              number and the amount.
            </span>
          </label>
        ) : (
          <div className="flex flex-wrap gap-4">
            <label className="flex max-w-xs flex-col gap-1.5 text-sm">
              <span className="text-text-secondary">Paybill (business) number</span>
              <input
                type="text"
                value={paybillNumber}
                onChange={(e) => setPaybillNumber(e.target.value)}
                placeholder="e.g. 400200"
                className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-text-primary focus:border-gold/60"
              />
            </label>
            <label className="flex max-w-xs flex-col gap-1.5 text-sm">
              <span className="text-text-secondary">Account number</span>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. BET606"
                className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-text-primary focus:border-gold/60"
              />
              <span className="text-xs text-text-secondary">
                Shown to every user as the account number to enter — a fixed value, not something
                per-user (an M-Pesa Paybill payment can&apos;t be reliably matched to a user any other
                way than the confirmation code they forward on the Wallet page).
              </span>
            </label>
          </div>
        )}

        {message && (
          <p role="alert" className={`text-sm ${message.kind === "error" ? "text-live" : "text-success"}`}>
            {message.text}
          </p>
        )}

        <div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Save payment settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
