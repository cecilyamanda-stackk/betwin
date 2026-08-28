import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

const STATUS_STYLES: Record<string, string> = {
  WON: "text-success",
  LOST: "text-live",
  VOID: "text-text-secondary",
  PENDING: "text-gold",
};

/**
 * /account/history — wagering roadmap Phase 6's "Bet History": extends
 * the *concept* of the existing /predictions/history page to the `bets`
 * table, with the stake_amount/odds_at_placement/potential_payout columns
 * the roadmap calls for. Kept as its own page rather than merged into
 * /predictions/history — bets and predictions have been separate tables
 * since Phase 1 (points game vs. real money), and this account section is
 * specifically about the wagering side.
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
        <h1 className="font-display text-2xl font-bold">Bet History</h1>
        <EmptyState title="Sign in to see your bet history." />
      </div>
    );
  }

  const { data: bets, count } = await supabase
    .from("bets")
    .select("id, event_id, market_id, selection_id, stake_amount, odds_at_placement, potential_payout, status, created_at, settled_at", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(...pageRange(page));

  if (!bets || bets.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Bet History</h1>
        <EmptyState
          title="No bets placed yet."
          description="Odds show up on an event's Betting tab once markets are priced."
        />
      </div>
    );
  }

  const eventIds = [...new Set(bets.map((b) => b.event_id))];
  const marketIds = [...new Set(bets.map((b) => b.market_id))];
  const selectionIds = [...new Set(bets.map((b) => b.selection_id))];

  const [{ data: events }, { data: markets }, { data: selections }] = await Promise.all([
    supabase.from("events").select("id, home_team_id, away_team_id").in("id", eventIds),
    supabase.from("markets").select("id, name").in("id", marketIds),
    supabase.from("market_selections").select("id, name, value").in("id", selectionIds),
  ]);

  const teamIds = [...new Set((events ?? []).flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const selectionById = new Map((selections ?? []).map((s) => [s.id, s]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Bet History</h1>

      <div className="flex flex-col gap-3">
        {bets.map((b) => {
          const event = eventById.get(b.event_id);
          const market = marketById.get(b.market_id);
          const selection = selectionById.get(b.selection_id);
          const home = event ? teamById.get(event.home_team_id) : undefined;
          const away = event ? teamById.get(event.away_team_id) : undefined;

          return (
            <div key={b.id} className="card flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">
                  {home?.name ?? "TBD"} vs {away?.name ?? "TBD"}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {market?.name}: <span className="text-text-primary">{selection?.name}</span>
                  {selection?.value ? ` (${selection.value})` : ""}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Stake ${b.stake_amount.toFixed(2)} @ {b.odds_at_placement.toFixed(2)} — pays up to $
                  {b.potential_payout.toFixed(2)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${STATUS_STYLES[b.status] ?? "text-text-primary"}`}>{b.status}</p>
                <p className="text-xs text-text-secondary">{new Date(b.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)} basePath="/account/history" />
    </div>
  );
}
