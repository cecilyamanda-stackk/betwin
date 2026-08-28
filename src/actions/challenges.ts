"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function joinChallenge(challengeId: string, slug: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in to join a challenge." };

  const { data, error } = await supabase
    .from("challenge_entries")
    .insert({ challenge_id: challengeId, user_id: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "You've already joined this challenge." };
    return { error: error.message };
  }

  revalidatePath(`/challenges/${slug}`);
  revalidatePath("/challenges");
  return { data };
}

export async function leaveChallenge(challengeId: string, slug: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sign in first." };

  const { error } = await supabase
    .from("challenge_entries")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/challenges/${slug}`);
  revalidatePath("/challenges");
  return { data: { id: challengeId } };
}
