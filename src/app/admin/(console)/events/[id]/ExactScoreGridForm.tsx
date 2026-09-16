"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import {
  EXACT_SCORE_GRID_DEFAULTS,
  EXACT_SCORE_OTHER_VALUE,
  EXACT_SCORE_VALUE_PATTERN,
} from "@/lib/markets/wagering";
import { createExactScoreSelections, type ExactScoreLine, type CreatedSelection } from "@/actions/admin/events";

/**
 * Bulk score-grid builder for an Exact Score market (inspired by the
 * standard "correct score" grid bettors expect — a two-column list of
 * scorelines, each with its own odds). Admin only fills in odds for the
 * scores they want to offer; blank rows are skipped. Scores already
 * priced on this market are shown but locked, so re-opening this after
 * adding a few doesn't risk a duplicate/overwrite.
 */
export function ExactScoreGridForm({
  open,
  onClose,
  marketId,
  eventId,
  existingScores,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  marketId: string;
  eventId: string;
  existingScores: string[];
  /** Called with the newly-inserted rows right after a successful save,
   *  so the parent can splice them into its own list immediately instead
   *  of waiting on a page refresh. */
  onCreated: (selections: CreatedSelection[]) => void;
}) {
  const router = useRouter();
  const [odds, setOdds] = useState<Record<string, string>>({});
  const [customScore, setCustomScore] = useState("");
  const [customOdds, setCustomOdds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(existingScores);
  const otherAlreadyPriced = existing.has(EXACT_SCORE_OTHER_VALUE);

  function reset() {
    setOdds({});
    setCustomScore("");
    setCustomOdds("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lines: ExactScoreLine[] = [];
    for (const score of [...EXACT_SCORE_GRID_DEFAULTS, EXACT_SCORE_OTHER_VALUE]) {
      const raw = odds[score]?.trim();
      if (!raw || existing.has(score)) continue;
      const value = Number(raw);
      if (!(value > 1)) {
        setError(`Odds for ${score === EXACT_SCORE_OTHER_VALUE ? "Any other score" : score} must be greater than 1.00.`);
        return;
      }
      lines.push({ score, odds: value });
    }

    const customScoreTrimmed = customScore.trim();
    if (customScoreTrimmed || customOdds.trim()) {
      if (!EXACT_SCORE_VALUE_PATTERN.test(customScoreTrimmed)) {
        setError('Custom score must be "<home>-<away>" (e.g. "5-1").');
        return;
      }
      if (existing.has(customScoreTrimmed)) {
        setError(`${customScoreTrimmed} is already priced on this market.`);
        return;
      }
      const value = Number(customOdds);
      if (!(value > 1)) {
        setError("Odds for the custom score must be greater than 1.00.");
        return;
      }
      lines.push({ score: customScoreTrimmed, odds: value });
    }

    if (lines.length === 0) {
      setError("Enter odds for at least one score.");
      return;
    }

    setLoading(true);
    const result = await createExactScoreSelections({ marketId, eventId, lines });
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Something went wrong saving these scores.");
      return;
    }
    onCreated(result.data.selections);
    reset();
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add score grid" size="lg">
      <h2 className="mb-1 font-display text-lg font-bold text-text-primary">Add score grid</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Enter odds for the scorelines you want to offer. Leave any blank to skip — you can always add more later.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {EXACT_SCORE_GRID_DEFAULTS.map((score) => {
            const locked = existing.has(score);
            return (
              <label
                key={score}
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                  locked ? "border-border/60 bg-surface-secondary/50 text-text-secondary" : "border-border bg-surface-secondary"
                }`}
              >
                <span className="font-mono font-semibold text-text-primary">{score}</span>
                {locked ? (
                  <span className="text-xs text-text-secondary">priced</span>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    placeholder="Odds"
                    value={odds[score] ?? ""}
                    onChange={(e) => setOdds((o) => ({ ...o, [score]: e.target.value }))}
                    className="w-20 rounded border border-border bg-surface px-2 py-1 text-right text-text-primary focus:border-gold/60"
                  />
                )}
              </label>
            );
          })}
        </div>

        <label
          className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
            otherAlreadyPriced ? "border-border/60 bg-surface-secondary/50 text-text-secondary" : "border-gold/40 bg-surface-secondary"
          }`}
        >
          <span className="font-medium text-text-primary">Any other score</span>
          {otherAlreadyPriced ? (
            <span className="text-xs text-text-secondary">priced</span>
          ) : (
            <input
              type="number"
              step="0.01"
              min="1.01"
              placeholder="Odds"
              value={odds[EXACT_SCORE_OTHER_VALUE] ?? ""}
              onChange={(e) => setOdds((o) => ({ ...o, [EXACT_SCORE_OTHER_VALUE]: e.target.value }))}
              className="w-20 rounded border border-border bg-surface px-2 py-1 text-right text-text-primary focus:border-gold/60"
            />
          )}
        </label>

        <div className="flex items-end gap-3 border-t border-border pt-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Custom score (e.g. &quot;5-1&quot;)</span>
            <input
              type="text"
              value={customScore}
              onChange={(e) => setCustomScore(e.target.value)}
              placeholder="5-1"
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>
          <label className="flex w-24 flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Odds</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={customOdds}
              onChange={(e) => setCustomOdds(e.target.value)}
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Add priced scores"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
