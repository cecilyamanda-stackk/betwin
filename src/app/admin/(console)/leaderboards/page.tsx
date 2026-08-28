import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";

interface LeaderboardRow {
  user_id: string;
  username: string;
  display_name: string | null;
  totalPoints: number;
  wins: number;
}

/**
 * /admin/leaderboards: read-only aggregation over the `leaderboard_scores`
 * view (Phase 3). There's no separate materialized table to "recompute" —
 * the view is derived live from settled predictions, so entering a result
 * in /admin/results is itself the recompute. This page exists for admins
 * to inspect standings and spot anomalies (e.g. a user with an unusually
 * high win rate worth investigating), with an optional competition filter.
 */
export default async function AdminLeaderboardsPage({
  searchParams,
}: {
  searchParams: { competition?: string };
}) {
  await requireAdmin();
  const { competition = "" } = searchParams;
  const supabase = await createClient();

  const { data: competitions } = await supabase.from("competitions").select("id, name").order("name");

  let query = supabase.from("leaderboard_scores").select("user_id, username, display_name, points_earned, competition_id");
  if (competition) {
    query = query.eq("competition_id", competition);
  }
  const { data: scores } = await query;

  const byUser = new Map<string, LeaderboardRow>();
  for (const s of scores ?? []) {
    const existing = byUser.get(s.user_id);
    if (existing) {
      existing.totalPoints += s.points_earned ?? 0;
      existing.wins += 1;
    } else {
      byUser.set(s.user_id, {
        user_id: s.user_id,
        username: s.username,
        display_name: s.display_name,
        totalPoints: s.points_earned ?? 0,
        wins: 1,
      });
    }
  }

  const rows = [...byUser.values()].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 100);

  const columns: AdminTableColumn<LeaderboardRow>[] = [
    {
      key: "rank",
      label: "#",
      render: (r) => rows.findIndex((row) => row.user_id === r.user_id) + 1,
      className: "w-10",
    },
    {
      key: "user",
      label: "User",
      render: (r) => (
        <div>
          <p className="font-semibold">{r.display_name ?? r.username}</p>
          <p className="text-xs text-text-secondary">@{r.username}</p>
        </div>
      ),
    },
    { key: "wins", label: "Won predictions", render: (r) => r.wins },
    { key: "points", label: "Total points", render: (r) => r.totalPoints },
  ];

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold">Leaderboards</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Live standings computed from settled predictions — entering a result in Results updates this
        automatically.
      </p>

      <form className="mb-4 flex gap-3" action="/admin/leaderboards" method="get">
        <select
          name="competition"
          defaultValue={competition}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60"
        >
          <option value="">All competitions</option>
          {(competitions ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <AdminTable
        columns={columns}
        rows={rows}
        keyField={(r) => r.user_id}
        emptyTitle="No settled predictions yet."
        emptyDescription="Standings will appear once results are entered and predictions settle."
      />
    </div>
  );
}
