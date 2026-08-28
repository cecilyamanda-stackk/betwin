import type { EventStatus } from "@/types/database";

const STYLES: Record<EventStatus, string> = {
  DRAFT: "border border-border text-text-secondary",
  PUBLISHED: "bg-gold/15 text-gold",
  LIVE: "bg-live/15 text-live",
  SUSPENDED: "bg-live/15 text-live",
  FINISHED: "bg-success/15 text-success",
  CANCELLED: "border border-border text-text-secondary line-through",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STYLES[status]}`}>
      {status === "LIVE" && <span className="live-dot mr-1.5" />}
      {status}
    </span>
  );
}
