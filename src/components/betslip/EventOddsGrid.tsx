"use client";

import { useBetSlip } from "./BetSlipContext";
import type { MarketType, SelectionOutcomeCode } from "@/types/database";

interface Selection {
  id: string;
  name: string;
  value: string | null;
  active: boolean;
  current_odds: number | null;
  outcome_code: SelectionOutcomeCode | null;
}

interface Market {
  id: string;
  name: string;
  type: MarketType;
  status: string;
  line_value: number | null;
  selections: Selection[];
}

/**
 * Wagering roadmap Phase 5: "each event shows its markets as clickable
 * odds buttons (e.g. Home 1.85 / Draw 3.40 / Away 4.20 for 1X2), not
 * just a single 'predict' action like the current UI." One row per
 * wagering market; clicking a priced, active selection's odds button
 * adds/replaces that market's pick in the bet slip via BetSlipContext.
 */
export function EventOddsGrid({ markets, canBet }: { markets: Market[]; canBet: boolean }) {
  const { toggleSelection, isSelected } = useBetSlip();

  if (markets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {markets.map((market) => (
        <div key={market.id} className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-text-primary">
              {market.name}
              {market.line_value !== null && (
                <span className="ml-1.5 font-mono text-xs font-normal text-text-secondary">
                  {market.line_value}
                </span>
              )}
            </h3>
            {market.status !== "OPEN" && (
              <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">{market.status}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {market.selections
              .filter((s) => s.active)
              .map((s) => {
                const priced = s.current_odds !== null;
                const disabled = !canBet || market.status !== "OPEN" || !priced;
                const selected = isSelected(market.id, s.id);

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      priced &&
                      toggleSelection({
                        marketId: market.id,
                        marketName: market.name,
                        selectionId: s.id,
                        selectionLabel: s.value ? `${s.name} (${s.value})` : s.name,
                        odds: s.current_odds as number,
                      })
                    }
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                      selected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-surface-secondary text-text-primary hover:border-gold/60"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="font-mono font-semibold">{priced ? s.current_odds!.toFixed(2) : "—"}</span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
