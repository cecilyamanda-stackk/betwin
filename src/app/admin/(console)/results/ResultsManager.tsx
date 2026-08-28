"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import { AdminSelect } from "@/components/admin/AdminForm";
import { setMarketResult, resettleMarket, resettleEventBets } from "@/actions/admin/results";
import { isWageringMarketType } from "@/lib/markets/wagering";
import type { EventStatus, MarketStatus, MarketType, SelectionOutcomeCode } from "@/types/database";

interface Selection {
  id: string;
  market_id: string;
  name: string;
  value: string | null;
  current_odds: number | null;
  outcome_code: SelectionOutcomeCode | null;
}

interface Market {
  id: string;
  event_id: string;
  name: string;
  type: MarketType;
  status: MarketStatus;
  winning_selection_id: string | null;
  line_value: number | null;
  selections: Selection[];
}

interface EventRow {
  id: string;
  start_time: string;
  status: EventStatus;
  home_score: number | null;
  away_score: number | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  markets: Market[];
}

function MarketRow({ market, eventId }: { market: Market; eventId: string }) {
  const router = useRouter();
  const [selectionId, setSelectionId] = useState(market.winning_selection_id ?? "");
  const [editing, setEditing] = useState(!market.winning_selection_id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentWinner = market.selections.find((s) => s.id === market.winning_selection_id);

  async function handleSave() {
    if (!selectionId) {
      setError("Pick a winning selection first.");
      return;
    }
    setLoading(true);
    setError(null);

    const action = market.winning_selection_id ? resettleMarket : setMarketResult;
    const result = await action(market.id, eventId, selectionId);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-text-primary">{market.name}</p>
        <p className="text-xs text-text-secondary">{market.type.replace(/_/g, " ")}</p>
      </div>

      {!editing && currentWinner ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-pill bg-success/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-success">
            {currentWinner.name}
            {currentWinner.value ? ` (${currentWinner.value})` : ""}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-gold hover:text-gold-hover">
            Correct
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <AdminSelect
              label=""
              value={selectionId}
              onChange={setSelectionId}
              options={market.selections.map((s) => ({
                value: s.id,
                label: s.value ? `${s.name} (${s.value})` : s.name,
              }))}
              placeholder="Winning selection..."
            />
          </div>
          <button type="button" onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Save result"}
          </button>
          {market.winning_selection_id && (
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-live sm:basis-full">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Read-only row for the six wagering market types (Phase 2 of the
 * wagering roadmap). There's no "pick the winner" control here — the
 * DB's settle_bets_for_event() grades every selection against the
 * event's final score the moment the event is marked FINISHED, using
 * each selection's outcome_code + the market's line_value. This row just
 * shows what that logic has to work with, so an admin can sanity-check a
 * market's pricing/outcome-code setup before the event finishes.
 */
function WageringMarketRow({ market }: { market: Market }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-text-primary">{market.name}</p>
        <p className="text-xs text-text-secondary">
          {market.type.replace(/_/g, " ")}
          {market.line_value !== null && <> · Line {market.line_value}</>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {market.selections.map((s) => (
          <span key={s.id} className="pill inline-flex items-center gap-1.5">
            {s.name}
            <span className="font-mono text-gold">{s.current_odds?.toFixed(2) ?? "—"}</span>
            {!s.outcome_code && <span className="text-live">no outcome code</span>}
          </span>
        ))}
        <span
          className={
            market.status === "SETTLED"
              ? "inline-flex items-center rounded-pill bg-success/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-success"
              : "inline-flex items-center rounded-pill bg-surface-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-text-secondary"
          }
        >
          {market.status === "SETTLED" ? "Settled" : "Waiting for final score"}
        </span>
      </div>
    </div>
  );
}

export function ResultsManager({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [resettlingId, setResettlingId] = useState<string | null>(null);
  const [resettleError, setResettleError] = useState<{ eventId: string; message: string } | null>(null);

  if (events.length === 0) {
    return (
      <p className="card px-6 py-10 text-center text-sm text-text-secondary">
        No live or finished events with markets to settle right now.
      </p>
    );
  }

  async function handleResettleBets(eventId: string) {
    setResettlingId(eventId);
    setResettleError(null);
    const result = await resettleEventBets(eventId);
    setResettlingId(null);
    if (result.error) {
      setResettleError({ eventId, message: result.error });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {events.map((event) => {
        const wageringMarkets = event.markets.filter((m) => isWageringMarketType(m.type));
        const pointsMarkets = event.markets.filter((m) => !isWageringMarketType(m.type));
        const canResettleBets = event.status === "FINISHED" && wageringMarkets.some((m) => m.status === "SETTLED");

        return (
          <div key={event.id} className="card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-text-secondary">{event.competitionName}</p>
                <p className="font-display font-bold text-text-primary">
                  {event.homeTeamName}
                  {event.home_score !== null ? ` ${event.home_score}` : ""} vs {event.awayTeamName}
                  {event.away_score !== null ? ` ${event.away_score}` : ""}
                </p>
                <p className="text-xs text-text-secondary">{new Date(event.start_time).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                {canResettleBets && (
                  <button
                    type="button"
                    onClick={() => handleResettleBets(event.id)}
                    disabled={resettlingId === event.id}
                    className="text-xs text-gold hover:text-gold-hover"
                  >
                    {resettlingId === event.id ? "Re-settling..." : "Re-settle bets"}
                  </button>
                )}
                <EventStatusBadge status={event.status} />
              </div>
            </div>

            {resettleError?.eventId === event.id && (
              <p role="alert" className="mb-2 text-sm text-live">
                {resettleError.message}
              </p>
            )}

            {pointsMarkets.length > 0 && (
              <div className="mt-2">
                {pointsMarkets.map((market) => (
                  <MarketRow key={market.id} market={market} eventId={event.id} />
                ))}
              </div>
            )}

            {wageringMarkets.length > 0 && (
              <div className="mt-2">
                {pointsMarkets.length > 0 && (
                  <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Wagering markets
                  </p>
                )}
                {wageringMarkets.map((market) => (
                  <WageringMarketRow key={market.id} market={market} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
