import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Achievement criteria shapes. Stored as jsonb on `achievements.criteria`
 * so new achievement types don't need a migration — just a new case here
 * and a seeded row (see scripts/seed-games.ts).
 */
interface PredictionCountCriteria {
  type: "prediction_count";
  threshold: number;
}

interface WinCountCriteria {
  type: "win_count";
  threshold: number;
}

type AchievementCriteria = PredictionCountCriteria | WinCountCriteria;

/**
 * Checks every achievement definition against the user's current stats
 * and grants any newly-qualifying ones. Call this after any event that
 * could change a user's prediction/win count — currently just
 * `submitPrediction` (prediction_count) — settlement in Phase 4 should
 * call this too once it starts writing WON rows (win_count).
 *
 * Uses the service-role client since granting achievements is a system
 * action, not something the client should be able to trigger directly —
 * RLS on `user_achievements` only allows admin-role inserts.
 */
export async function evaluateAchievements(userId: string) {
  const supabase = createAdminClient();

  const [{ data: achievements }, { count: predictionCount }, { count: winCount }, { data: earned }] =
    await Promise.all([
      supabase.from("achievements").select("id, criteria"),
      supabase.from("predictions").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "WON"),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
    ]);

  const alreadyEarned = new Set((earned ?? []).map((e) => e.achievement_id));

  const newlyQualified = (achievements ?? []).filter((a) => {
    if (alreadyEarned.has(a.id)) return false;
    const criteria = a.criteria as unknown as AchievementCriteria;
    if (criteria.type === "prediction_count") return (predictionCount ?? 0) >= criteria.threshold;
    if (criteria.type === "win_count") return (winCount ?? 0) >= criteria.threshold;
    return false;
  });

  if (newlyQualified.length === 0) return [];

  const { data: inserted, error } = await supabase
    .from("user_achievements")
    .insert(newlyQualified.map((a) => ({ user_id: userId, achievement_id: a.id })))
    .select("achievement_id");

  if (error) {
    // Non-throwing: a failed achievement grant should never roll back the
    // prediction submission that triggered this check.
    console.error("Failed to grant achievements", { userId, error });
    return [];
  }

  return inserted ?? [];
}
