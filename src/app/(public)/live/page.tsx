import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveEventCard } from "@/components/events/LiveEventCard";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import type { EventStatus } from "@/types/database";

interface RawEvent {
  id: string;
  start_time: string;
  status: EventStatus;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  competition_id: string;
}

/**
 * /live — every currently-LIVE event. `MobileNav` has linked here since
 * Phase 1, but the route never existed (a 404 behind a bottom-nav tab);
 * this closes that gap as part of the Phase 5 empty/error-state sweep.
 * Scores/status update in place via Realtime rather than needing a
 * manual refresh (section 38).
 */
export default async function LivePage() {
  const supabase = await createClient();

  const { data: liveRows } = await supabase
    .from("events")
    .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id")
    .eq("status", "LIVE")
    .order("start_time");

  const events = (liveRows ?? []) as RawEvent[];
  const teamIds = [...new Set(events.flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const competitionIds = [...new Set(events.map((e) => e.competition_id))];

  const [{ data: teams }, { data: competitions }] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name, short_name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string; short_name: string | null }[] }),
    competitionIds.length
      ? supabase.from("competitions").select("id, name").in("id", competitionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const competitionNameById = new Map((competitions ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      {/* Unfiltered: a match leaving LIVE (e.g. FINISHED) must refresh this list too, not just ones staying LIVE. */}
      <RealtimeRefresher table="events" />

      <div>
        <h1 className="font-display text-2xl font-bold">Live Now</h1>
        <p className="mt-1 text-text-secondary">Every match in progress right now, updating automatically.</p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No live matches right now."
          description="Live events will show up here the moment an admin marks one LIVE."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => {
            const home = teamById.get(e.home_team_id);
            const away = teamById.get(e.away_team_id);
            return (
              <LiveEventCard
                key={e.id}
                event={{
                  id: e.id,
                  startTime: e.start_time,
                  status: e.status,
                  homeTeamName: home?.name ?? "TBD",
                  homeTeamShort: home?.short_name ?? null,
                  awayTeamName: away?.name ?? "TBD",
                  awayTeamShort: away?.short_name ?? null,
                  homeScore: e.home_score,
                  awayScore: e.away_score,
                  competitionName: competitionNameById.get(e.competition_id) ?? "",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
