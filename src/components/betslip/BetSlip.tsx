"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useBetSlip, type BetSlipItem } from "./BetSlipContext";
import { placeBet } from "@/actions/bets";
import { formatKES } from "@/lib/currency";

// TODO: move to platform_settings once Phase 0 settles real limits —
// same placeholder-minimum spirit as elsewhere in the wallet code.
const MIN_STAKE_KES = 10;

function parsedStake(stake: string): number | null {
  const n = Number(stake);
  return stake.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/** A live price move on an item already in the cart — must be resolved (accept/remove) before it can be placed. */
function OddsChangeBanner({ item }: { item: BetSlipItem }) {
  const { acceptOddsChange, declineOddsChange } = useBetSlip();
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-gold/40 bg-gold/10 p-2 text-xs text-gold">
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Odds changed from {item.odds.toFixed(2)} to {item.pendingOdds?.toFixed(2)}. Accept the new price?
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => acceptOddsChange(item.selectionId)}
          className="rounded-md bg-gold px-2.5 py-1 font-semibold text-background"
        >
          Accept {item.pendingOdds?.toFixed(2)}
        </button>
        <button
          type="button"
          onClick={() => declineOddsChange(item.selectionId)}
          className="rounded-md border border-gold/40 px-2.5 py-1 text-gold"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function Row({ item, stake }: { item: BetSlipItem; stake: number | null }) {
  const { removeItem } = useBetSlip();
  const payout = stake !== null && item.pendingOdds === null ? Math.round(stake * item.odds * 100) / 100 : null;
  const placed = item.status === "placed";

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
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

      {item.pendingOdds !== null && <OddsChangeBanner item={item} />}

      {placed ? (
        <p className="mt-2 text-xs text-success">{item.message}</p>
      ) : (
        <>
          {payout !== null && <p className="mt-1.5 text-xs text-text-secondary">Pays up to {formatKES(payout)}</p>}
          {item.status === "error" && item.message && (
            <p role="alert" className="mt-1.5 text-xs text-live">
              {item.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Shopping-cart bet slip: every item shares one stake, entered once,
 * rather than each having its own input. Clicking "Place Bets" places
 * every unresolved item as its own independent single bet at that same
 * stake — singles, not a combined accumulator (see the note below the
 * total for why that distinction matters and isn't hidden from the
 * user).
 */
export function BetSlip() {
  const { items, sharedStake, setSharedStake, setItemResult, clear } = useBetSlip();
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <div className="p-1 text-sm text-text-secondary">Click an odds button to start a bet slip.</div>
    );
  }

  const stake = parsedStake(sharedStake);
  const belowMin = sharedStake.trim() !== "" && (stake === null || stake < MIN_STAKE_KES);
  const unplacedCount = items.filter((i) => i.status !== "placed").length;
  const hasUnresolvedOddsChange = items.some((i) => i.pendingOdds !== null);
  const totalStake = stake !== null ? stake * unplacedCount : 0;
  const totalPotentialReturn = stake !== null ? items.filter((i) => i.status !== "placed" && i.pendingOdds === null).reduce((sum, i) => sum + stake * i.odds, 0) : 0;
  const allPlaced = items.length > 0 && items.every((i) => i.status === "placed");

  async function handlePlaceAll() {
    if (stake === null || stake < MIN_STAKE_KES || hasUnresolvedOddsChange || submitting) return;
    setSubmitting(true);
    // Sequential, not Promise.all: each call debits the same wallet, so
    // running them one at a time avoids racing two placements against
    // the same balance check.
    for (const item of items) {
      if (item.status === "placed") continue;
      setItemResult(item.selectionId, "pending", null);
      const result = await placeBet({ selectionId: item.selectionId, stakeAmount: stake, idempotencyKey: item.idempotencyKey });
      if (result.error || !result.data) {
        setItemResult(item.selectionId, "error", result.error ?? "Something went wrong.");
        continue; // singles are independent — one failing shouldn't stop the rest from being attempted
      }
      setItemResult(
        item.selectionId,
        "placed",
        `Placed — ${result.data.oddsAtPlacement.toFixed(2)} odds, up to ${formatKES(result.data.potentialPayout)}.`
      );
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text-primary">Bet Slip ({items.length})</h3>
        <button type="button" onClick={clear} className="text-xs text-text-secondary hover:text-live">
          Clear all
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Row key={item.selectionId} item={item} stake={stake} />
        ))}
      </div>

      {!allPlaced && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Stake per selection (KES)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={sharedStake}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setSharedStake(v);
              }}
              placeholder={`Min ${MIN_STAKE_KES}`}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {[50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSharedStake(String(v))}
                className="pill px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold"
              >
                {v}
              </button>
            ))}
          </div>

          {belowMin && <p className="text-xs text-live">Minimum stake is KES {MIN_STAKE_KES}.</p>}

          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total stake ({unplacedCount} selections)</span>
            <span className="font-mono font-semibold text-text-primary">{formatKES(totalStake)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total potential return</span>
            <span className="font-mono font-semibold text-gold">{formatKES(totalPotentialReturn)}</span>
          </div>

          <p className="text-xs text-text-secondary">
            Each selection is placed as its own bet. If your balance runs out partway through, whichever
            ones already went through stay placed — this isn&apos;t a combined accumulator.
          </p>

          <button
            type="button"
            onClick={handlePlaceAll}
            disabled={stake === null || belowMin || hasUnresolvedOddsChange || submitting}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Placing..." : `Place Bets — Total Stake ${stake !== null ? formatKES(totalStake) : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
