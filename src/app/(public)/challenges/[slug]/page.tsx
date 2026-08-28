import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeaderboardTable, type LeaderboardRow } from "@/components/leaderboard/LeaderboardTable";
import { ChallengeJoinButton } from "@/components/challenges/ChallengeJoinButton";

/** /challenges/[slug] — challenge details + its own mini-leaderboard. */
export default async function ChallengeDetailPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: challenge } = await supabase
    .from("prediction_challenges")
    .select("id, name, slug, description, start_time, end_time, status")
    .eq("slug", params.slug)
    .neq("status", "DRAFT")
    .maybeSingle();

  if (!challenge) notFound();

  const { data: entries } = await supabase
    .from("challenge_entries")
    .select("user_id, points_earned")
    .eq("challenge_id", challenge.id)
    .order("points_earned", { ascending: false });

  const userIds = [...new Set((entries ?? []).map((e) => e.user_id))];
  // Uses the public_profile_cards RPC (0006 migration) rather than selecting
  // from `profiles` directly — narrows the columns visible for *other*
  // users' rows to username/display_name/avatar/country, never email.
  const { data: profiles } = userIds.length
    ? await supabase.rpc("get_profile_cards", { profile_ids: userIds })
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows: LeaderboardRow[] = (entries ?? []).map((e) => {
    const profile = profileById.get(e.user_id);
    return {
      userId: e.user_id,
      username: profile?.username ?? "unknown",
      displayName: profile?.display_name ?? null,
      points: e.points_earned,
    };
  });

  const joined = !!user && (entries ?? []).some((e) => e.user_id === user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{challenge.name}</h1>
            {challenge.description && <p className="mt-1 text-text-secondary">{challenge.description}</p>}
            <p className="mt-2 text-xs text-text-secondary">
              {new Date(challenge.start_time).toLocaleDateString()} –{" "}
              {new Date(challenge.end_time).toLocaleDateString()} · {challenge.status}
            </p>
          </div>
          <ChallengeJoinButton
            challengeId={challenge.id}
            slug={challenge.slug}
            initiallyJoined={joined}
            signedIn={!!user}
          />
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Standings</h2>
        {rows.length === 0 ? (
          <EmptyState title="No one has joined yet." description="Be the first to join this challenge." />
        ) : (
          <LeaderboardTable rows={rows} currentUserId={user?.id} />
        )}
      </section>
    </div>
  );
}
