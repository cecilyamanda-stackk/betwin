import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";

/** /challenges — active/closed prediction challenges (section 19's mini-leaderboard groupings). */
export default async function ChallengesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: challenges } = await supabase
    .from("prediction_challenges")
    .select("id, name, slug, description, start_time, end_time, status")
    .neq("status", "DRAFT")
    .order("start_time", { ascending: false });

  if (!challenges || challenges.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Challenges</h1>
        <EmptyState title="No challenges yet." description="Challenges will appear here once an admin creates one." />
      </div>
    );
  }

  const challengeIds = challenges.map((c) => c.id);
  const { data: entries } = await supabase
    .from("challenge_entries")
    .select("challenge_id, user_id")
    .in("challenge_id", challengeIds);

  const entryCountByChallenge = new Map<string, number>();
  const joinedChallengeIds = new Set<string>();
  for (const e of entries ?? []) {
    entryCountByChallenge.set(e.challenge_id, (entryCountByChallenge.get(e.challenge_id) ?? 0) + 1);
    if (user && e.user_id === user.id) joinedChallengeIds.add(e.challenge_id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Challenges</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            slug={c.slug}
            name={c.name}
            description={c.description}
            startTime={c.start_time}
            endTime={c.end_time}
            entryCount={entryCountByChallenge.get(c.id) ?? 0}
            joined={joinedChallengeIds.has(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
