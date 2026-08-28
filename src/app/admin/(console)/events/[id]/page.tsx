import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { EventDetailManager } from "./EventDetailManager";

export default async function AdminEventDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, start_time, status, home_team_id, away_team_id, competition_id, home_score, away_score"
    )
    .eq("id", params.id)
    .single();

  if (!event) notFound();

  const [{ data: competitions }, { data: teams }, { data: markets }, { data: selections }] =
    await Promise.all([
      supabase.from("competitions").select("id, name").order("name"),
      supabase.from("teams").select("id, name, competition_id").order("name"),
      supabase
        .from("markets")
        .select("id, name, type, status, line_value")
        .eq("event_id", event.id)
        .order("created_at"),
      supabase
        // true_probability isn't requested here: it's an internal risk
        // figure, and the DB's column-level grants would strip it for
        // this admin route's client anyway (see the Phase 1 migration) —
        // a future risk-desk view can go through the service-role client
        // instead of this one.
        .from("market_selections")
        .select("id, market_id, name, value, active, current_odds, outcome_code")
        .order("created_at"),
    ]);

  const marketIds = new Set((markets ?? []).map((m) => m.id));
  const marketsWithSelections = (markets ?? []).map((m) => ({
    ...m,
    selections: (selections ?? []).filter((s) => s.market_id === m.id),
  }));
  // Defensive: never render a selection whose market wasn't returned above.
  void marketIds;

  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const competitionNameById = new Map((competitions ?? []).map((c) => [c.id, c.name]));

  return (
    <EventDetailManager
      event={{
        ...event,
        homeTeamName: teamNameById.get(event.home_team_id) ?? "—",
        awayTeamName: teamNameById.get(event.away_team_id) ?? "—",
        competitionName: competitionNameById.get(event.competition_id) ?? "—",
      }}
      markets={marketsWithSelections}
      competitions={competitions ?? []}
      teams={teams ?? []}
    />
  );
}
