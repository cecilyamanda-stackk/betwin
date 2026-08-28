import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import { EmptyState } from "@/components/ui/EmptyState";

/** /profile/achievements — every achievement definition, earned or locked (section 17). */
export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: achievements }, { data: earned }] = await Promise.all([
    supabase.from("achievements").select("id, name, description, icon").order("created_at"),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
  ]);

  const earnedByAchievement = new Map((earned ?? []).map((e) => [e.achievement_id, e.earned_at]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Achievements</h1>

      {!achievements || achievements.length === 0 ? (
        <EmptyState title="No achievements defined yet." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <AchievementBadge
              key={a.id}
              icon={a.icon}
              name={a.name}
              description={a.description}
              earned={earnedByAchievement.has(a.id)}
              earnedAt={earnedByAchievement.get(a.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
