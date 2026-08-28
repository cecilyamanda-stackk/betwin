import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import { EmptyState } from "@/components/ui/EmptyState";

/** /profile — signed-in user's own stats, recent achievements, and social counts (section 18). */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, country")
    .eq("id", user.id)
    .single();

  const [
    { count: totalPredictions },
    { count: wonPredictions },
    { data: pointsRows },
    { data: earnedRows },
    { count: followerCount },
    { count: followingCount },
  ] = await Promise.all([
    supabase.from("predictions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "WON"),
    supabase.from("predictions").select("points_earned").eq("user_id", user.id).eq("status", "WON"),
    supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false })
      .limit(3),
    supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", user.id),
    supabase.from("user_follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", user.id),
  ]);

  const totalPoints = (pointsRows ?? []).reduce((sum, r) => sum + (r.points_earned ?? 0), 0);

  const achievementIds = (earnedRows ?? []).map((r) => r.achievement_id);
  const { data: achievementDefs } = achievementIds.length
    ? await supabase.from("achievements").select("id, name, description, icon").in("id", achievementIds)
    : { data: [] };
  const achievementById = new Map((achievementDefs ?? []).map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-8">
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {profile?.display_name || profile?.username}
          </h1>
          <p className="text-sm text-text-secondary">
            @{profile?.username}
            {profile?.country ? ` · ${profile.country}` : ""}
          </p>
        </div>
        <Link href="/account" className="btn-secondary">
          Edit Profile
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Predictions" value={totalPredictions ?? 0} />
        <Stat label="Won" value={wonPredictions ?? 0} />
        <Stat label="Points" value={totalPoints} />
        <Stat label="Followers" value={followerCount ?? 0} />
        <Stat label="Following" value={followingCount ?? 0} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent Achievements</h2>
          <Link href="/profile/achievements" className="text-sm text-gold hover:underline">
            View all
          </Link>
        </div>
        {(earnedRows ?? []).length === 0 ? (
          <EmptyState title="No achievements yet." description="Submit your first prediction to start earning badges." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(earnedRows ?? []).map((r) => {
              const def = achievementById.get(r.achievement_id);
              if (!def) return null;
              return (
                <AchievementBadge
                  key={r.achievement_id}
                  icon={def.icon}
                  name={def.name}
                  description={def.description}
                  earned
                  earnedAt={r.earned_at}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-display text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{label}</p>
    </div>
  );
}
