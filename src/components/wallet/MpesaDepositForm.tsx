"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitManualDepositRequest, type ManualDepositRequestSummary } from "@/actions/wallet";
import { isMpesaPaymentConfigured, type MpesaPaymentConfig } from "@/lib/mpesa";

const STATUS_STYLES: Record<ManualDepositRequestSummary["status"], string> = {
  PENDING: "text-gold",
  APPROVED: "text-success",
  REJECTED: "text-live",
};

/**
 * Manual M-Pesa deposit reconciliation. Replaces the old
 * processor-stub deposit form now that this is the platform's actual
 * working deposit path: the client hasn't applied for Daraja API access
 * yet, so an admin manually confirms each payment against the till/
 * paybill instead of a webhook doing it automatically. See
 * submitManualDepositRequest in actions/wallet.ts and
 * resolve_manual_deposit_request in the M-Pesa migration for the rest of
 * the flow.
 *
 * The instructions below genuinely branch on Till vs Paybill (set by an
 * admin in /admin/settings, see PaymentsSettingsForm) rather than
 * reusing one generic "business number" — Till (Buy Goods) is just a
 * number, Paybill needs a business number *and* an account number.
 *
 * Amounts here are shown without a currency symbol on purpose — M-Pesa
 * is KES-denominated, but the rest of this app displays "$" everywhere
 * (currency was one of Phase 0's still-unanswered questions). Asserting
 * KES here while the header/bet slip/etc. assert USD would just be a
 * second, quieter wrong answer instead of one obvious one.
 */
export function MpesaDepositForm({
  config,
  showHistory = false,
  requests = [],
}: {
  config: MpesaPaymentConfig;
  showHistory?: boolean;
  requests?: ManualDepositRequestSummary[];
}) {
  const router = useRouter();
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const configured = isMpesaPaymentConfigured(config);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!(parsedAmount > 0)) {
      setMessage({ kind: "error", text: "Enter the amount you paid." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await submitManualDepositRequest({ mpesaPhone, mpesaCode, amount: parsedAmount });
    setLoading(false);
    if (result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "success", text: "Submitted — an admin will review it shortly." });
    setMpesaPhone("");
    setMpesaCode("");
    setAmount("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {configured ? (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-text-secondary">
          <p className="mb-1 font-medium text-text-primary">Pay via M-Pesa</p>
          {config.method === "TILL" ? (
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Go to M-Pesa → Lipa na M-Pesa → Buy Goods and Services.</li>
              <li>
                Till number: <span className="font-mono text-text-primary">{config.tillNumber}</span>
              </li>
              <li>Enter the amount and complete the payment.</li>
              <li>Enter the confirmation code M-Pesa sends you below.</li>
            </ol>
          ) : (
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Go to M-Pesa → Lipa na M-Pesa → Paybill.</li>
              <li>
                Business number: <span className="font-mono text-text-primary">{config.paybillNumber}</span>
              </li>
              <li>
                Account number: <span className="font-mono text-text-primary">{config.accountNumber}</span>
              </li>
              <li>Enter the amount and complete the payment.</li>
              <li>Enter the confirmation code M-Pesa sends you below.</li>
            </ol>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-text-secondary">
          Deposits aren&apos;t open yet — payment details haven&apos;t been set up. Check back shortly.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={!configured} className="contents">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Phone number the payment was sent from</span>
            <input
              type="tel"
              value={mpesaPhone}
              onChange={(e) => setMpesaPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60 disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">M-Pesa confirmation code</span>
            <input
              type="text"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
              placeholder="e.g. QGH7XXXXXX"
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 font-mono text-text-primary focus:border-gold/60 disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Amount paid</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60 disabled:opacity-50"
            />
          </label>
        </fieldset>

        {message && (
          <p role="alert" className={`text-sm ${message.kind === "error" ? "text-live" : "text-success"}`}>
            {message.text}
          </p>
        )}

        <button type="submit" disabled={loading || !configured} className="btn-primary w-full">
          {loading ? "Submitting..." : "Submit for review"}
        </button>
      </form>

      {showHistory && requests.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Your submissions
          </h3>
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <div key={r.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-text-primary">{r.mpesaCode}</span>
                  <span className={`text-xs font-semibold uppercase ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {r.claimedAmount.toFixed(2)} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
                {r.status === "REJECTED" && r.adminNote && (
                  <p className="mt-1 text-xs text-live">{r.adminNote}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
