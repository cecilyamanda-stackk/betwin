import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { ResultsManager } from "./ResultsManager";

/**
 * /admin/results (section 24): manual result entry. Lists every market on
 * a LIVE or FINISHED event that doesn't have a winning selection yet, plus
 * already-settled markets on those same events so a result can be
 * corrected. DRAFT/PUBLISHED events aren't shown — nothing to settle
 * before they've actually been played.
 */
export default async function AdminResultsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id"
    )
    .in("status", ["LIVE", "FINISHED"])
    .order("start_time", { ascending: false })
    .limit(50);

  const eventIds = (events ?? []).map((e) => e.id);

  const [{ data: markets }, { data: selections }, { data: teams }, { data: competitions }] =
    await Promise.all([
      eventIds.length
        ? supabase
            .from("markets")
            .select("id, event_id, name, type, status, winning_selection_id, line_value")
            .in("event_id", eventIds)
            .order("created_at")
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabase
            .from("market_selections")
            .select("id, market_id, name, value, current_odds, outcome_code")
            .order("created_at")
        : Promise.resolve({ data: [] }),
      supabase.from("teams").select("id, name"),
      supabase.from("competitions").select("id, name"),
    ]);

  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const competitionNameById = new Map((competitions ?? []).map((c) => [c.id, c.name]));

  const marketsWithSelections = (markets ?? []).map((m) => ({
    ...m,
    selections: (selections ?? []).filter((s) => s.market_id === m.id),
  }));

  const eventsWithData = (events ?? [])
    .map((e) => ({
      ...e,
      homeTeamName: teamNameById.get(e.home_team_id) ?? "—",
      awayTeamName: teamNameById.get(e.away_team_id) ?? "—",
      competitionName: competitionNameById.get(e.competition_id) ?? "—",
      markets: marketsWithSelections.filter((m) => m.event_id === e.id),
    }))
    .filter((e) => e.markets.length > 0);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold">Results</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Enter the winning selection for each points-game market — predictions settle
        automatically. Wagering markets (Match Winner, Over/Under, Handicap, BTTS, Double
        Chance) settle themselves from the final score once an event is marked FINISHED.
      </p>
      <ResultsManager events={eventsWithData} />
    </div>
  );
}
