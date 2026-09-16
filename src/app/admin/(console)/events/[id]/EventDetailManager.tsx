"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff, LayoutGrid } from "lucide-react";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminForm, AdminSelect } from "@/components/admin/AdminForm";
import { FormField } from "@/components/ui/FormField";
import { useAdminBreadcrumbLabel } from "@/components/admin/AdminBreadcrumbContext";
import {
  updateEvent,
  updateEventStatus,
  createMarket,
  createSelection,
  updateSelectionOdds,
  updateMarket,
  deleteMarket,
  deleteSelection,
  toggleSelectionActive,
  type EventInput,
  type MarketInput,
} from "@/actions/admin/events";
import type { EventStatus, MarketType, SelectionOutcomeCode } from "@/types/database";
import {
  LINE_VALUE_MARKET_TYPES,
  OUTCOME_CODES_BY_MARKET_TYPE,
  isWageringMarketType,
  isExactScoreMarketType,
} from "@/lib/markets/wagering";
import { ExactScoreGridForm } from "./ExactScoreGridForm";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

interface EventDetail {
  id: string;
  start_time: string;
  status: EventStatus;
  home_team_id: string;
  away_team_id: string;
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
}

export interface Selection {
  id: string;
  market_id: string;
  name: string;
  value: string | null;
  active: boolean;
  // Phase 1 (wagering roadmap). true_probability is never sent to this
  // client (the DB grants only cover current_odds), so it's typed here
  // but will always come back as undefined/null in practice.
  current_odds: number | null;
  true_probability?: number | null;
  // Phase 2 (wagering roadmap). Only set on the six wagering market
  // types — see lib/markets/wagering.ts.
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

interface Competition {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  competition_id: string;
}

const MARKET_TYPES: { value: MarketType; label: string }[] = [
  { value: "MATCH_RESULT", label: "Match Result (points game)" },
  { value: "CORRECT_SCORE", label: "Correct Score (points game)" },
  { value: "TOTAL_GOALS", label: "Total Goals (points game)" },
  { value: "BOTH_TEAMS_SCORE", label: "Both Teams Score (points game)" },
  { value: "OTHER", label: "Other" },
  // Wagering roadmap Phase 1 — real-money market families.
  { value: "MATCH_WINNER_3WAY", label: "Match Winner — 1X2 (soccer)" },
  { value: "MONEYLINE", label: "Moneyline — 2-way (basketball/tennis)" },
  { value: "OVER_UNDER", label: "Over/Under (Totals)" },
  { value: "HANDICAP", label: "Handicap / Point Spread" },
  { value: "BOTH_TEAMS_TO_SCORE", label: "Both Teams to Score (BTTS)" },
  { value: "DOUBLE_CHANCE", label: "Double Chance (1X / X2 / 12)" },
  { value: "EXACT_SCORE", label: "Exact Score (real-money grid)" },
];

// Market types whose line_value is required (roadmap: "always .5 line
// values so a push is impossible" for Over/Under; favorite/underdog line
// for Handicap). Sourced from lib/markets/wagering so this client
// component and the server action's gate can't drift apart.

// Mirrors ALLOWED_TRANSITIONS in actions/admin/events.ts — this copy only
// decides which buttons to show; the server action is the real gate.
const NEXT_STATUSES: Record<EventStatus, { status: EventStatus; label: string; danger?: boolean }[]> = {
  DRAFT: [
    { status: "PUBLISHED", label: "Publish" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
  PUBLISHED: [
    { status: "LIVE", label: "Go live" },
    { status: "SUSPENDED", label: "Suspend" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
  LIVE: [
    { status: "SUSPENDED", label: "Suspend" },
    { status: "FINISHED", label: "Finish" },
  ],
  SUSPENDED: [
    { status: "LIVE", label: "Resume" },
    { status: "FINISHED", label: "Finish" },
    { status: "CANCELLED", label: "Cancel", danger: true },
  ],
  FINISHED: [],
  CANCELLED: [],
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventDetailManager({
  event,
  markets: initialMarkets,
  competitions,
  teams,
}: {
  event: EventDetail;
  markets: Market[];
  competitions: Competition[];
  teams: Team[];
}) {
  const router = useRouter();

  // Server-fetched markets are held as local state and updated directly
  // from each action's own result (see the handlers below) rather than
  // relying solely on router.refresh() to repaint — that keeps every
  // add/edit/delete/toggle instant regardless of Next's router-cache
  // timing. `initialMarkets` still flows back in here (e.g. once
  // router.refresh()/the realtime refresh below actually lands, or on a
  // fresh navigation) so changes from another admin's session still show.
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  useEffect(() => {
    setMarkets(initialMarkets);
  }, [initialMarkets]);

  useAdminBreadcrumbLabel(event.id, `${event.homeTeamName} vs ${event.awayTeamName}`);

  // Edit-details modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EventInput>({
    competitionId: event.competition_id,
    homeTeamId: event.home_team_id,
    awayTeamId: event.away_team_id,
    startTime: toDatetimeLocal(event.start_time),
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const teamsInCompetition = useMemo(
    () => teams.filter((t) => t.competition_id === editForm.competitionId),
    [teams, editForm.competitionId]
  );

  // Status transition confirm dialog
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Add market modal
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [marketForm, setMarketForm] = useState<Omit<MarketInput, "eventId">>({
    name: "",
    type: "MATCH_RESULT",
    lineValue: undefined,
  });
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const marketNeedsLine = LINE_VALUE_MARKET_TYPES.includes(marketForm.type);

  // Add selection — one small inline form per market at a time
  const [selectionMarketId, setSelectionMarketId] = useState<string | null>(null);
  const [selectionName, setSelectionName] = useState("");
  const [selectionValue, setSelectionValue] = useState("");
  const [selectionOdds, setSelectionOdds] = useState("");
  const [selectionOutcomeCode, setSelectionOutcomeCode] = useState<SelectionOutcomeCode | "">("");
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Adjust odds on an existing selection — one inline form at a time
  const [oddsEditSelectionId, setOddsEditSelectionId] = useState<string | null>(null);
  const [oddsEditValue, setOddsEditValue] = useState("");
  const [oddsEditLoading, setOddsEditLoading] = useState(false);
  const [oddsEditError, setOddsEditError] = useState<string | null>(null);

  // Exact Score bulk grid builder — one market at a time
  const [scoreGridMarketId, setScoreGridMarketId] = useState<string | null>(null);

  // Edit market (rename / change line value)
  const [editMarketTarget, setEditMarketTarget] = useState<Market | null>(null);
  const [editMarketName, setEditMarketName] = useState("");
  const [editMarketLine, setEditMarketLine] = useState("");
  const [editMarketLoading, setEditMarketLoading] = useState(false);
  const [editMarketError, setEditMarketError] = useState<string | null>(null);
  const editMarketNeedsLine = editMarketTarget ? LINE_VALUE_MARKET_TYPES.includes(editMarketTarget.type) : false;

  // Delete market
  const [deleteMarketTarget, setDeleteMarketTarget] = useState<Market | null>(null);
  const [deleteMarketLoading, setDeleteMarketLoading] = useState(false);
  const [deleteMarketError, setDeleteMarketError] = useState<string | null>(null);

  // Delete selection
  const [deleteSelectionTarget, setDeleteSelectionTarget] = useState<{ selection: Selection; marketId: string } | null>(
    null
  );
  const [deleteSelectionLoading, setDeleteSelectionLoading] = useState(false);
  const [deleteSelectionError, setDeleteSelectionError] = useState<string | null>(null);

  // Activate/deactivate a selection — reversible, no confirm needed
  const [toggleActiveLoadingId, setToggleActiveLoadingId] = useState<string | null>(null);

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);
    const result = await updateEvent(event.id, {
      ...editForm,
      startTime: new Date(editForm.startTime).toISOString(),
    });
    setEditLoading(false);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    setStatusLoading(true);
    setStatusError(null);

    const scores =
      pendingStatus === "FINISHED"
        ? { homeScore: Number(homeScore), awayScore: Number(awayScore) }
        : undefined;

    if (pendingStatus === "FINISHED" && (homeScore === "" || awayScore === "")) {
      setStatusLoading(false);
      setStatusError("Enter both scores.");
      return;
    }

    const result = await updateEventStatus(event.id, pendingStatus, scores);
    setStatusLoading(false);
    if (result.error) {
      setStatusError(result.error);
      return;
    }
    setPendingStatus(null);
    setHomeScore("");
    setAwayScore("");
    router.refresh();
  }

  async function handleMarketSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (marketNeedsLine && marketForm.lineValue === undefined) {
      setMarketError("This market type requires a line value.");
      return;
    }
    setMarketLoading(true);
    setMarketError(null);
    const result = await createMarket({ eventId: event.id, ...marketForm });
    setMarketLoading(false);
    if (result.error || !result.data) {
      setMarketError(result.error ?? "Something went wrong creating the market.");
      return;
    }
    setMarketModalOpen(false);
    setMarketForm({ name: "", type: "MATCH_RESULT", lineValue: undefined });
    setMarkets((prev) => [...prev, { ...result.data, selections: [] }]);
    router.refresh();
  }

  async function handleSelectionSubmit(e: React.FormEvent, marketId: string, marketType: MarketType) {
    e.preventDefault();
    if (!selectionName.trim()) {
      setSelectionError("Name is required.");
      return;
    }
    const currentOdds = selectionOdds.trim() === "" ? undefined : Number(selectionOdds);
    if (currentOdds !== undefined && !(currentOdds > 1)) {
      setSelectionError("Odds must be greater than 1.00 (leave blank to price it later).");
      return;
    }
    if (isWageringMarketType(marketType) && !selectionOutcomeCode) {
      setSelectionError("Pick an outcome code so this selection can be settled automatically.");
      return;
    }
    setSelectionLoading(true);
    setSelectionError(null);
    const result = await createSelection({
      marketId,
      eventId: event.id,
      name: selectionName,
      value: selectionValue,
      currentOdds,
      outcomeCode: selectionOutcomeCode || undefined,
    });
    setSelectionLoading(false);
    if (result.error || !result.data) {
      setSelectionError(result.error ?? "Something went wrong creating the selection.");
      return;
    }
    setSelectionMarketId(null);
    setSelectionName("");
    setSelectionValue("");
    setSelectionOdds("");
    setSelectionOutcomeCode("");
    setMarkets((prev) =>
      prev.map((m) => (m.id === marketId ? { ...m, selections: [...m.selections, result.data] } : m))
    );
    router.refresh();
  }

  async function handleOddsEditSubmit(e: React.FormEvent, selection: Selection, marketId: string) {
    e.preventDefault();
    const currentOdds = Number(oddsEditValue);
    if (!(currentOdds > 1)) {
      setOddsEditError("Odds must be greater than 1.00.");
      return;
    }
    setOddsEditLoading(true);
    setOddsEditError(null);
    const result = await updateSelectionOdds({
      selectionId: selection.id,
      marketId,
      eventId: event.id,
      currentOdds,
    });
    setOddsEditLoading(false);
    if (result.error) {
      setOddsEditError(result.error);
      return;
    }
    setOddsEditSelectionId(null);
    setOddsEditValue("");
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? { ...m, selections: m.selections.map((s) => (s.id === selection.id ? { ...s, current_odds: currentOdds } : s)) }
          : m
      )
    );
    router.refresh();
  }

  function openEditMarket(market: Market) {
    setEditMarketTarget(market);
    setEditMarketName(market.name);
    setEditMarketLine(market.line_value?.toString() ?? "");
    setEditMarketError(null);
  }

  async function handleEditMarketSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editMarketTarget) return;
    if (editMarketNeedsLine && editMarketLine.trim() === "") {
      setEditMarketError("This market type requires a line value.");
      return;
    }
    setEditMarketLoading(true);
    setEditMarketError(null);
    const result = await updateMarket(editMarketTarget.id, event.id, {
      name: editMarketName,
      lineValue: editMarketNeedsLine ? Number(editMarketLine) : undefined,
    });
    setEditMarketLoading(false);
    if (result.error) {
      setEditMarketError(result.error);
      return;
    }
    setEditMarketTarget(null);
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === editMarketTarget.id
          ? { ...m, name: editMarketName, line_value: editMarketNeedsLine ? Number(editMarketLine) : null }
          : m
      )
    );
    router.refresh();
  }

  async function confirmDeleteMarket() {
    if (!deleteMarketTarget) return;
    setDeleteMarketLoading(true);
    setDeleteMarketError(null);
    const result = await deleteMarket(deleteMarketTarget.id, event.id);
    setDeleteMarketLoading(false);
    if (result.error) {
      setDeleteMarketError(result.error);
      return;
    }
    setDeleteMarketTarget(null);
    setMarkets((prev) => prev.filter((m) => m.id !== deleteMarketTarget.id));
    router.refresh();
  }

  async function confirmDeleteSelection() {
    if (!deleteSelectionTarget) return;
    setDeleteSelectionLoading(true);
    setDeleteSelectionError(null);
    const result = await deleteSelection(deleteSelectionTarget.selection.id, deleteSelectionTarget.marketId, event.id);
    setDeleteSelectionLoading(false);
    if (result.error) {
      setDeleteSelectionError(result.error);
      return;
    }
    setDeleteSelectionTarget(null);
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === deleteSelectionTarget.marketId
          ? { ...m, selections: m.selections.filter((s) => s.id !== deleteSelectionTarget.selection.id) }
          : m
      )
    );
    router.refresh();
  }

  async function handleToggleActive(selection: Selection, marketId: string) {
    setToggleActiveLoadingId(selection.id);
    const result = await toggleSelectionActive(selection.id, marketId, event.id, !selection.active);
    setToggleActiveLoadingId(null);
    if (result.error) return;
    setMarkets((prev) =>
      prev.map((m) =>
        m.id === marketId
          ? { ...m, selections: m.selections.map((s) => (s.id === selection.id ? { ...s, active: !selection.active } : s)) }
          : m
      )
    );
    router.refresh();
  }

  const nextStatuses = NEXT_STATUSES[event.status];
  const marketIds = useMemo(() => markets.map((m) => m.id), [markets]);

  return (
    <div>
      {/* Live-sync: a market/selection change lands here within ~400ms
          without the admin needing to reload the page — whether it came
          from this action just finishing (router.refresh() below already
          covers that instantly) or from another admin tab/session. */}
      <RealtimeRefresher table="markets" filter={`event_id=eq.${event.id}`} />
      {marketIds.length > 0 && (
        <RealtimeRefresher table="market_selections" filter={`market_id=in.(${marketIds.join(",")})`} />
      )}

      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-secondary">{event.competitionName}</p>
            <h1 className="mt-1 font-display text-xl font-bold">
              {event.homeTeamName} <span className="text-text-secondary">vs</span> {event.awayTeamName}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {new Date(event.start_time).toLocaleString()}
              {event.status === "FINISHED" && (
                <> · Final score {event.home_score}–{event.away_score}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EventStatusBadge status={event.status} />
            {(event.status === "DRAFT" || event.status === "PUBLISHED") && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="btn-secondary gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit details
              </button>
            )}
          </div>
        </div>

        {nextStatuses.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {nextStatuses.map((next) => (
              <button
                key={next.status}
                type="button"
                onClick={() => setPendingStatus(next.status)}
                className={next.danger ? "btn-secondary hover:border-live/60 hover:text-live" : "btn-primary"}
              >
                {next.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Markets</h2>
        <button type="button" onClick={() => setMarketModalOpen(true)} className="btn-secondary gap-1.5">
          <Plus className="h-4 w-4" />
          Add market
        </button>
      </div>

      {markets.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-text-secondary">
          No markets yet. Add one (e.g. Match Result) so predictions have something to attach to.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {markets.map((market) => (
            <div key={market.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{market.name}</p>
                  <p className="text-xs text-text-secondary">
                    {MARKET_TYPES.find((t) => t.value === market.type)?.label ?? market.type} · {market.status}
                    {market.line_value !== null && <> · Line {market.line_value}</>}
                    {market.selections.length > 0 && <> · {market.selections.length} selections</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {isExactScoreMarketType(market.type) ? (
                    <button
                      type="button"
                      onClick={() => setScoreGridMarketId(market.id)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-hover"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Add score grid
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionMarketId(market.id);
                        setSelectionError(null);
                        setSelectionName("");
                        setSelectionValue("");
                        setSelectionOdds("");
                        setSelectionOutcomeCode("");
                      }}
                      className="text-sm font-medium text-gold hover:text-gold-hover"
                    >
                      + Add selection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditMarket(market)}
                    className="text-text-secondary hover:text-gold"
                    aria-label={`Edit ${market.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteMarketTarget(market);
                      setDeleteMarketError(null);
                    }}
                    className="text-text-secondary hover:text-live"
                    aria-label={`Delete ${market.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {market.selections.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {market.selections.map((s) => (
                    <li
                      key={s.id}
                      className={`pill inline-flex items-center gap-1.5 ${s.active ? "" : "border-dashed opacity-50"}`}
                    >
                      {s.name}
                      {s.value && s.value !== s.name ? ` · ${s.value}` : ""}
                      {s.current_odds !== null ? (
                        <span className="font-mono text-gold">{s.current_odds.toFixed(2)}</span>
                      ) : (
                        <span className="text-text-secondary">unpriced</span>
                      )}
                      {!s.active && <span className="text-text-secondary">(inactive)</span>}
                      <button
                        type="button"
                        onClick={() => {
                          setOddsEditSelectionId(s.id);
                          setOddsEditValue(s.current_odds?.toString() ?? "");
                          setOddsEditError(null);
                        }}
                        className="text-text-secondary hover:text-gold"
                        aria-label={`Adjust odds for ${s.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s, market.id)}
                        disabled={toggleActiveLoadingId === s.id}
                        className="text-text-secondary hover:text-gold disabled:opacity-50"
                        aria-label={s.active ? `Deactivate ${s.name}` : `Activate ${s.name}`}
                      >
                        {s.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteSelectionTarget({ selection: s, marketId: market.id });
                          setDeleteSelectionError(null);
                        }}
                        className="text-text-secondary hover:text-live"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {market.selections.map(
                (s) =>
                  oddsEditSelectionId === s.id && (
                    <form
                      key={`odds-${s.id}`}
                      onSubmit={(e) => handleOddsEditSubmit(e, s, market.id)}
                      className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3"
                    >
                      <FormField
                        label={`Odds for "${s.name}"`}
                        type="number"
                        value={oddsEditValue}
                        onChange={setOddsEditValue}
                        required
                      />
                      <button type="submit" disabled={oddsEditLoading} className="btn-primary">
                        {oddsEditLoading ? "Saving..." : "Save odds"}
                      </button>
                      <button type="button" onClick={() => setOddsEditSelectionId(null)} className="btn-secondary">
                        Cancel
                      </button>
                      {oddsEditError && (
                        <p role="alert" className="w-full text-sm text-live">
                          {oddsEditError}
                        </p>
                      )}
                    </form>
                  )
              )}

              {selectionMarketId === market.id && (
                <form
                  onSubmit={(e) => handleSelectionSubmit(e, market.id, market.type)}
                  className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
                >
                  <FormField label="Selection name" type="text" value={selectionName} onChange={setSelectionName} required />
                  {isWageringMarketType(market.type) ? (
                    <div className="w-full sm:w-56">
                      <AdminSelect
                        label="Outcome code"
                        value={selectionOutcomeCode}
                        onChange={(v) => setSelectionOutcomeCode(v as SelectionOutcomeCode)}
                        options={OUTCOME_CODES_BY_MARKET_TYPE[market.type] ?? []}
                        placeholder="What does this selection mean?"
                        required
                      />
                    </div>
                  ) : (
                    <FormField label="Value (optional)" type="text" value={selectionValue} onChange={setSelectionValue} />
                  )}
                  <FormField
                    label="Odds (optional, price later if blank)"
                    type="number"
                    value={selectionOdds}
                    onChange={setSelectionOdds}
                  />
                  <button type="submit" disabled={selectionLoading} className="btn-primary">
                    {selectionLoading ? "Adding..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMarketId(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  {selectionError && (
                    <p role="alert" className="w-full text-sm text-live">
                      {selectionError}
                    </p>
                  )}
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit event details */}
      <AdminForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit event details"
        onSubmit={handleEditSubmit}
        loading={editLoading}
        error={editError}
        submitLabel="Save changes"
      >
        <AdminSelect
          label="Competition"
          value={editForm.competitionId}
          onChange={(v) => setEditForm({ competitionId: v, homeTeamId: "", awayTeamId: "", startTime: editForm.startTime })}
          options={competitions.map((c) => ({ value: c.id, label: c.name }))}
          required
        />
        <AdminSelect
          label="Home team"
          value={editForm.homeTeamId}
          onChange={(v) => setEditForm((f) => ({ ...f, homeTeamId: v }))}
          options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
          required
        />
        <AdminSelect
          label="Away team"
          value={editForm.awayTeamId}
          onChange={(v) => setEditForm((f) => ({ ...f, awayTeamId: v }))}
          options={teamsInCompetition.map((t) => ({ value: t.id, label: t.name }))}
          required
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-secondary">Start time</span>
          <input
            type="datetime-local"
            value={editForm.startTime}
            onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
            required
            className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
          />
        </label>
      </AdminForm>

      {/* Add market */}
      <AdminForm
        open={marketModalOpen}
        onClose={() => setMarketModalOpen(false)}
        title="Add market"
        onSubmit={handleMarketSubmit}
        loading={marketLoading}
        error={marketError}
        submitLabel="Create market"
      >
        <FormField
          label="Market name"
          type="text"
          value={marketForm.name}
          onChange={(v) => setMarketForm((f) => ({ ...f, name: v }))}
          required
        />
        <AdminSelect
          label="Type"
          value={marketForm.type}
          onChange={(v) =>
            setMarketForm((f) => ({
              ...f,
              type: v as MarketType,
              lineValue: LINE_VALUE_MARKET_TYPES.includes(v as MarketType) ? f.lineValue : undefined,
            }))
          }
          options={MARKET_TYPES}
          required
        />
        {marketNeedsLine && (
          <FormField
            label={marketForm.type === "OVER_UNDER" ? "Line (e.g. 2.5 total goals)" : "Line (e.g. -1.5 for the favorite)"}
            type="number"
            value={marketForm.lineValue?.toString() ?? ""}
            onChange={(v) => setMarketForm((f) => ({ ...f, lineValue: v === "" ? undefined : Number(v) }))}
            required
          />
        )}
      </AdminForm>

      {/* Status transition confirmation, with score entry for FINISHED */}
      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus ? `${NEXT_STATUSES[event.status].find((n) => n.status === pendingStatus)?.label} this event?` : ""}
        description={
          pendingStatus === "CANCELLED"
            ? "This can't be undone. Any predictions on this event will need to be voided."
            : undefined
        }
        confirmLabel="Confirm"
        danger={pendingStatus === "CANCELLED"}
        loading={statusLoading}
        onConfirm={confirmStatusChange}
        onCancel={() => {
          setPendingStatus(null);
          setStatusError(null);
        }}
      >
        {pendingStatus === "FINISHED" && (
          <div className="mb-4 flex gap-3">
            <FormField label={`${event.homeTeamName} score`} type="number" value={homeScore} onChange={setHomeScore} required />
            <FormField label={`${event.awayTeamName} score`} type="number" value={awayScore} onChange={setAwayScore} required />
          </div>
        )}
        {statusError && (
          <p role="alert" className="mb-3 text-sm text-live">
            {statusError}
          </p>
        )}
      </ConfirmDialog>

      {/* Exact Score bulk grid builder */}
      {scoreGridMarketId && (
        <ExactScoreGridForm
          open={scoreGridMarketId !== null}
          onClose={() => setScoreGridMarketId(null)}
          marketId={scoreGridMarketId}
          eventId={event.id}
          existingScores={
            (markets.find((m) => m.id === scoreGridMarketId)?.selections ?? [])
              .map((s) => s.value)
              .filter((v): v is string => v !== null)
          }
          onCreated={(newSelections) =>
            setMarkets((prev) =>
              prev.map((m) => (m.id === scoreGridMarketId ? { ...m, selections: [...m.selections, ...newSelections] } : m))
            )
          }
        />
      )}

      {/* Edit market */}
      <AdminForm
        open={editMarketTarget !== null}
        onClose={() => setEditMarketTarget(null)}
        title="Edit market"
        onSubmit={handleEditMarketSubmit}
        loading={editMarketLoading}
        error={editMarketError}
        submitLabel="Save changes"
      >
        <FormField label="Market name" type="text" value={editMarketName} onChange={setEditMarketName} required />
        {editMarketNeedsLine && (
          <FormField
            label={editMarketTarget?.type === "OVER_UNDER" ? "Line (e.g. 2.5 total goals)" : "Line (e.g. -1.5 for the favorite)"}
            type="number"
            value={editMarketLine}
            onChange={setEditMarketLine}
            required
          />
        )}
      </AdminForm>

      {/* Delete market */}
      <ConfirmDialog
        open={deleteMarketTarget !== null}
        title={`Delete "${deleteMarketTarget?.name}"?`}
        description="This removes the market and all of its selections. Markets with existing bets or predictions can't be deleted — suspend them instead."
        confirmLabel="Delete market"
        danger
        loading={deleteMarketLoading}
        onConfirm={confirmDeleteMarket}
        onCancel={() => {
          setDeleteMarketTarget(null);
          setDeleteMarketError(null);
        }}
      >
        {deleteMarketError && (
          <p role="alert" className="mb-3 text-sm text-live">
            {deleteMarketError}
          </p>
        )}
      </ConfirmDialog>

      {/* Delete selection */}
      <ConfirmDialog
        open={deleteSelectionTarget !== null}
        title={`Delete "${deleteSelectionTarget?.selection.name}"?`}
        description="Selections with existing bets or predictions can't be deleted — deactivate them instead so they stop taking new bets."
        confirmLabel="Delete selection"
        danger
        loading={deleteSelectionLoading}
        onConfirm={confirmDeleteSelection}
        onCancel={() => {
          setDeleteSelectionTarget(null);
          setDeleteSelectionError(null);
        }}
      >
        {deleteSelectionError && (
          <p role="alert" className="mb-3 text-sm text-live">
            {deleteSelectionError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
