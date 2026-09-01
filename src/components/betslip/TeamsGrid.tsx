"use client";

import Link from "next/link";
import { useEffect } from "react";
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

/** Home / Draw / Away (or Home / Away) — one button per market slot on the card. */
function MarketButton({
  eventLabel,
  marketId,
  marketName,
  label,
  selection,
}: {
  eventLabel: string;
  marketId: string;
  marketName: string;
  label: string;
  selection: OddsBoardSelection | null;
}) {
  const { toggleSelection, isSelected } = useBetSlip();

  if (!selection) {
    return (
      <div className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 text-text-secondary/50">
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
        <span className="font-mono text-sm">—</span>
      </div>
    );
  }

  const selected = isSelected(marketId, selection.id);

  return (
    <button
      type="button"
      onClick={() =>
        toggleSelection({
          marketId,
          marketName,
          selectionId: selection.id,
          selectionLabel: selection.label,
          eventLabel,
          odds: selection.odds,
        })
      }
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border text-sm transition-colors ${
        selected
          ? "border-gold bg-gold/10 text-gold"
          : "border-border bg-surface-secondary text-text-primary hover:border-gold/60"
      }`}
    >
      <span className="text-[11px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-mono font-bold">{selection.odds.toFixed(2)}</span>
    </button>
  );
}

/**
 * One event, one card: team names up top, three market buttons (Home /
 * Draw / Away — or Home / Away for a 2-way line, with the middle slot
 * left as a dash), and a "+N other markets" tag in the bottom-right
 * corner when the event has more wagering markets than just this
 * headline one. Replaces the old sportsbook-row layout with the same
 * tile shape the rest of the homepage (Live, Featured, Upcoming) already
 * uses, so "Teams" reads as one more section of cards rather than a
 * different kind of UI bolted on.
 */
function TeamCard({ event }: { event: OddsBoardEvent }) {
  const { reportLiveOdds } = useBetSlip();

  useEffect(() => {
    for (const s of event.selections) reportLiveOdds(s.id, s.odds);
  }, [event.selections, reportLiveOdds]);

  const eventLabel = `${event.homeTeam} vs ${event.awayTeam}`;
  const is3Way = event.selections.length === 3;
  const home = event.selections[0] ?? null;
  const draw = is3Way ? (event.selections[1] ?? null) : null;
  const away = is3Way ? (event.selections[2] ?? null) : (event.selections[1] ?? null);

  return (
    <div className="card relative flex flex-col gap-3 p-4">
      <div>
        <p className="flex items-center justify-between gap-2 text-xs text-text-secondary">
          <span className="truncate">
            {event.country ? `${event.country} • ` : ""}
            {event.competitionName}
          </span>
          <span className="shrink-0">
            {new Date(event.startTime).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-text-primary">{event.homeTeam}</p>
        <p className="truncate text-sm font-semibold text-text-primary">{event.awayTeam}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MarketButton eventLabel={eventLabel} marketId={event.marketId} marketName={event.marketName} label="1" selection={home} />
        <MarketButton eventLabel={eventLabel} marketId={event.marketId} marketName={event.marketName} label="X" selection={draw} />
        <MarketButton eventLabel={eventLabel} marketId={event.marketId} marketName={event.marketName} label="2" selection={away} />
      </div>

      {event.extraMarketsCount > 0 && (
        <Link
          href={`/events/${event.id}?tab=betting`}
          className="self-end text-xs font-medium text-success hover:underline"
        >
          +{event.extraMarketsCount} other markets
        </Link>
      )}
    </div>
  );
}

/**
 * Homepage "Teams" section (formerly "Bettable Now" — see page.tsx):
 * PUBLISHED/LIVE events with a fully-priced headline market, shown as a
 * card grid. Renders nothing when empty, same as every other homepage
 * section backed by real data.
 */
export function TeamsGrid({ events }: { events: OddsBoardEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <TeamCard key={e.id} event={e} />
      ))}
    </div>
  );
}
