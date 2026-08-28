import Link from "next/link";
import { TeamDisplay } from "./TeamDisplay";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import type { EventStatus } from "@/types/database";

export interface EventCardData {
  id: string;
  startTime: string;
  status: EventStatus;
  homeTeamName: string;
  homeTeamShort: string | null;
  awayTeamName: string;
  awayTeamShort: string | null;
  homeScore: number | null;
  awayScore: number | null;
  competitionName: string;
}

/**
 * Shared event summary tile (section 13). Shape matches
 * ui/LoadingSkeleton's EventCardSkeleton so the layout doesn't jump on
 * load. Used across the homepage, sport/competition listing pages, and
 * anywhere else a grid of events is shown.
 */
export function EventCard({ event }: { event: EventCardData }) {
  const showScore = event.status === "LIVE" || event.status === "SUSPENDED" || event.status === "FINISHED";

  return (
    <Link
      href={`/events/${event.id}`}
      className="card flex flex-col gap-3 p-4 transition-colors hover:border-gold/40"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
        <span className="truncate">{event.competitionName}</span>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <TeamDisplay name={event.homeTeamName} shortName={event.homeTeamShort} />
        <div className="flex shrink-0 flex-col items-center gap-0.5 px-1">
          {showScore ? (
            <span className="font-display text-lg font-bold text-text-primary">
              {event.homeScore ?? 0} - {event.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-center text-xs text-text-secondary">
              {new Date(event.startTime).toLocaleString(undefined, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <TeamDisplay name={event.awayTeamName} shortName={event.awayTeamShort} />
      </div>
    </Link>
  );
}
