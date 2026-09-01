"use client";

import { X, ChevronUp } from "lucide-react";
import { useBetSlip } from "./BetSlipContext";
import { BetSlipPanel } from "./BetSlipPanel";
import { formatKES } from "@/lib/currency";

/** Same footprint as MobileNav (py-2.5 + icon + label), so the strip sits flush above it rather than overlapping or leaving a gap. */
const NAV_HEIGHT = "60px";

function parsedStake(stake: string): number | null {
  const n = Number(stake);
  return stake.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Small-screen bet slip: a yellow strip pinned just above the bottom
 * nav. Left side is always labelled plainly "Odds" — never a specific
 * outcome name like "Draw", because the slip can hold picks from
 * several different matches at once and a single outcome label would be
 * ambiguous. Right side is the possible win. What the numbers mean
 * tracks whatever the panel itself would show right now:
 * - one selection: that leg's own odds / possible win
 * - Accumulator (2+ legs): the combined odds and the combined payout —
 *   the same figures AccumulatorTab computes from the single total
 *   stake, never a per-leg multiplication
 * - Singles (2+ legs): a leg count and the summed possible win across
 *   every leg's own stake
 * Tapping the strip opens the full bet screen (below) to review, adjust
 * stake(s), and place.
 */
export function BetSlipMobileStrip() {
  const { items, mode, accumulatorStake, openMobileSheet, mobileSheetOpen } = useBetSlip();

  if (items.length === 0 || mobileSheetOpen) return null;

  const unplaced = items.filter((i) => i.status !== "placed");
  const allPlaced = unplaced.length === 0;
  const hasUnresolvedOddsChange = items.some((i) => i.pendingOdds !== null);

  let oddsLabelValue: string;
  let winValue: number | null;

  if (items.length === 1) {
    const item = items[0]!;
    const stake = parsedStake(item.singleStake);
    oddsLabelValue = item.odds.toFixed(2);
    winValue = stake !== null && item.pendingOdds === null ? stake * item.odds : null;
  } else if (mode === "accumulator") {
    const combinedOdds = items.reduce((product, i) => product * i.odds, 1);
    const stake = parsedStake(accumulatorStake);
    oddsLabelValue = combinedOdds.toFixed(2);
    winValue = stake !== null && !hasUnresolvedOddsChange ? stake * combinedOdds : null;
  } else {
    oddsLabelValue = `×${items.length}`;
    winValue = items.reduce((sum, i) => {
      const stake = parsedStake(i.singleStake);
      return i.status !== "placed" && i.pendingOdds === null && stake !== null ? sum + stake * i.odds : sum;
    }, 0);
  }

  return (
    <button
      type="button"
      onClick={openMobileSheet}
      aria-label="Open bet slip"
      className="fixed inset-x-0 z-40 flex items-center justify-between gap-3 bg-gold px-4 py-3 text-background shadow-lg lg:hidden"
      style={{ bottom: `calc(${NAV_HEIGHT} + env(safe-area-inset-bottom))` }}
    >
      <span className="flex min-w-0 flex-col items-start text-left">
        <span className="truncate text-xs font-medium opacity-80">Odds</span>
        <span className="font-mono text-lg font-extrabold leading-tight">{allPlaced ? "Placed" : oddsLabelValue}</span>
      </span>

      <span className="flex items-center gap-2 shrink-0">
        <span className="flex flex-col items-end text-right">
          <span className="text-xs font-medium opacity-80">{allPlaced ? "Total won up to" : "Possible win"}</span>
          <span className="font-mono text-lg font-extrabold leading-tight">
            {winValue !== null ? formatKES(winValue) : "—"}
          </span>
        </span>
        <ChevronUp className="h-5 w-5 shrink-0" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * Full-screen bet sheet, opened by tapping the strip. Slides up over
 * everything (including the bottom nav) so reviewing selections,
 * entering stake(s), and placing doesn't compete for space with
 * anything else on a small screen.
 */
export function BetSlipMobileSheet() {
  const { items, mobileSheetOpen, closeMobileSheet } = useBetSlip();

  if (items.length === 0 || !mobileSheetOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bet slip"
      className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-bold text-text-primary">Bet Slip</h2>
        <button type="button" onClick={closeMobileSheet} aria-label="Close bet slip">
          <X className="h-5 w-5 text-text-secondary hover:text-text-primary" />
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {/* No auto-close on success: placed confirmations render right
            here, so closing immediately would just yank them away. The
            user dismisses with the X once they've seen it, or "Place
            more bets" to start over. */}
        <BetSlipPanel />
      </div>
    </div>
  );
}
