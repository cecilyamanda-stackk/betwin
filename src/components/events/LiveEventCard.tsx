import { EventCard, type EventCardData } from "./EventCard";

/**
 * LIVE-emphasized wrapper around EventCard (section 13) — used for the
 * homepage/sport-page "Live Now" rails. Just adds the pulsing live ring;
 * EventStatusBadge inside EventCard already shows the live dot + score.
 */
export function LiveEventCard({ event }: { event: EventCardData }) {
  return (
    <div className="rounded-card ring-1 ring-live/40">
      <EventCard event={event} />
    </div>
  );
}
