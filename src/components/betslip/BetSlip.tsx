"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { useBetSlip, type BetSlipItem } from "./BetSlipContext";
import { placeBet } from "@/actions/bets";

const QUICK_STAKES = [10, 25, 50, 100];

// TODO: move to platform_settings once Phase 0 settles real limits —
// same placeholder-minimum spirit as elsewhere in the wallet code.
const MIN_STAKE_USD = 1;

function parsedStake(item: BetSlipItem): number | null {
  const n = Number(item.stake);
  return item.stake.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function Row({ item }: { item: BetSlipItem }) {
  const { setStake, removeItem, setItemResult } = useBetSlip();
  const [submitting, setSubmitting] = useState(false);

  const stake = parsedStake(item);
  const payout = stake !== null ? Math.round(stake * item.odds * 100) / 100 : null;
  const belowMin = item.stake.trim() !== "" && (stake === null || stake < MIN_STAKE_USD);

  async function handlePlace() {
    if (stake === null || stake < MIN_STAKE_USD || submitting) return;
    setSubmitting(true);
    setItemResult(item.selectionId, "pending", null);
    const result = await placeBet({
      selectionId: item.selectionId,
      stakeAmount: stake,
      idempotencyKey: item.idempotencyKey,
    });
    setSubmitting(false);
    if (result.error || !result.data) {
      setItemResult(item.selectionId, "error", result.error ?? "Something went wrong.");
      return;
    }
    setItemResult(
      item.selectionId,
      "placed",
      `Placed — ${result.data.oddsAtPlacement.toFixed(2)} odds, up to $${result.data.potentialPayout.toFixed(2)}.`
    );
  }

  const placed = item.status === "placed";

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-text-secondary">{item.marketName}</p>
          <p className="truncate text-sm font-medium text-text-primary">{item.selectionLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gold">{item.odds.toFixed(2)}</span>
          {!placed && (
            <button
              type="button"
              onClick={() => removeItem(item.selectionId)}
              aria-label={`Remove ${item.selectionLabel}`}
              className="text-text-secondary hover:text-live"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {placed ? (
        <p className="text-xs text-success">{item.message}</p>
      ) : (
        <>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={item.stake}
            onChange={(e) => {
              // No text/negative input: strip anything that isn't part
              // of a valid non-negative decimal as it's typed.
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) setStake(item.selectionId, v);
            }}
            placeholder="Stake"
            className="w-full rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-sm text-text-primary focus:border-gold/60"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_STAKES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStake(item.selectionId, String(v))}
                className="pill px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold"
              >
                ${v}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">
              {payout !== null ? `Pays up to $${payout.toFixed(2)}` : `Min stake $${MIN_STAKE_USD}`}
            </span>
            <button
              type="button"
              onClick={handlePlace}
              disabled={stake === null || belowMin || submitting}
              className="btn-primary px-3 py-1.5 text-xs disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? "Placing..." : "Place bet"}
            </button>
          </div>

          {belowMin && <p className="mt-1 text-xs text-live">Minimum stake is ${MIN_STAKE_USD}.</p>}
          {item.status === "error" && item.message && (
            <p role="alert" className="mt-1 text-xs text-live">
              {item.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Wagering roadmap Phase 5: "persistent right-hand panel, per the
 * wireframe." Each line item places independently (its own submit
 * button, own disabled/spinner state) rather than one "place all"
 * action — a failed or still-priced-differently selection shouldn't
 * block the others from going through.
 */
export function BetSlip() {
  const router = useRouter();
  const { items, clear } = useBetSlip();

  if (items.length === 0) {
    return (
      <div className="card sticky top-20 p-4 text-sm text-text-secondary">
        Click an odds button to start a bet slip.
      </div>
    );
  }

  const anyPlaced = items.some((i) => i.status === "placed");

  return (
    <div className="card sticky top-20 flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text-primary">Bet Slip</h3>
        <button
          type="button"
          onClick={() => {
            clear();
            if (anyPlaced) router.refresh(); // picks up the new wallet balance / bet history
          }}
          className="text-xs text-text-secondary hover:text-live"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Row key={item.selectionId} item={item} />
        ))}
      </div>
    </div>
  );
}
