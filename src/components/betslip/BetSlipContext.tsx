"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface BetSlipItem {
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  odds: number;
  /** Kept as a string so the input can hold "", "12.", etc. mid-typing. */
  stake: string;
  status: "idle" | "pending" | "placed" | "error";
  message: string | null;
  /** Generated once per item and reused on retry — see placeBet's docs. */
  idempotencyKey: string;
}

interface BetSlipContextValue {
  items: BetSlipItem[];
  /** Adds the selection, or removes it if it's already the pick for that market (click-to-deselect). */
  toggleSelection: (input: { marketId: string; marketName: string; selectionId: string; selectionLabel: string; odds: number }) => void;
  setStake: (selectionId: string, stake: string) => void;
  removeItem: (selectionId: string) => void;
  clear: () => void;
  setItemResult: (selectionId: string, status: BetSlipItem["status"], message: string | null) => void;
  isSelected: (marketId: string, selectionId: string) => boolean;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

function newIdempotencyKey(): string {
  // crypto.randomUUID is available in every browser this app targets;
  // Math.random fallback only guards very old/unusual environments.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Wagering roadmap Phase 5. One entry per *market* — picking a
 * different outcome within the same market (e.g. switching from Home to
 * Draw) replaces the existing entry rather than adding a second one,
 * matching how a normal sportsbook slip behaves. Multiple markets can
 * each contribute one entry at the same time.
 */
export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BetSlipItem[]>([]);

  const toggleSelection = useCallback<BetSlipContextValue["toggleSelection"]>((input) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.marketId === input.marketId);
      if (existing?.selectionId === input.selectionId) {
        return prev.filter((i) => i.marketId !== input.marketId);
      }
      const withoutMarket = prev.filter((i) => i.marketId !== input.marketId);
      return [
        ...withoutMarket,
        {
          ...input,
          stake: existing?.stake ?? "",
          status: "idle",
          message: null,
          idempotencyKey: newIdempotencyKey(),
        },
      ];
    });
  }, []);

  const setStake = useCallback((selectionId: string, stake: string) => {
    setItems((prev) => prev.map((i) => (i.selectionId === selectionId ? { ...i, stake, status: "idle", message: null } : i)));
  }, []);

  const removeItem = useCallback((selectionId: string) => {
    setItems((prev) => prev.filter((i) => i.selectionId !== selectionId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const setItemResult = useCallback((selectionId: string, status: BetSlipItem["status"], message: string | null) => {
    setItems((prev) => prev.map((i) => (i.selectionId === selectionId ? { ...i, status, message } : i)));
  }, []);

  const isSelected = useCallback(
    (marketId: string, selectionId: string) => items.some((i) => i.marketId === marketId && i.selectionId === selectionId),
    [items]
  );

  const value = useMemo(
    () => ({ items, toggleSelection, setStake, removeItem, clear, setItemResult, isSelected }),
    [items, toggleSelection, setStake, removeItem, clear, setItemResult, isSelected]
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip(): BetSlipContextValue {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within a BetSlipProvider");
  return ctx;
}
