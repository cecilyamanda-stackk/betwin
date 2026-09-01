"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Globe2 } from "lucide-react";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export interface OddsBoardSelection {
  id: string;
  label: string;
  odds: number;
}

export interface OddsBoardEvent {
  id: string;
  competitionName: string;
  country: string | null;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  marketId: string;
  marketName: string;
  /** Ordered: [Home, Draw, Away] for 1X2, or [Home, Away] for a 2-way moneyline. */
  selections: OddsBoardSelection[];
  /** Other wagering markets on this event besides the one shown here. */
  extraMarketsCount: number;
}

function OddsButton({ marketId, marketName, selection }: { marketId: string; marketName: string; selection: OddsBoardSelection }) {
  const { toggleSelection, isSelected } = useBetSlip();
  const selected = isSelected(marketId, selection.id);
  return (
    <button
      type="button"
      onClick={() => toggleSelection({ marketId, marketName, selectionId: selection.id, selectionLabel: selection.label, odds: selection.odds })}
      className={`flex h-11 w-full items-center justify-center rounded-full border text-sm font-bold transition-colors sm:w-24 ${
        selected ? "border-gold bg-gold/10 text-gold" : "border-transparent bg-surface-secondary text-text-primary hover:border-gold/60"
      }`}
    >
      {selection.odds.toFixed(2)}
    </button>
  );
}

function EventRow({ event }: { event: OddsBoardEvent }) {
  const { reportLiveOdds } = useBetSlip();

  useEffect(() => {
    for (const s of event.selections) reportLiveOdds(s.id, s.odds);
  }, [event.selections, reportLiveOdds]);

  // Always 3 slots so every row lines up under the "1 / X / 2" header,
  // even for a 2-way moneyline event that only has Home/Away.
  const slots: (OddsBoardSelection | null)[] =
    event.selections.length === 3 ? event.selections : [event.selections[0] ?? null, null, event.selections[1] ?? null];

  return (
    <div className="border-b border-border/60 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5" />
          {event.country ? `${event.country} • ` : ""}
          {event.competitionName}
        </span>
        <span>
          {new Date(event.startTime).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm font-semibold text-text-primary">
          <p className="truncate">{event.homeTeam}</p>
          <p className="truncate">{event.awayTeam}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
          {slots.map((s, i) =>
            s ? (
              <OddsButton key={s.id} marketId={event.marketId} marketName={event.marketName} selection={s} />
            ) : (
              <div key={`empty-${i}`} className="h-11 w-full rounded-full bg-transparent sm:w-24" />
            )
          )}
        </div>
      </div>

      {event.extraMarketsCount > 0 && (
        <div className="mt-1.5 text-right">
          <Link href={`/events/${event.id}?tab=betting`} className="text-xs font-medium text-success hover:underline">
            +{event.extraMarketsCount} Markets
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Sportsbook-style odds board: bettable events with their headline
 * market's odds shown inline, so a bet can start right from this list
 * instead of needing to open every event individually. Placed at the
 * top of the homepage, above Live/Featured, since it's the primary
 * "do something" content once wallet betting is enabled.
 */
export function OddsBoard({ events }: { events: OddsBoardEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="mb-1 hidden items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-secondary sm:flex">
        <span>Teams</span>
        <div className="flex gap-2">
          <span className="w-24 text-center">1</span>
          <span className="w-24 text-center">X</span>
          <span className="w-24 text-center">2</span>
        </div>
      </div>
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
    </div>
  );
}
