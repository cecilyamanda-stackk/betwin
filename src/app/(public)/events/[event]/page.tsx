import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";
import { TeamDisplay } from "@/components/events/TeamDisplay";
import { EventTabs } from "@/components/events/EventTabs";
import { MarketPredictionCard } from "@/components/events/MarketPredictionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { EventOddsGrid } from "@/components/betslip/EventOddsGrid";
import { isWageringMarketType } from "@/lib/markets/wagering";
import type { MarketType, SelectionOutcomeCode } from "@/types/database";

interface SelectionRow {
  id: string;
  market_id: string;
  name: string;
  value: string | null;
  active: boolean;
  current_odds: number | null;
  outcome_code: SelectionOutcomeCode | null;
}

interface MyPredictionRow {
  market_id: string;
  selection_id: string;
}

/**
 * /events/[event] — event overview + market predictions (sections 13-16),
 * plus the wagering roadmap's Phase 5 Betting tab. Only Overview,
 * Predictions, and (conditionally) Betting are rendered; see EventTabs
 * for why Statistics/Lineups/Timeline are left out until real data
 * exists for them.
 */
export default async function EventPage({
  params,
  searchParams,
}: {
  params: { event: string };
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id")
    .eq("id", params.event)
    .maybeSingle();

  if (!event) notFound();

  const [{ data: homeTeam }, { data: awayTeam }, { data: competition }, { data: markets }, {
    data: { user },
  }, { data: walletSetting }] = await Promise.all([
    supabase.from("teams").select("id, name, short_name").eq("id", event.home_team_id).single(),
    supabase.from("teams").select("id, name, short_name").eq("id", event.away_team_id).single(),
    supabase.from("competitions").select("id, name, slug").eq("id", event.competition_id).single(),
    supabase
      .from("markets")
      .select("id, name, type, status, line_value")
      .eq("event_id", event.id)
      .order("created_at"),
    supabase.auth.getUser(),
    // Wagering roadmap Phase 4/5: the Betting tab only appears once an
    // admin has turned the wallet system on (see (public)/layout.tsx for
    // the same gate on the header).
    supabase.from("platform_settings").select("value").eq("key", "wallet_enabled").single(),
  ]);

  const walletEnabled = Boolean(walletSetting?.value ?? false);
  const marketIds = (markets ?? []).map((m) => m.id);

  let selections: SelectionRow[] = [];
  if (marketIds.length > 0) {
    const { data } = await supabase
      .from("market_selections")
      .select("id, market_id, name, value, active, current_odds, outcome_code")
      .in("market_id", marketIds)
      .order("created_at");
    selections = data ?? [];
  }

  let myPredictions: MyPredictionRow[] = [];
  if (user) {
    const { data } = await supabase
      .from("predictions")
      .select("market_id, selection_id")
      .eq("event_id", event.id)
      .eq("user_id", user.id);
    myPredictions = data ?? [];
  }

  const selectionsByMarket = new Map<string, SelectionRow[]>();
  for (const s of selections) {
    const list = selectionsByMarket.get(s.market_id) ?? [];
    list.push(s);
    selectionsByMarket.set(s.market_id, list);
  }
  const myPickByMarket = new Map(myPredictions.map((p) => [p.market_id, p.selection_id]));

  const pointsMarkets = (markets ?? []).filter((m) => !isWageringMarketType(m.type));
  const wageringMarkets = (markets ?? []).filter((m) => isWageringMarketType(m.type));

  const canPredict = !!user && (event.status === "PUBLISHED" || event.status === "LIVE");
  const canBet = canPredict; // same "signed in + event open" gate; place_bet re-checks server-side regardless.
  const showScore = event.status === "LIVE" || event.status === "SUSPENDED" || event.status === "FINISHED";

  const overviewTab = (
    <div className="card flex items-center justify-between gap-4 p-6">
      <TeamDisplay name={homeTeam?.name ?? "TBD"} shortName={homeTeam?.short_name} />
      <div className="flex shrink-0 flex-col items-center gap-1">
        {showScore ? (
          <span className="font-display text-2xl font-bold text-text-primary">
            {event.home_score ?? 0} - {event.away_score ?? 0}
          </span>
        ) : (
          <span className="text-sm text-text-secondary">
            {new Date(event.start_time).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <TeamDisplay name={awayTeam?.name ?? "TBD"} shortName={awayTeam?.short_name} />
    </div>
  );

  const predictionsTab = (
    <div className="flex flex-col gap-4">
      {pointsMarkets.length === 0 ? (
        <EmptyState title="No markets published for this event yet." />
      ) : (
        pointsMarkets.map((m) => (
          <MarketPredictionCard
            key={m.id}
            eventId={event.id}
            marketId={m.id}
            marketName={m.name}
            marketStatus={m.status}
            selections={(selectionsByMarket.get(m.id) ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              value: s.value,
              active: s.active,
            }))}
            currentSelectionId={myPickByMarket.get(m.id) ?? null}
            canPredict={canPredict}
          />
        ))
      )}
    </div>
  );

  const wageringMarketsForGrid = wageringMarkets.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type as MarketType,
    status: m.status,
    line_value: m.line_value,
    selections: selectionsByMarket.get(m.id) ?? [],
  }));

  const bettingTab = (
    <div>
      {/* Odds moving (an admin re-pricing a selection) shouldn't need a
          manual reload while someone's mid-bet-slip. */}
      {marketIds.length > 0 && (
        <RealtimeRefresher table="market_selections" filter={`market_id=in.(${marketIds.join(",")})`} />
      )}
      <EventOddsGrid
        markets={wageringMarketsForGrid}
        canBet={canBet}
        eventLabel={`${homeTeam?.name ?? "TBD"} vs ${awayTeam?.name ?? "TBD"}`}
      />
      {!user && <p className="mt-3 text-xs text-text-secondary">Sign in to place a bet.</p>}
      <p className="mt-3 text-xs text-text-secondary">
        Tap an odds button — your bet opens in the panel on the right (or the strip above the nav bar on a small screen).
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Live score/status and market-close/settlement updates without a manual reload (section 38). */}
      <RealtimeRefresher table="events" filter={`id=eq.${event.id}`} />
      <RealtimeRefresher table="markets" filter={`event_id=eq.${event.id}`} />

      <div>
        <p className="text-sm text-text-secondary">{competition?.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-bold text-text-primary">
            {homeTeam?.name ?? "TBD"} vs {awayTeam?.name ?? "TBD"}
          </h1>
          <EventStatusBadge status={event.status} />
        </div>
      </div>

      <EventTabs
        tabs={[
          { id: "overview", label: "Overview", content: overviewTab },
          { id: "predictions", label: "Predictions", content: predictionsTab },
          ...(walletEnabled && wageringMarkets.length > 0
            ? [{ id: "betting", label: "Betting", content: bettingTab }]
            : []),
        ]}
        initialTabId={searchParams.tab}
      />
    </div>
  );
}
