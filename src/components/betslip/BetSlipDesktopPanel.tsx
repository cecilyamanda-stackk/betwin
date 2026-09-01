"use client";

import { BetSlipPanel } from "./BetSlipPanel";

/**
 * Large-screen bet slip: a permanently-expanded panel on the right of
 * the screen, not a floating cart button + drawer. Sticky under the
 * header, its own scroll — mirrors how Sidebar handles the same
 * constraint on the left. Hidden below lg; BetSlipMobileStrip takes over
 * there instead.
 */
export function BetSlipDesktopPanel() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-border bg-background lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]">
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-secondary">Bet Slip</h2>
        <BetSlipPanel />
      </div>
    </aside>
  );
}
