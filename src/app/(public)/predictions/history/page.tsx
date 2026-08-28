import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

const RESULT_STYLES: Record<string, string> = {
  WON: "text-success",
  LOST: "text-live",
  VOID: "text-text-secondary",
};

/** /predictions/history — settled picks with their outcome (section 16). */
export default async function PredictionHistoryPage({
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
        <h1 className="font-display text-2xl font-bold">Prediction History</h1>
        <EmptyState
          title="Sign in to see your history."
          description="Log in or create an account to see settled predictions."
          action={
            <Link href="/auth/login" className="btn-primary">
              Sign In
            </Link>
          }
        />
      </div>
    );
  }

  const { data: predictions, count } = await supabase
    .from("predictions")
    .select("id, event_id, market_id, selection_id, status, points_earned, settled_at", { count: "exact" })
    .eq("user_id", user.id)
    .neq("status", "PENDING")
    .order("settled_at", { ascending: false })
    .range(...pageRange(page));

  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Prediction History</h1>
        <EmptyState
          title="No settled predictions yet."
          description="Once an admin settles an event's results, your outcomes will show up here."
          action={
            <Link href="/predictions" className="btn-secondary">
              View pending predictions
            </Link>
          }
        />
      </div>
    );
  }

  const eventIds = [...new Set(predictions.map((p) => p.event_id))];
  const marketIds = [...new Set(predictions.map((p) => p.market_id))];
  const selectionIds = [...new Set(predictions.map((p) => p.selection_id))];

  const [{ data: events }, { data: markets }, { data: selections }] = await Promise.all([
    supabase.from("events").select("id, home_team_id, away_team_id").in("id", eventIds),
    supabase.from("markets").select("id, name").in("id", marketIds),
    supabase.from("market_selections").select("id, name").in("id", selectionIds),
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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Prediction History</h1>
        <Link href="/predictions" className="text-sm text-gold hover:underline">
          View pending
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {predictions.map((p) => {
          const event = eventById.get(p.event_id);
          const market = marketById.get(p.market_id);
          const selection = selectionById.get(p.selection_id);
          if (!event) return null;
          const home = teamById.get(event.home_team_id);
          const away = teamById.get(event.away_team_id);

          return (
            <div key={p.id} className="card flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">
                  {home?.name ?? "TBD"} vs {away?.name ?? "TBD"}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {market?.name}: <span className="text-text-primary">{selection?.name}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${RESULT_STYLES[p.status] ?? "text-text-primary"}`}>
                  {p.status}
                </p>
                {p.points_earned !== null && (
                  <p className="text-xs text-text-secondary">{p.points_earned} pts</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)}
        basePath="/predictions/history"
      />
    </div>
  );
}
