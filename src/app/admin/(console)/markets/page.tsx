import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AdminTable } from "@/components/admin/AdminTable";
import Link from "next/link";

const MARKET_TYPE_LABEL: Record<string, string> = {
  MATCH_RESULT: "Match Result (points game)",
  CORRECT_SCORE: "Correct Score (points game)",
  TOTAL_GOALS: "Total Goals (points game)",
  BOTH_TEAMS_SCORE: "Both Teams Score (points game)",
  OTHER: "Other",
  // Wagering roadmap Phase 1
  MATCH_WINNER_3WAY: "Match Winner — 1X2",
  MONEYLINE: "Moneyline",
  OVER_UNDER: "Over/Under",
  HANDICAP: "Handicap",
  BOTH_TEAMS_TO_SCORE: "Both Teams to Score",
  DOUBLE_CHANCE: "Double Chance",
  EXACT_SCORE: "Exact Score",
};

/**
 * Cross-event oversight of every market in the catalogue. Markets are
 * created and edited from the parent event's page (the builder in
 * events/[id]) — this page is a read-only index so admins can find one
 * without knowing which event it lives under.
 */
export default async function AdminMarketsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: markets }, { data: events }, { data: teams }, { data: selections }] =
    await Promise.all([
      supabase
        .from("markets")
        .select("id, event_id, name, type, status, line_value")
        .order("created_at", { ascending: false }),
      supabase.from("events").select("id, home_team_id, away_team_id"),
      supabase.from("teams").select("id, name"),
      supabase.from("market_selections").select("id, market_id"),
    ]);

  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const selectionCountByMarket = new Map<string, number>();
  for (const s of selections ?? []) {
    selectionCountByMarket.set(s.market_id, (selectionCountByMarket.get(s.market_id) ?? 0) + 1);
  }

  const rows = (markets ?? []).map((m) => {
    const ev = eventById.get(m.event_id);
    return {
      ...m,
      matchup: ev
        ? `${teamNameById.get(ev.home_team_id) ?? "—"} vs ${teamNameById.get(ev.away_team_id) ?? "—"}`
        : "—",
      selectionCount: selectionCountByMarket.get(m.id) ?? 0,
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Markets</h1>
      </div>

      <AdminTable
        rows={rows}
        keyField={(m) => m.id}
        emptyTitle="No markets yet."
        emptyDescription="Markets are created from an event's page — open an event and add one there."
        columns={[
          { key: "name", label: "Market", render: (m) => m.name },
          { key: "type", label: "Type", render: (m) => MARKET_TYPE_LABEL[m.type] ?? m.type },
          { key: "line", label: "Line", render: (m) => (m.line_value !== null ? m.line_value : "—") },
          { key: "status", label: "Status", render: (m) => m.status },
          { key: "selections", label: "Selections", render: (m) => m.selectionCount },
          {
            key: "event",
            label: "Event",
            render: (m) => (
              <Link href={`/admin/events/${m.event_id}`} className="text-gold hover:text-gold-hover">
                {m.matchup}
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
