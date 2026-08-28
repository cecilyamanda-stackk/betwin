"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/** Backs the leaderboard's "Friends" view (section 19) — see user_follows in 0003 migration. */
export async function followUser(userId: string): Promise<ActionResult<{ following: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in to follow other players." };
  if (user.id === userId) return { error: "You can't follow yourself." };

  const { error } = await supabase.from("user_follows").insert({ follower_id: user.id, followee_id: userId });
  // 23505 = already following — treat as success, not an error.
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  return { data: { following: true } };
}

export async function unfollowUser(userId: string): Promise<ActionResult<{ following: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in first." };

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", userId);

  if (error) return { error: error.message };

  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  return { data: { following: false } };
}
