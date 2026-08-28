"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface ProfileInput {
  username: string;
  displayName: string;
  country: string;
}

/**
 * Updates the caller's own profile fields. RLS's "Users can update their
 * own profile (not role)" policy is the real gate — this never touches
 * `role`, so its `with check` re-affirming the role stayed the same is
 * always satisfied here.
 */
export async function updateProfile(input: ProfileInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in." };

  const username = input.username.trim();
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return { error: "Username must be 3-32 characters: letters, numbers, and underscores only." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: input.displayName.trim() || null,
      country: input.country.trim() || null,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  return { data: { id: user.id } };
}
