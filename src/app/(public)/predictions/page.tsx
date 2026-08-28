import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventStatusBadge } from "@/components/admin/EventStatusBadge";

/** /predictions — the signed-in user's pending (unsettled) picks (section 16). */
export default async function PredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">My Predictions</h1>
        <EmptyState
          title="Sign in to see your predictions."
          description="Log in or create an account to start predicting."
          action={
            <Link href="/auth/login" className="btn-primary">
              Sign In
            </Link>
          }
        />
      </div>
    );
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, event_id, market_id, selection_id, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">My Predictions</h1>
        <EmptyState
          title="No pending predictions yet."
          description="Browse events and make your first prediction."
          action={
            <Link href="/sports" className="btn-primary">
              Browse Sports
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
    supabase.from("events").select("id, start_time, status, home_team_id, away_team_id").in("id", eventIds),
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
        <h1 className="font-display text-2xl font-bold">My Predictions</h1>
        <Link href="/predictions/history" className="text-sm text-gold hover:underline">
          View history
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
            <Link
              key={p.id}
              href={`/events/${event.id}`}
              className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-gold/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">
                  {home?.name ?? "TBD"} vs {away?.name ?? "TBD"}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {market?.name}: <span className="text-gold">{selection?.name}</span>
                </p>
              </div>
              <EventStatusBadge status={event.status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
