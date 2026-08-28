"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { evaluateAchievements } from "@/lib/achievements/evaluate";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface PredictionInput {
  eventId: string;
  marketId: string;
  selectionId: string;
}

/**
 * Submits (or changes) a user's pick for a market. One pick per
 * user/event/market, enforced by the `predictions_one_pick_per_market`
 * unique constraint — this upserts on that key so re-picking before the
 * market closes just updates the existing row. RLS's "own pending
 * predictions" update policy is what actually blocks changing a pick
 * after it's been settled; the checks below are the honest user-facing
 * error messages for the same rule.
 */
export async function submitPrediction(input: PredictionInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to predict." };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", input.eventId)
    .single();

  if (eventError || !event) return { error: "Event not found." };
  if (event.status !== "PUBLISHED" && event.status !== "LIVE") {
    return { error: "Predictions are closed for this event." };
  }

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("id, status, event_id")
    .eq("id", input.marketId)
    .single();

  if (marketError || !market || market.event_id !== input.eventId) {
    return { error: "Market not found." };
  }
  if (market.status !== "OPEN") {
    return { error: "This market is closed for predictions." };
  }

  const { data: selection, error: selectionError } = await supabase
    .from("market_selections")
    .select("id, market_id, active")
    .eq("id", input.selectionId)
    .single();

  if (selectionError || !selection || selection.market_id !== input.marketId || !selection.active) {
    return { error: "Selection not found." };
  }

  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: user.id,
        event_id: input.eventId,
        market_id: input.marketId,
        selection_id: input.selectionId,
        status: "PENDING",
      },
      { onConflict: "user_id,event_id,market_id" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  await evaluateAchievements(user.id);

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath("/predictions");
  revalidatePath("/profile");
  return { data };
}
