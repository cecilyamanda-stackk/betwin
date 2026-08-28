import Link from "next/link";

interface LiveTickerProps {
  /** Populated from a real "status = LIVE" query in (public)/layout.tsx. Empty until an admin marks a match LIVE. */
  liveEvents?: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  }[];
}

/**
 * Center header ticker (section 8). Shows nothing but a quiet placeholder
 * until admins start publishing live events — never fabricate scores here.
 */
export function LiveTicker({ liveEvents = [] }: LiveTickerProps) {
  if (liveEvents.length === 0) {
    return (
      <div className="hidden items-center gap-2 text-sm text-text-secondary md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-border" aria-hidden="true" />
        No live matches right now
      </div>
    );
  }

  const event = liveEvents[0];
  if (!event) return null;
  const rest = liveEvents.length - 1;

  return (
    <Link href="/live" className="hidden items-center gap-2 text-sm md:flex" title="See all live matches">
      <span className="live-badge">
        <span className="live-dot" aria-hidden="true" />
        Live
      </span>
      <span className="text-text-primary">
        {event.homeTeam} {event.homeScore ?? 0} - {event.awayScore ?? 0} {event.awayTeam}
      </span>
      {rest > 0 && <span className="text-text-secondary">+{rest} more</span>}
    </Link>
  );
}
