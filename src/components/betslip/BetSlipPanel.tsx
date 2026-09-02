"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useBetSlip, MIN_STAKE_KES, type BetSlipItem } from "./BetSlipContext";
import { placeBet, placeAccumulatorBet } from "@/actions/bets";
import { formatKES } from "@/lib/currency";

function parsedStake(stake: string): number | null {
  const n = Number(stake);
  return stake.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/** A live price move on an item already in the slip — must be resolved (accept/remove) before anything it's part of can be placed. */
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

/** One selection's row. `stakeControl` is only rendered in Singles mode — Accumulator mode has no per-row input, the match/market/odds are shown purely for identification. */
function Row({ item, stakeControl }: { item: BetSlipItem; stakeControl?: React.ReactNode }) {
  const { removeItem } = useBetSlip();
  const placed = item.status === "placed";

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-text-secondary">{item.eventLabel}</p>
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

      {placed && item.message && <p className="mt-2 text-xs text-success">{item.message}</p>}
      {!placed && item.status === "error" && item.message && (
        <p role="alert" className="mt-1.5 text-xs text-live">
          {item.message}
        </p>
      )}

      {stakeControl}
    </div>
  );
}

/** Accumulator tab: every leg listed for identification only, one combined stake, combined odds, one Place Bet button. Maps directly to the mandated "Input Stake = Total Aggregate Stake" rule — nothing here multiplies the typed number by the leg count. */
function AccumulatorTab() {
  const { items, accumulatorStake, setAccumulatorStake, accumulatorStatus, accumulatorMessage, setAccumulatorResult, clear } = useBetSlip();
  const [submitting, setSubmitting] = useState(false);

  const stake = parsedStake(accumulatorStake);
  const belowMin = accumulatorStake.trim() !== "" && (stake === null || stake < MIN_STAKE_KES);
  const hasUnresolvedOddsChange = items.some((i) => i.pendingOdds !== null);
  const combinedOdds = items.reduce((product, i) => product * i.odds, 1);
  const finalPayout = stake !== null && !hasUnresolvedOddsChange ? Math.round(stake * combinedOdds * 100) / 100 : null;
  const placed = accumulatorStatus === "placed";

  async function handlePlace() {
    if (stake === null || stake < MIN_STAKE_KES || hasUnresolvedOddsChange || submitting) return;
    setSubmitting(true);
    setAccumulatorResult("pending", null);
    // One idempotency key per placement attempt of the combined bet — not
    // per-leg (there's only one debit, one bet row, so only one key makes
    // sense here, unlike Singles where each leg is its own placement).
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `acc-${Date.now()}`;
    const result = await placeAccumulatorBet({
      selectionIds: items.map((i) => i.selectionId),
      stakeAmount: stake,
      idempotencyKey,
    });
    if (result.error || !result.data) {
      setAccumulatorResult("error", result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }
    setAccumulatorResult(
      "placed",
      `Placed — total odds ${result.data.totalOdds.toFixed(2)}, up to ${formatKES(result.data.potentialPayout)}.`
    );
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Row key={item.selectionId} item={item} />
        ))}
      </div>

      {placed ? (
        <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{accumulatorMessage}</p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Combined Total Odds</span>
            <span className="font-mono text-lg font-bold text-text-primary">{combinedOdds.toFixed(2)}</span>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Enter Total Stake (KES)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={accumulatorStake}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setAccumulatorStake(v);
              }}
              placeholder={`Min ${MIN_STAKE_KES}`}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {[10, 50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAccumulatorStake(String(v))}
                className="pill px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold"
              >
                {v}
              </button>
            ))}
          </div>

          {belowMin && <p className="text-xs text-live">Minimum stake is KES {MIN_STAKE_KES}.</p>}

          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total deduction from wallet</span>
            <span className="font-mono font-semibold text-text-primary">{stake !== null ? formatKES(stake) : "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total possible winnings</span>
            <span className="font-mono text-lg font-bold text-gold">{finalPayout !== null ? formatKES(finalPayout) : "—"}</span>
          </div>

          <p className="text-xs text-text-secondary">
            One combined bet — every leg has to win for it to pay out. If any leg loses, the whole
            stake is lost; there&apos;s no partial return on the others.
          </p>

          {accumulatorStatus === "error" && accumulatorMessage && (
            <p role="alert" className="text-xs text-live">
              {accumulatorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handlePlace}
            disabled={stake === null || belowMin || hasUnresolvedOddsChange || submitting || items.length < 2}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Placing..." : `Place Bet — ${stake !== null ? formatKES(stake) : ""}`}
          </button>
        </div>
      )}

      <button type="button" onClick={clear} className="text-center text-xs text-text-secondary hover:text-live">
        {placed ? "Place more bets" : "Clear all"}
      </button>
    </div>
  );
}

/** Singles tab: no shared input anywhere — each row gets its own explicit "Stake for this match" field, so what leaves the wallet per selection (and in total) is never ambiguous. */
function SinglesTab() {
  const { items, setSingleStake, setItemResult, clear } = useBetSlip();
  const [submitting, setSubmitting] = useState(false);

  const parsedStakes = items.map((i) => ({ item: i, stake: parsedStake(i.singleStake) }));
  const unplacedCount = items.filter((i) => i.status !== "placed").length;
  const hasUnresolvedOddsChange = items.some((i) => i.pendingOdds !== null);
  const anyBelowMin = parsedStakes.some(
    ({ item, stake }) => item.status !== "placed" && item.singleStake.trim() !== "" && (stake === null || stake < MIN_STAKE_KES)
  );
  const readyToPlace = parsedStakes.every(({ item, stake }) => item.status === "placed" || (stake !== null && stake >= MIN_STAKE_KES));
  const totalStake = parsedStakes.reduce((sum, { item, stake }) => (item.status !== "placed" && stake !== null ? sum + stake : sum), 0);
  const totalPossibleWin = parsedStakes.reduce(
    (sum, { item, stake }) => (item.status !== "placed" && item.pendingOdds === null && stake !== null ? sum + stake * item.odds : sum),
    0
  );
  const allPlaced = items.length > 0 && items.every((i) => i.status === "placed");

  async function handlePlaceAll() {
    if (!readyToPlace || hasUnresolvedOddsChange || submitting) return;
    setSubmitting(true);
    // Sequential, not Promise.all: each call debits the same wallet, so
    // running them one at a time avoids racing two placements against
    // the same balance check.
    for (const item of items) {
      if (item.status === "placed") continue;
      const stake = parsedStake(item.singleStake);
      if (stake === null) continue;
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
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Row
            key={item.selectionId}
            item={item}
            stakeControl={
              item.status === "placed" ? undefined : (
                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="text-text-secondary">Stake for this match (KES)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={item.singleStake}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) setSingleStake(item.selectionId, v);
                    }}
                    placeholder={`Min ${MIN_STAKE_KES}`}
                    className="rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-text-primary focus:border-gold/60"
                  />
                  {item.pendingOdds === null && parsedStake(item.singleStake) !== null && (
                    <span className="text-text-secondary">
                      Pays up to {formatKES(Math.round(parsedStake(item.singleStake)! * item.odds * 100) / 100)}
                    </span>
                  )}
                </label>
              )
            }
          />
        ))}
      </div>

      {!allPlaced && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {anyBelowMin && <p className="text-xs text-live">Minimum stake is KES {MIN_STAKE_KES} per match.</p>}

          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total stake ({unplacedCount} selection{unplacedCount === 1 ? "" : "s"})</span>
            <span className="font-mono font-semibold text-text-primary">{formatKES(totalStake)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total possible win</span>
            <span className="font-mono text-lg font-bold text-gold">{formatKES(totalPossibleWin)}</span>
          </div>

          <p className="text-xs text-text-secondary">
            Each selection is placed as its own bet — they win or lose independently of each other.
          </p>

          <button
            type="button"
            onClick={handlePlaceAll}
            disabled={!readyToPlace || hasUnresolvedOddsChange || submitting}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Placing..." : `Place Bets — Total Stake ${formatKES(totalStake)}`}
          </button>
        </div>
      )}

      <button type="button" onClick={clear} className="text-center text-xs text-text-secondary hover:text-live">
        {allPlaced ? "Place more bets" : "Clear all"}
      </button>
    </div>
  );
}

/** Exactly one selection: no tabs (nothing to combine), just the plain single-bet form. */
function SingleItemForm({ item }: { item: BetSlipItem }) {
  const { setSingleStake, setItemResult, removeItem, clear } = useBetSlip();
  const [submitting, setSubmitting] = useState(false);

  const stake = parsedStake(item.singleStake);
  const belowMin = item.singleStake.trim() !== "" && (stake === null || stake < MIN_STAKE_KES);
  const hasUnresolvedOddsChange = item.pendingOdds !== null;
  const possibleWin = stake !== null && !hasUnresolvedOddsChange ? Math.round(stake * item.odds * 100) / 100 : null;
  const placed = item.status === "placed";

  async function handlePlace() {
    if (stake === null || stake < MIN_STAKE_KES || hasUnresolvedOddsChange || submitting) return;
    setSubmitting(true);
    setItemResult(item.selectionId, "pending", null);
    const result = await placeBet({ selectionId: item.selectionId, stakeAmount: stake, idempotencyKey: item.idempotencyKey });
    if (result.error || !result.data) {
      setItemResult(item.selectionId, "error", result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }
    setItemResult(
      item.selectionId,
      "placed",
      `Placed — ${result.data.oddsAtPlacement.toFixed(2)} odds, up to ${formatKES(result.data.potentialPayout)}.`
    );
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs text-text-secondary">{item.eventLabel}</p>
            <p className="truncate text-sm text-text-secondary">{item.marketName}</p>
            <p className="truncate text-sm font-semibold text-text-primary">{item.selectionLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-base font-bold text-gold">{item.odds.toFixed(2)}</span>
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
      </div>

      {item.pendingOdds !== null && <OddsChangeBanner item={item} />}

      {placed ? (
        <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{item.message}</p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Stake (KES)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={item.singleStake}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setSingleStake(item.selectionId, v);
              }}
              placeholder={`Min ${MIN_STAKE_KES}`}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {[10, 50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSingleStake(item.selectionId, String(v))}
                className="pill px-2 py-0.5 text-xs hover:border-gold/60 hover:text-gold"
              >
                {v}
              </button>
            ))}
          </div>

          {belowMin && <p className="text-xs text-live">Minimum stake is KES {MIN_STAKE_KES}.</p>}

          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Possible win</span>
            <span className="font-mono text-lg font-bold text-gold">{possibleWin !== null ? formatKES(possibleWin) : "—"}</span>
          </div>

          {item.status === "error" && item.message && (
            <p role="alert" className="text-xs text-live">
              {item.message}
            </p>
          )}

          <button
            type="button"
            onClick={handlePlace}
            disabled={stake === null || belowMin || hasUnresolvedOddsChange || submitting}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Placing..." : `Place Bet — ${stake !== null ? formatKES(stake) : ""}`}
          </button>
        </>
      )}

      <button type="button" onClick={clear} className="text-center text-xs text-text-secondary hover:text-live">
        {placed ? "Place another bet" : "Clear selection"}
      </button>
    </div>
  );
}

const TABS: { id: "accumulator" | "singles"; label: string }[] = [
  { id: "accumulator", label: "Accumulator" },
  { id: "singles", label: "Singles" },
];

/**
 * The bet-building form. Shared by BetSlipDesktopPanel (always-expanded
 * right-hand panel) and the mobile full bet screen opened from the
 * yellow strip, so the two surfaces never drift out of sync on
 * behavior. Three shapes depending on the slip:
 * - Empty: a prompt to go pick something.
 * - Exactly one selection: a plain single-bet form, no tabs.
 * - Two or more: Accumulator (default) vs Singles tabs — see AccumulatorTab / SinglesTab.
 */
export function BetSlipPanel() {
  const { items, mode, setMode } = useBetSlip();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
        <p className="text-sm font-medium text-text-primary">No bets selected</p>
        <p className="text-xs text-text-secondary">Tap any odds button to add a bet — from as many matches as you like.</p>
      </div>
    );
  }

  if (items.length === 1) {
    return <SingleItemForm item={items[0]!} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Bet type" className="flex gap-1 rounded-md border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === t.id ? "bg-gold text-background" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "accumulator" ? <AccumulatorTab /> : <SinglesTab />}
    </div>
  );
}
