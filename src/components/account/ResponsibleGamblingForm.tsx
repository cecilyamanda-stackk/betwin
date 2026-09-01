"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { setDepositLimit, startSelfExclusion } from "@/actions/responsibleGambling";
import type { DepositLimitPeriod } from "@/types/database";

const PERIODS: { value: DepositLimitPeriod; label: string }[] = [
  { value: "DAILY", label: "per day" },
  { value: "WEEKLY", label: "per week" },
  { value: "MONTHLY", label: "per month" },
];

const EXCLUSION_PRESETS = [
  { label: "24-hour cool-off", days: 1 },
  { label: "7-day cool-off", days: 7 },
  { label: "30 days", days: 30 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
  { label: "Permanent", days: 36500 },
];

interface ResponsibleGamblingFormProps {
  initialDepositLimitAmount: number | null;
  initialDepositLimitPeriod: DepositLimitPeriod | null;
  excludedUntil: string | null;
}

/**
 * Wagering roadmap Phase 6. Two independent sections:
 *
 * Deposit limit — freely adjustable, both directions, immediately (see
 * set_deposit_limit's comment in the Phase 6 migration for the
 * simplification that's worth revisiting once Phase 0 drafts a real
 * policy: a production implementation usually delays *increases*).
 *
 * Self-exclusion / cool-off — one-directional by design. There is no
 * "cancel" button here on purpose: once active, only a compliance
 * override (not built yet — Phase 7 territory) can end it early, so this
 * form doesn't offer a way to undo the confirm dialog's own warning.
 */
export function ResponsibleGamblingForm({
  initialDepositLimitAmount,
  initialDepositLimitPeriod,
  excludedUntil,
}: ResponsibleGamblingFormProps) {
  const router = useRouter();

  const [limitAmount, setLimitAmount] = useState(initialDepositLimitAmount?.toString() ?? "");
  const [limitPeriod, setLimitPeriod] = useState<DepositLimitPeriod>(initialDepositLimitPeriod ?? "WEEKLY");
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const [confirmingDays, setConfirmingDays] = useState<number | null>(null);
  const [exclusionLoading, setExclusionLoading] = useState(false);
  const [exclusionError, setExclusionError] = useState<string | null>(null);

  const isExcluded = excludedUntil !== null && new Date(excludedUntil) > new Date();

  async function handleSaveLimit(e: React.FormEvent) {
    e.preventDefault();
    setLimitLoading(true);
    setLimitMessage(null);
    const amount = limitAmount.trim() === "" ? null : Number(limitAmount);
    const result = await setDepositLimit(amount, amount === null ? null : limitPeriod);
    setLimitLoading(false);
    if (result.error) {
      setLimitMessage(result.error);
      return;
    }
    setLimitMessage("Saved.");
    router.refresh();
  }

  async function handleRemoveLimit() {
    setLimitLoading(true);
    setLimitMessage(null);
    const result = await setDepositLimit(null, null);
    setLimitLoading(false);
    if (result.error) {
      setLimitMessage(result.error);
      return;
    }
    setLimitAmount("");
    setLimitMessage("Limit removed.");
    router.refresh();
  }

  async function handleConfirmExclusion() {
    if (confirmingDays === null) return;
    setExclusionLoading(true);
    setExclusionError(null);
    const result = await startSelfExclusion(confirmingDays);
    setExclusionLoading(false);
    if (result.error) {
      setExclusionError(result.error);
      return;
    }
    setConfirmingDays(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {isExcluded && (
        <div className="card border-live/40 bg-live/10 p-4 text-sm text-live">
          Your account is self-excluded from betting until {new Date(excludedUntil as string).toLocaleString()}.
          Deposits and bets are blocked until then; withdrawals still work.
        </div>
      )}

      <section className="card p-5">
        <h2 className="mb-1 font-display text-sm font-semibold text-text-primary">Deposit limit</h2>
        <p className="mb-4 text-xs text-text-secondary">
          Caps how much you can deposit in a rolling period. Takes effect immediately in both directions.
        </p>
        <form onSubmit={handleSaveLimit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Amount (KES)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              placeholder="No limit"
              className="w-32 rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Period</span>
            <select
              value={limitPeriod}
              onChange={(e) => setLimitPeriod(e.target.value as DepositLimitPeriod)}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={limitLoading} className="btn-primary">
            {limitLoading ? "Saving..." : "Save"}
          </button>
          {initialDepositLimitAmount !== null && (
            <button type="button" onClick={handleRemoveLimit} disabled={limitLoading} className="btn-secondary">
              Remove limit
            </button>
          )}
        </form>
        {limitMessage && <p className="mt-2 text-sm text-text-secondary">{limitMessage}</p>}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-display text-sm font-semibold text-text-primary">Cool-off / self-exclusion</h2>
        <p className="mb-4 text-xs text-text-secondary">
          Blocks deposits and new bets until the date you choose. This can only be extended, never
          shortened or cancelled by you once started.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXCLUSION_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setConfirmingDays(p.days)}
              className="pill hover:border-live/60 hover:text-live"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={confirmingDays !== null}
        title="Confirm self-exclusion"
        description={`This will block deposits and new bets on your account for ${
          confirmingDays === 36500 ? "good" : `${confirmingDays} day${confirmingDays === 1 ? "" : "s"}`
        }. You won't be able to shorten or cancel this yourself once confirmed.`}
        confirmLabel="Confirm"
        danger
        loading={exclusionLoading}
        onConfirm={handleConfirmExclusion}
        onCancel={() => {
          setConfirmingDays(null);
          setExclusionError(null);
        }}
      >
        {exclusionError && (
          <p role="alert" className="mb-3 text-sm text-live">
            {exclusionError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
