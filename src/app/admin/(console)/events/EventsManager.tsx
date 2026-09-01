"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import type { EventStatus } from "@/types/database";

interface EventRow {
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

/**
 * Event creation itself lives at /admin/events/new (the "Create Game"
 * wizard) — it walks through match details, markets, and odds, and
 * publishes in one flow instead of the create-then-navigate-to-detail
 * pattern this page used to open a modal for. This page stays focused on
 * browsing/finding existing events.
 */
export function EventsManager({ events }: { events: EventRow[] }) {
  const router = useRouter();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link href="/admin/events/new" className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Create game
        </Link>
      </div>

      <AdminTable
        rows={events}
        keyField={(e) => e.id}
        onRowClick={(e) => router.push(`/admin/events/${e.id}`)}
        emptyTitle="No events yet."
        emptyDescription="Create the first game to start building markets on it."
        columns={[
          {
            key: "matchup",
            label: "Matchup",
            render: (e) => (
              <span>
                {e.homeTeamName} <span className="text-text-secondary">vs</span> {e.awayTeamName}
                {e.status === "FINISHED" && (
                  <span className="ml-2 text-text-secondary">
                    ({e.home_score}–{e.away_score})
                  </span>
                )}
              </span>
            ),
          },
          { key: "competition", label: "Competition", render: (e) => e.competitionName },
          {
            key: "start_time",
            label: "Start",
            render: (e) => new Date(e.start_time).toLocaleString(),
          },
          { key: "status", label: "Status", render: (e) => <EventStatusBadge status={e.status} /> },
        ]}
      />
    </>
  );
}
