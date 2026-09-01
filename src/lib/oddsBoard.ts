import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MarketType } from "@/types/database";
import type { OddsBoardEvent } from "@/components/betslip/TeamsGrid";

const HEADLINE_MARKET_PRIORITY: MarketType[] = ["MATCH_WINNER_3WAY", "MONEYLINE"];
const WAGERING_TYPES: MarketType[] = [
  "MATCH_WINNER_3WAY",
  "MONEYLINE",
  "OVER_UNDER",
  "HANDICAP",
  "BOTH_TEAMS_TO_SCORE",
  "DOUBLE_CHANCE",
];

/**
 * Builds the homepage odds board: PUBLISHED/LIVE events that have a
 * fully-priced 1X2 (or 2-way Moneyline) market, since that's the one a
 * clickable-odds board can show inline without the row turning into an
 * unreadable wall of buttons. An event with markets that aren't priced
 * yet, or that only has non-headline wagering markets (e.g. only an
 * Over/Under was set up so far), doesn't appear here — better to leave
 * it off the board than show broken-looking "—" buttons for the primary
 * market.
 */
export async function getOddsBoardEvents(
  supabase: SupabaseClient<Database>,
  limit = 25
): Promise<OddsBoardEvent[]> {
  const { data: events } = await supabase
    .from("events")
    .select("id, start_time, home_team_id, away_team_id, competition_id")
    .in("status", ["PUBLISHED", "LIVE"])
    .order("start_time", { ascending: true })
    .limit(limit * 3); // over-fetch: not every candidate will have a priced headline market

  if (!events || events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const { data: markets } = await supabase
    .from("markets")
    .select("id, event_id, name, type")
    .in("event_id", eventIds)
    .in("type", WAGERING_TYPES)
    .eq("status", "OPEN");

  if (!markets || markets.length === 0) return [];

  const marketsByEvent = new Map<string, typeof markets>();
  for (const m of markets) {
    const list = marketsByEvent.get(m.event_id) ?? [];
    list.push(m);
    marketsByEvent.set(m.event_id, list);
  }

  const headlineMarketByEvent = new Map<string, (typeof markets)[number]>();
  for (const [eventId, eventMarkets] of marketsByEvent) {
    for (const type of HEADLINE_MARKET_PRIORITY) {
      const match = eventMarkets.find((m) => m.type === type);
      if (match) {
        headlineMarketByEvent.set(eventId, match);
        break;
      }
    }
  }

  const headlineMarketIds = [...headlineMarketByEvent.values()].map((m) => m.id);
  if (headlineMarketIds.length === 0) return [];

  const { data: selections } = await supabase
    .from("market_selections")
    .select("id, market_id, name, current_odds, outcome_code, active")
    .in("market_id", headlineMarketIds)
    .eq("active", true);

  const selectionsByMarket = new Map<string, NonNullable<typeof selections>>();
  for (const s of selections ?? []) {
    const list = selectionsByMarket.get(s.market_id) ?? [];
    list.push(s);
    selectionsByMarket.set(s.market_id, list);
  }

  const OUTCOME_ORDER: Record<string, number> = { HOME: 0, DRAW: 1, AWAY: 2 };

  const teamIds = [...new Set(events.flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const competitionIds = [...new Set(events.map((e) => e.competition_id))];
  const [{ data: teams }, { data: competitions }] = await Promise.all([
    supabase.from("teams").select("id, name").in("id", teamIds),
    supabase.from("competitions").select("id, name, country").in("id", competitionIds),
  ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const competitionById = new Map((competitions ?? []).map((c) => [c.id, c]));

  const board: OddsBoardEvent[] = [];
  for (const event of events) {
    const headline = headlineMarketByEvent.get(event.id);
    if (!headline) continue;

    const rawSelections = (selectionsByMarket.get(headline.id) ?? [])
      .filter((s) => s.current_odds !== null)
      .sort((a, b) => (OUTCOME_ORDER[a.outcome_code ?? ""] ?? 9) - (OUTCOME_ORDER[b.outcome_code ?? ""] ?? 9));

    const expectedCount = headline.type === "MATCH_WINNER_3WAY" ? 3 : 2;
    if (rawSelections.length < expectedCount) continue; // partially priced — leave off the board rather than show gaps

    const home = teamById.get(event.home_team_id);
    const away = teamById.get(event.away_team_id);
    const competition = competitionById.get(event.competition_id);
    const extraMarketsCount = (marketsByEvent.get(event.id)?.length ?? 1) - 1;

    board.push({
      id: event.id,
      competitionName: competition?.name ?? "",
      country: competition?.country ?? null,
      startTime: event.start_time,
      homeTeam: home?.name ?? "TBD",
      awayTeam: away?.name ?? "TBD",
      marketId: headline.id,
      marketName: headline.name,
      selections: rawSelections.map((s) => ({ id: s.id, label: s.name, odds: s.current_odds as number })),
      extraMarketsCount,
    });

    if (board.length >= limit) break;
  }

  return board;
}
