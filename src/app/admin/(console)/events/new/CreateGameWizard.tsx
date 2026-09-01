"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminForm";
import { Modal } from "@/components/ui/Modal";
import { createEvent, createMarket, createSelection, updateEventStatus } from "@/actions/admin/events";
import {
  MARKET_TEMPLATES,
  LINE_VALUE_MARKET_TYPES,
  OUTCOME_CODES_BY_MARKET_TYPE,
  WAGERING_MARKET_TYPES,
} from "@/lib/markets/wagering";
import type { MarketType, SelectionOutcomeCode } from "@/types/database";

interface Competition {
  id: string;
  name: string;
}
interface Team {
  id: string;
  name: string;
  competition_id: string;
}

interface PendingSelection {
  tempId: string;
  name: string;
  outcomeCode: SelectionOutcomeCode;
  odds: string;
}
interface PendingMarket {
  tempId: string;
  name: string;
  type: MarketType;
  lineValue: string;
  selections: PendingSelection[];
}

const WAGERING_TYPE_LABELS: Record<string, string> = {
  MATCH_WINNER_3WAY: "Match Winner — 1X2 (soccer)",
  MONEYLINE: "Moneyline — 2-way",
  OVER_UNDER: "Over/Under (Totals)",
  HANDICAP: "Handicap / Point Spread",
  BOTH_TEAMS_TO_SCORE: "Both Teams to Score (BTTS)",
  DOUBLE_CHANCE: "Double Chance",
};

function makeTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Custom-market builder used both for "start from scratch" and for
 * adding one extra market on top of a template (e.g. a Handicap line
 * isn't in the standard soccer bundle since it varies match to match).
 * Stays local state until "Add market to game" — nothing is written to
 * the DB until the whole game is submitted in one pass.
 */
function CustomMarketBuilder({ onAdd }: { onAdd: (market: PendingMarket) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MarketType | "">("");
  const [lineValue, setLineValue] = useState("");
  const [selections, setSelections] = useState<PendingSelection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const needsLine = type !== "" && LINE_VALUE_MARKET_TYPES.includes(type);
  const availableCodes = type !== "" ? (OUTCOME_CODES_BY_MARKET_TYPE[type] ?? []) : [];
  const usedCodes = new Set(selections.map((s) => s.outcomeCode));
  const remainingCodes = availableCodes.filter((c) => !usedCodes.has(c.value));

  function handleTypeChange(v: string) {
    setType(v as MarketType);
    setName((prev) => prev || WAGERING_TYPE_LABELS[v] || "");
    setSelections([]);
    setLineValue("");
  }

  function addSelectionRow() {
    if (remainingCodes.length === 0) return;
    const code = remainingCodes[0];
    if (!code) return;
    setSelections((prev) => [...prev, { tempId: makeTempId(), name: code.label, outcomeCode: code.value, odds: "" }]);
  }

  function handleAddMarket() {
    if (!name.trim() || !type) {
      setError("Pick a market type first.");
      return;
    }
    if (needsLine && (lineValue.trim() === "" || Number.isNaN(Number(lineValue)))) {
      setError("This market type needs a line value.");
      return;
    }
    if (selections.length < 2) {
      setError("Add at least two selections.");
      return;
    }
    if (selections.some((s) => !s.odds.trim() || !(Number(s.odds) > 1))) {
      setError("Every selection needs odds greater than 1.00.");
      return;
    }
    onAdd({ tempId: makeTempId(), name: name.trim(), type, lineValue, selections });
    setName("");
    setType("");
    setLineValue("");
    setSelections([]);
    setError(null);
  }

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <p className="mb-3 text-sm font-medium text-text-primary">Add a market</p>
      <div className="flex flex-wrap items-end gap-3">
        <AdminSelect
          label="Market type"
          value={type}
          onChange={handleTypeChange}
          options={WAGERING_MARKET_TYPES.map((t) => ({ value: t, label: WAGERING_TYPE_LABELS[t] ?? t }))}
        />
        {needsLine && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Line</span>
            <input
              type="number"
              step="0.5"
              value={lineValue}
              onChange={(e) => setLineValue(e.target.value)}
              className="w-28 rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>
        )}
      </div>

      {type !== "" && (
        <div className="mt-3 flex flex-col gap-2">
          {selections.map((s) => (
            <div key={s.tempId} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm text-text-primary sm:w-40 sm:flex-none sm:shrink-0">
                {s.name}
              </span>
              <input
                type="number"
                step="0.01"
                min="1.01"
                placeholder="Odds"
                value={s.odds}
                onChange={(e) =>
                  setSelections((prev) => prev.map((x) => (x.tempId === s.tempId ? { ...x, odds: e.target.value } : x)))
                }
                className="w-28 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-sm text-text-primary focus:border-gold/60"
              />
              <button
                type="button"
                onClick={() => setSelections((prev) => prev.filter((x) => x.tempId !== s.tempId))}
                className="text-xs text-text-secondary hover:text-live"
              >
                Remove
              </button>
            </div>
          ))}
          {remainingCodes.length > 0 && remainingCodes[0] && (
            <button type="button" onClick={addSelectionRow} className="w-fit text-xs font-medium text-gold hover:text-gold-hover">
              + Add selection ({remainingCodes[0].label})
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-live">
          {error}
        </p>
      )}

      <button type="button" onClick={handleAddMarket} className="btn-secondary mt-3">
        Add market to game
      </button>
    </div>
  );
}

/**
 * Roadmap Phase 0: "View betting page" used to be a raw `<a href="/events/
 * ...">` — a plain link out of the admin route group and into the public
 * site's own Header/Sidebar/MobileNav/Footer, so clicking it silently
 * swapped the whole app chrome as if the admin were now a logged-in
 * bettor. This replaces it: a modal, rendered from the same
 * competition/team/market data the wizard already has in state, so
 * checking "does this look right" never leaves /admin at all.
 */
function EventPreviewModal({
  open,
  onClose,
  competitionName,
  homeTeamName,
  awayTeamName,
  startTime,
  markets,
}: {
  open: boolean;
  onClose: () => void;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  startTime: string;
  markets: PendingMarket[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Betting page preview">
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
            What bettors will see — not a live page, so no bet can be placed from here
          </p>
          <p className="text-xs text-text-secondary">{competitionName}</p>
          <p className="font-display text-lg font-bold text-text-primary">
            {homeTeamName} vs {awayTeamName}
          </p>
          {startTime && (
            <p className="text-xs text-text-secondary">
              Kickoff {new Date(startTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {markets.map((m) => (
            <div key={m.tempId} className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-semibold text-text-primary">
                {m.name}
                {m.lineValue && <span className="ml-1 font-normal text-text-secondary">({m.lineValue})</span>}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {m.selections.map((s) => (
                  <div key={s.tempId} className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5 text-sm">
                    <span className="truncate text-text-secondary">{s.name}</span>
                    <span className="ml-2 shrink-0 font-mono font-semibold text-gold">
                      {s.odds ? Number(s.odds).toFixed(2) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

interface CreateGameWizardProps {
  competitions: Competition[];
  teams: Team[];
}

export function CreateGameWizard({ competitions, teams }: CreateGameWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [competitionId, setCompetitionId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  const teamsInCompetition = useMemo(() => teams.filter((t) => t.competition_id === competitionId), [teams, competitionId]);
  const competitionName = useMemo(() => competitions.find((c) => c.id === competitionId)?.name ?? "—", [competitions, competitionId]);
  const homeTeamName = useMemo(() => teams.find((t) => t.id === homeTeamId)?.name ?? "—", [teams, homeTeamId]);
  const awayTeamName = useMemo(() => teams.find((t) => t.id === awayTeamId)?.name ?? "—", [teams, awayTeamId]);

  // Step 2
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [pendingMarkets, setPendingMarkets] = useState<PendingMarket[]>([]);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function selectTemplate(key: string) {
    setTemplateKey(key);
    const template = MARKET_TEMPLATES.find((t) => t.key === key);
    setPendingMarkets(
      (template?.markets ?? []).map((m) => ({
        tempId: makeTempId(),
        name: m.name,
        type: m.type,
        lineValue: m.lineValue?.toString() ?? "",
        selections: m.selections.map((s) => ({ tempId: makeTempId(), name: s.name, outcomeCode: s.outcomeCode, odds: "" })),
      }))
    );
  }

  function selectScratch() {
    setTemplateKey("scratch");
    setPendingMarkets([]);
  }

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!competitionId || !homeTeamId || !awayTeamId || !startTime) {
      setStep1Error("Fill in every field.");
      return;
    }
    if (homeTeamId === awayTeamId) {
      setStep1Error("Home and away team must be different.");
      return;
    }
    setStep1Loading(true);
    setStep1Error(null);
    const result = await createEvent({ competitionId, homeTeamId, awayTeamId, startTime: new Date(startTime).toISOString() });
    setStep1Loading(false);
    if (result.error || !result.data) {
      setStep1Error(result.error ?? "Something went wrong.");
      return;
    }
    setEventId(result.data.id);
    setStep(2);
  }

  function updateSelectionOdds(marketTempId: string, selectionTempId: string, odds: string) {
    setPendingMarkets((prev) =>
      prev.map((m) =>
        m.tempId === marketTempId
          ? { ...m, selections: m.selections.map((s) => (s.tempId === selectionTempId ? { ...s, odds } : s)) }
          : m
      )
    );
  }

  function updateMarketLine(marketTempId: string, lineValue: string) {
    setPendingMarkets((prev) => prev.map((m) => (m.tempId === marketTempId ? { ...m, lineValue } : m)));
  }

  function removeMarket(marketTempId: string) {
    setPendingMarkets((prev) => prev.filter((m) => m.tempId !== marketTempId));
  }

  async function handleCreateMarkets() {
    if (!eventId) return;
    if (pendingMarkets.length === 0) {
      setStep2Error("Add at least one market before continuing.");
      return;
    }
    for (const m of pendingMarkets) {
      if (LINE_VALUE_MARKET_TYPES.includes(m.type) && !m.lineValue.trim()) {
        setStep2Error(`"${m.name}" needs a line value.`);
        return;
      }
      if (m.selections.some((s) => !(Number(s.odds) > 1))) {
        setStep2Error(`Every selection in "${m.name}" needs odds greater than 1.00.`);
        return;
      }
    }

    setStep2Loading(true);
    setStep2Error(null);

    for (const m of pendingMarkets) {
      const marketResult = await createMarket({
        eventId,
        name: m.name,
        type: m.type,
        lineValue: m.lineValue.trim() ? Number(m.lineValue) : undefined,
      });
      if (marketResult.error || !marketResult.data) {
        setStep2Loading(false);
        setStep2Error(`Failed to create "${m.name}": ${marketResult.error ?? "unknown error"}`);
        return;
      }
      for (const s of m.selections) {
        const selectionResult = await createSelection({
          marketId: marketResult.data.id,
          eventId,
          name: s.name,
          currentOdds: Number(s.odds),
          outcomeCode: s.outcomeCode,
        });
        if (selectionResult.error) {
          setStep2Loading(false);
          setStep2Error(`Failed to add "${s.name}" to "${m.name}": ${selectionResult.error}`);
          return;
        }
      }
    }

    setStep2Loading(false);
    setStep(3);
  }

  const handlePublish = useCallback(async () => {
    if (!eventId) return;
    setPublishLoading(true);
    setPublishError(null);
    const result = await updateEventStatus(eventId, "PUBLISHED");
    setPublishLoading(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setPublished(true);
    router.refresh();
  }, [eventId, router]);

  // Phase 5 polish: Ctrl/Cmd+Enter publishes from the review step, mirroring
  // the "submit nearest primary action" convention. Scoped tightly — only
  // step 3, not already loading, not already published — so it can't
  // misfire earlier in the wizard where Enter should stay a plain-text
  // input behavior.
  useEffect(() => {
    if (step !== 3 || published || publishLoading) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handlePublish();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, published, publishLoading, handlePublish]);

  function resetWizard() {
    setStep(1);
    setCompetitionId("");
    setHomeTeamId("");
    setAwayTeamId("");
    setStartTime("");
    setEventId(null);
    setTemplateKey(null);
    setPendingMarkets([]);
    setPublished(false);
    setPublishError(null);
  }

  if (competitions.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-text-secondary">
        Add a competition with at least two teams first.
      </p>
    );
  }

  const steps = [
    { n: 1, label: "Match details" },
    { n: 2, label: "Markets & odds" },
    { n: 3, label: "Review & publish" },
  ] as const;

  const currentStep = steps.find((s) => s.n === step);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-secondary sm:hidden">
        Step {step} of {steps.length}
        {currentStep ? `: ${currentStep.label}` : ""}
      </p>
      <div className="hidden items-center gap-2 sm:flex">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step === s.n
                  ? "bg-gold text-background"
                  : step > s.n
                    ? "bg-success/20 text-success"
                    : "border border-border text-text-secondary"
              }`}
            >
              {step > s.n ? <Check className="h-4 w-4" /> : s.n}
            </div>
            <span className={`text-sm ${step === s.n ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="card flex max-w-lg flex-col gap-4 p-6">
          <AdminSelect
            label="Competition"
            value={competitionId}
            onChange={(v) => {
              setCompetitionId(v);
              setHomeTeamId("");
              setAwayTeamId("");
            }}
            options={competitions.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <AdminSelect
            label="Home team"
            value={homeTeamId}
            onChange={setHomeTeamId}
            options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={competitionId ? "Select..." : "Choose a competition first"}
            required
          />
          <AdminSelect
            label="Away team"
            value={awayTeamId}
            onChange={setAwayTeamId}
            options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={competitionId ? "Select..." : "Choose a competition first"}
            required
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-secondary">Kickoff</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
            />
          </label>
          {step1Error && (
            <p role="alert" className="text-sm text-live">
              {step1Error}
            </p>
          )}
          <button type="submit" disabled={step1Loading} className="btn-primary w-fit">
            {step1Loading ? "Creating..." : "Continue to markets"}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          {templateKey === null ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {MARKET_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectTemplate(t.key)}
                  className="card p-4 text-left hover:border-gold/60"
                >
                  <p className="font-display text-sm font-semibold text-text-primary">{t.label}</p>
                  <p className="mt-1 text-xs text-text-secondary">{t.description}</p>
                </button>
              ))}
              <button type="button" onClick={selectScratch} className="card p-4 text-left hover:border-gold/60">
                <p className="font-display text-sm font-semibold text-text-primary">Start from scratch</p>
                <p className="mt-1 text-xs text-text-secondary">Build custom markets one at a time.</p>
              </button>
            </div>
          ) : (
            <>
              {pendingMarkets.map((m) => (
                <div key={m.tempId} className="card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-display text-sm font-semibold text-text-primary">{m.name}</p>
                      <p className="text-xs text-text-secondary">{WAGERING_TYPE_LABELS[m.type] ?? m.type}</p>
                    </div>
                    <button type="button" onClick={() => removeMarket(m.tempId)} className="text-xs text-text-secondary hover:text-live">
                      Remove market
                    </button>
                  </div>

                  {LINE_VALUE_MARKET_TYPES.includes(m.type) && (
                    <label className="mb-3 flex w-32 flex-col gap-1.5 text-sm">
                      <span className="text-text-secondary">Line</span>
                      <input
                        type="number"
                        step="0.5"
                        value={m.lineValue}
                        onChange={(e) => updateMarketLine(m.tempId, e.target.value)}
                        className="rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-text-primary focus:border-gold/60"
                      />
                    </label>
                  )}

                  <div className="flex flex-col gap-2">
                    {m.selections.map((s) => (
                      <div key={s.tempId} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm text-text-primary sm:w-40 sm:flex-none sm:shrink-0">
                          {s.name}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="1.01"
                          placeholder="Odds"
                          value={s.odds}
                          onChange={(e) => updateSelectionOdds(m.tempId, s.tempId, e.target.value)}
                          className="w-28 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-sm text-text-primary focus:border-gold/60"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <CustomMarketBuilder onAdd={(m) => setPendingMarkets((prev) => [...prev, m])} />

              {step2Error && (
                <p role="alert" className="text-sm text-live">
                  {step2Error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setTemplateKey(null)} className="btn-secondary">
                  Change template
                </button>
                <button type="button" onClick={handleCreateMarkets} disabled={step2Loading} className="btn-primary">
                  {step2Loading ? "Creating markets..." : "Create markets & continue"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex max-w-lg flex-col gap-5">
          <div className="card p-5">
            <p className="mb-3 font-display text-sm font-semibold text-text-primary">Ready to publish</p>
            <ul className="flex flex-col gap-1 text-sm text-text-secondary">
              {pendingMarkets.map((m) => (
                <li key={m.tempId}>
                  {m.name} — {m.selections.length} selections priced
                </li>
              ))}
            </ul>
          </div>

          {published ? (
            <div className="card border-success/40 bg-success/10 p-4 text-sm text-success">
              Published — the event is live for betting.
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary">
                  View betting page
                </button>
                <button type="button" onClick={resetWizard} className="btn-secondary">
                  Create another game
                </button>
              </div>
            </div>
          ) : (
            <>
              {publishError && (
                <p role="alert" className="text-sm text-live">
                  {publishError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/events/${eventId}`} className="btn-secondary">
                  Fine-tune on event page first
                </Link>
                <button type="button" onClick={handlePublish} disabled={publishLoading} className="btn-primary">
                  {publishLoading ? "Publishing..." : "Publish event"}
                </button>
                <span className="hidden text-xs text-text-secondary sm:inline">or press Ctrl/Cmd+Enter</span>
              </div>
            </>
          )}
        </div>
      )}

      <EventPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        competitionName={competitionName}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        startTime={startTime}
        markets={pendingMarkets}
      />
    </div>
  );
}
