"use client";

import { useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useBetSlip } from "./BetSlipContext";
import { BetSlip } from "./BetSlip";

/**
 * Shopping-cart-style bet slip needs to persist as someone browses from
 * the homepage's odds board to an individual event's page and back — a
 * panel embedded in one page's layout can't do that. A floating trigger
 * + slide-over drawer, mounted once in (public)/layout.tsx, can.
 */
export function BetSlipDrawer() {
  const { items } = useBetSlip();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open bet slip${items.length > 0 ? ` (${items.length} selections)` : ""}`}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-semibold text-background shadow-lg transition-transform hover:scale-105 md:bottom-6"
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="hidden sm:inline">Bet Slip</span>
        {items.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-gold">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Bet slip"
        >
          <div
            className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-text-primary">Bet Slip</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close bet slip">
                <X className="h-5 w-5 text-text-secondary hover:text-text-primary" />
              </button>
            </div>
            <BetSlip />
          </div>
        </div>
      )}
    </>
  );
}
