import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeaderboardTable, type LeaderboardRow } from "@/components/leaderboard/LeaderboardTable";
import { CompetitionFilter } from "@/components/leaderboard/CompetitionFilter";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";

const TABS = [
  { id: "global", label: "Global" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "friends", label: "Friends" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * /leaderboard — Global/Weekly/Monthly/Friends views, optionally scoped
 * to one competition (section 19). Tabs are plain links (?tab=...) rather
 * than client state, since each tab needs a different server query.
 *
 * Scores read from the `leaderboard_scores` view, which only has rows
 * once Phase 4 settlement starts marking predictions WON — until then
 * every tab honestly shows its empty state instead of a fabricated board.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { tab?: string; competition?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeTab: TabId = TABS.some((t) => t.id === searchParams.tab) ? (searchParams.tab as TabId) : "global";

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, slug")
    .eq("active", true)
    .order("name");

  const selectedCompetition = searchParams.competition
    ? (competitions ?? []).find((c) => c.slug === searchParams.competition)
    : undefined;

  let followingIds: string[] = [];
  if (user) {
    const { data: follows } = await supabase.from("user_follows").select("followee_id").eq("follower_id", user.id);
    followingIds = (follows ?? []).map((f) => f.followee_id);
  }

  let scores: { user_id: string; username: string; display_name: string | null; points_earned: number | null }[] = [];

  if (activeTab !== "friends" || followingIds.length > 0) {
    let query = supabase
      .from("leaderboard_scores")
      .select("user_id, username, display_name, points_earned, settled_at, competition_id");

    if (activeTab === "weekly") {
      query = query.gte("settled_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } else if (activeTab === "monthly") {
      query = query.gte("settled_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    } else if (activeTab === "friends") {
      query = query.in("user_id", followingIds);
    }

    if (selectedCompetition) {
      query = query.eq("competition_id", selectedCompetition.id);
    }

    const { data } = await query;
    scores = data ?? [];
  }

  const totals = new Map<string, { username: string; displayName: string | null; points: number }>();
  for (const row of scores) {
    const existing = totals.get(row.user_id) ?? { username: row.username, displayName: row.display_name, points: 0 };
    existing.points += row.points_earned ?? 0;
    totals.set(row.user_id, existing);
  }
  const rows: LeaderboardRow[] = [...totals.entries()]
    .map(([userId, v]) => ({ userId, username: v.username, displayName: v.displayName, points: v.points }))
    .sort((a, b) => b.points - a.points);

  const emptyTitle =
    activeTab === "friends" && followingIds.length === 0
      ? "You're not following anyone yet."
      : "No scored predictions yet.";
  const emptyDescription =
    activeTab === "friends"
      ? "Follow other players from the Global tab to see them here."
      : "Standings appear once an admin settles event results.";

  return (
    <div className="flex flex-col gap-6">
      {/* Standings recompute the moment an admin settles a market (section 38). */}
      <RealtimeRefresher table="markets" />

      <h1 className="font-display text-2xl font-bold">Leaderboard</h1>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`/leaderboard?tab=${t.id}${selectedCompetition ? `&competition=${selectedCompetition.slug}` : ""}`}
            className={`pill ${activeTab === t.id ? "pill-selected" : ""}`}
          >
            {t.label}
          </a>
        ))}
        {competitions && competitions.length > 0 && (
          <CompetitionFilter
            competitions={competitions.map((c) => ({ slug: c.slug, name: c.name }))}
            selectedSlug={selectedCompetition?.slug}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <LeaderboardTable rows={rows} currentUserId={user?.id} followingIds={new Set(followingIds)} />
      )}
    </div>
  );
}
