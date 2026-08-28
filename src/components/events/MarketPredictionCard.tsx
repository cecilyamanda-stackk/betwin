"use client";

import { useState, useTransition } from "react";
import { submitPrediction } from "@/actions/predictions";
import type { MarketStatus } from "@/types/database";

interface Selection {
  id: string;
  name: string;
  value: string | null;
  active: boolean;
}

interface MarketPredictionCardProps {
  eventId: string;
  marketId: string;
  marketName: string;
  marketStatus: MarketStatus;
  selections: Selection[];
  currentSelectionId: string | null;
  canPredict: boolean;
}

/** One market's selection pills + submit-on-click prediction (section 15/16). */
export function MarketPredictionCard({
  eventId,
  marketId,
  marketName,
  marketStatus,
  selections,
  currentSelectionId,
  canPredict,
}: MarketPredictionCardProps) {
  const [picked, setPicked] = useState(currentSelectionId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = !canPredict || marketStatus !== "OPEN" || isPending;

  function handlePick(selectionId: string) {
    if (disabled || selectionId === picked) return;
    setError(null);
    startTransition(async () => {
      const result = await submitPrediction({ eventId, marketId, selectionId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPicked(selectionId);
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-text-primary">{marketName}</h3>
        {marketStatus !== "OPEN" && (
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">{marketStatus}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {selections
          .filter((s) => s.active)
          .map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={disabled}
              onClick={() => handlePick(s.id)}
              className={`pill disabled:pointer-events-none disabled:opacity-50 ${picked === s.id ? "pill-selected" : ""}`}
            >
              {s.name}
            </button>
          ))}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-live">
          {error}
        </p>
      )}
      {!canPredict && !error && (
        <p className="mt-2 text-xs text-text-secondary">Sign in to submit a prediction.</p>
      )}
      {picked && !error && <p className="mt-2 text-xs text-success">Your pick is saved.</p>}
    </div>
  );
}
