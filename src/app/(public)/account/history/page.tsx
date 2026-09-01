import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";
import { MyBetsManager, type MyBetCard, type MyAccumulatorLeg } from "@/components/account/MyBetsManager";
import { formatKES } from "@/lib/currency";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface BetRow {
  id: string;
  event_id: string;
  market_id: string;
  selection_id: string;
  stake_amount: number;
  odds_at_placement: number;
  potential_payout: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  created_at: string;
}

interface AccumulatorBetRow {
  id: string;
  stake_amount: number;
  total_odds_at_placement: number;
  potential_payout: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  created_at: string;
}

interface AccumulatorLegRow {
  id: string;
  accumulator_bet_id: string;
  event_id: string;
  market_id: string;
  selection_id: string;
  odds_at_placement: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
}

/**
 * Turns raw `bets` rows into display-ready cards — one shared hydration
 * path for both the active and settled tabs so a card looks the same
 * regardless of which query it came from.
 */
async function hydrateBets(supabase: SupabaseClient<Database>, bets: BetRow[]): Promise<MyBetCard[]> {
  if (bets.length === 0) return [];

  const eventIds = [...new Set(bets.map((b) => b.event_id))];
  const marketIds = [...new Set(bets.map((b) => b.market_id))];
  const selectionIds = [...new Set(bets.map((b) => b.selection_id))];

  const [{ data: events }, { data: markets }, { data: selections }] = await Promise.all([
    supabase
      .from("events")
      .select("id, home_team_id, away_team_id, home_score, away_score, status, competition_id")
      .in("id", eventIds),
    supabase.from("markets").select("id, name").in("id", marketIds),
    supabase.from("market_selections").select("id, name, value").in("id", selectionIds),
  ]);

  const teamIds = [...new Set((events ?? []).flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const competitionIds = [...new Set((events ?? []).map((e) => e.competition_id))];

  const [{ data: teams }, { data: competitions }] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    competitionIds.length
      ? supabase.from("competitions").select("id, name").in("id", competitionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const selectionById = new Map((selections ?? []).map((s) => [s.id, s]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const competitionById = new Map((competitions ?? []).map((c) => [c.id, c]));

  return bets.map((b) => {
    const event = eventById.get(b.event_id);
    const market = marketById.get(b.market_id);
    const selection = selectionById.get(b.selection_id);
    const home = event ? teamById.get(event.home_team_id) : undefined;
    const away = event ? teamById.get(event.away_team_id) : undefined;

    return {
      kind: "single" as const,
      id: b.id,
      homeTeam: home?.name ?? "TBD",
      awayTeam: away?.name ?? "TBD",
      competitionName: event ? (competitionById.get(event.competition_id)?.name ?? null) : null,
      marketName: market?.name ?? "Market",
      selectionLabel: selection ? (selection.value ? `${selection.name} (${selection.value})` : selection.name) : "—",
      odds: b.odds_at_placement,
      stake: b.stake_amount,
      potentialPayout: b.potential_payout,
      status: b.status,
      eventStatus: event?.status ?? "PUBLISHED",
      homeScore: event?.home_score ?? null,
      awayScore: event?.away_score ?? null,
      createdAt: b.created_at,
    };
  });
}

/**
 * Same idea as hydrateBets, for accumulators: turns raw
 * accumulator_bets + accumulator_bet_legs rows into display-ready cards,
 * one leg summary per match in the accumulator (see MyBetsManager for
 * how these render — a single combined card, not one card per leg).
 */
async function hydrateAccumulators(
  supabase: SupabaseClient<Database>,
  accBets: AccumulatorBetRow[]
): Promise<MyBetCard[]> {
  if (accBets.length === 0) return [];

  const accIds = accBets.map((a) => a.id);
  const { data: legRows } = await supabase
    .from("accumulator_bet_legs")
    .select("id, accumulator_bet_id, event_id, market_id, selection_id, odds_at_placement, status")
    .in("accumulator_bet_id", accIds);

  const legs = (legRows ?? []) as AccumulatorLegRow[];
  const eventIds = [...new Set(legs.map((l) => l.event_id))];
  const marketIds = [...new Set(legs.map((l) => l.market_id))];
  const selectionIds = [...new Set(legs.map((l) => l.selection_id))];

  const [{ data: events }, { data: markets }, { data: selections }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, home_team_id, away_team_id").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; home_team_id: string; away_team_id: string }[] }),
    marketIds.length
      ? supabase.from("markets").select("id, name").in("id", marketIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    selectionIds.length
      ? supabase.from("market_selections").select("id, name, value").in("id", selectionIds)
      : Promise.resolve({ data: [] as { id: string; name: string; value: string | null }[] }),
  ]);

  const teamIds = [...new Set((events ?? []).flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const selectionById = new Map((selections ?? []).map((s) => [s.id, s]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const legsByAcc = new Map<string, MyAccumulatorLeg[]>();
  for (const l of legs) {
    const event = eventById.get(l.event_id);
    const home = event ? teamById.get(event.home_team_id) : undefined;
    const away = event ? teamById.get(event.away_team_id) : undefined;
    const market = marketById.get(l.market_id);
    const selection = selectionById.get(l.selection_id);

    const leg: MyAccumulatorLeg = {
      eventLabel: `${home?.name ?? "TBD"} vs ${away?.name ?? "TBD"}`,
      marketName: market?.name ?? "Market",
      selectionLabel: selection ? (selection.value ? `${selection.name} (${selection.value})` : selection.name) : "—",
      odds: l.odds_at_placement,
      status: l.status,
    };
    legsByAcc.set(l.accumulator_bet_id, [...(legsByAcc.get(l.accumulator_bet_id) ?? []), leg]);
  }

  return accBets.map((a) => ({
    kind: "accumulator" as const,
    id: a.id,
    legs: legsByAcc.get(a.id) ?? [],
    totalOdds: a.total_odds_at_placement,
    stake: a.stake_amount,
    potentialPayout: a.potential_payout,
    status: a.status,
    createdAt: a.created_at,
  }));
}

/**
 * /account/history — "My Bets". Active (PENDING) and Settled
 * (WON/LOST/VOID) as separate tabs rather than one flat list, so a user
 * can tell "what's still at risk" from "what already happened" at a
 * glance — see MyBetsManager for the full design rationale, including
 * what's deliberately not built (cash-out, accumulator cancellation).
 *
 * Singles and accumulators are merged into one list per tab, newest
 * first. One known gap: pagination (below) is driven by the singles
 * count only — accumulators settled beyond the most recent 20 won't
 * show up on later pages. Fine for now (accumulators are a small
 * fraction of volume), worth revisiting if that stops being true.
 */
export default async function AccountHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = parsePage(searchParams.page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">My Bets</h1>
        <EmptyState title="Sign in to see your bets." />
      </div>
    );
  }

  const betColumns =
    "id, event_id, market_id, selection_id, stake_amount, odds_at_placement, potential_payout, status, created_at";
  const accColumns = "id, stake_amount, total_odds_at_placement, potential_payout, status, created_at";

  const [
    { data: wallet },
    { data: activeBetsRaw },
    { data: settledBetsRaw, count: settledCount },
    { data: activeAccRaw },
    { data: settledAccRaw },
  ] = await Promise.all([
    supabase.from("wallets").select("withdrawable_cash, bonus_funds, total_balance").eq("user_id", user.id).single(),
    supabase
      .from("bets")
      .select(betColumns)
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false }),
    supabase
      .from("bets")
      .select(betColumns, { count: "exact" })
      .eq("user_id", user.id)
      .neq("status", "PENDING")
      .order("created_at", { ascending: false })
      .range(...pageRange(page)),
    supabase
      .from("accumulator_bets")
      .select(accColumns)
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false }),
    supabase
      .from("accumulator_bets")
      .select(accColumns)
      .eq("user_id", user.id)
      .neq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const [activeSingles, settledSingles, activeAcc, settledAcc] = await Promise.all([
    hydrateBets(supabase, activeBetsRaw ?? []),
    hydrateBets(supabase, settledBetsRaw ?? []),
    hydrateAccumulators(supabase, (activeAccRaw ?? []) as AccumulatorBetRow[]),
    hydrateAccumulators(supabase, (settledAccRaw ?? []) as AccumulatorBetRow[]),
  ]);

  const byNewest = (a: MyBetCard, b: MyBetCard) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const activeBets = [...activeSingles, ...activeAcc].sort(byNewest);
  const settledBets = [...settledSingles, ...settledAcc].sort(byNewest);

  const stakedInPlay = activeBets.reduce((sum, b) => sum + b.stake, 0);
  const potentialReturns = activeBets.reduce((sum, b) => sum + b.potentialPayout, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">My Bets</h1>

      {/* Ties this page back to the wallet the roadmap flagged as
          missing: what you can bet with, and what's currently tied up
          in bets that haven't settled yet. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Wallet balance</p>
          <p className="font-display text-lg font-bold text-text-primary">{formatKES(wallet?.total_balance ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Withdrawable</p>
          <p className="font-display text-lg font-bold text-text-primary">
            {formatKES(wallet?.withdrawable_cash ?? 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Staked in play</p>
          <p className="font-display text-lg font-bold text-text-primary">{formatKES(stakedInPlay)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-secondary">Potential returns</p>
          <p className="font-display text-lg font-bold text-gold">{formatKES(potentialReturns)}</p>
        </div>
      </div>

      <MyBetsManager
        activeBets={activeBets}
        settledBets={settledBets}
        settledPagination={
          <Pagination
            page={page}
            totalPages={computeTotalPages(settledCount, DEFAULT_PAGE_SIZE)}
            basePath="/account/history"
          />
        }
      />
    </div>
  );
}
