"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/auth/audit";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/**
 * Records a market's winning selection and settles every PENDING
 * prediction on it (section 24). Re-callable: if a result needs
 * correcting, call again with a different selection — settle_market only
 * ever touches rows still PENDING, so this alone won't re-settle
 * predictions that were already paid out under the old (wrong) result.
 * Use `resettleMarket` for that.
 */
export async function setMarketResult(
  marketId: string,
  eventId: string,
  winningSelectionId: string
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data: market, error: fetchError } = await supabase
    .from("markets")
    .select("winning_selection_id")
    .eq("id", marketId)
    .single();

  if (fetchError || !market) return { error: "Market not found." };

  const isCorrection = market.winning_selection_id !== null;

  const { error: updateError } = await supabase
    .from("markets")
    .update({ winning_selection_id: winningSelectionId, status: "SETTLED" })
    .eq("id", marketId);
  if (updateError) return { error: updateError.message };

  const { error: settleError } = await supabase.rpc("settle_market", {
    p_market_id: marketId,
    p_winning_selection_id: winningSelectionId,
  });
  if (settleError) return { error: settleError.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: isCorrection ? "RESULT_CHANGED" : "RESULT_ENTERED",
    entityType: "RESULT",
    entityId: marketId,
    metadata: { eventId, winningSelectionId },
  });

  revalidatePath("/admin/results");
  revalidatePath("/admin/predictions");
  revalidatePath(`/admin/events/${eventId}`);
  return { data: { id: marketId } };
}

/**
 * Re-opens an already-settled market back to PENDING for every one of its
 * predictions, then re-settles against a corrected winning selection.
 * Use this (instead of setMarketResult) when a result was entered wrong
 * and predictions have already been marked WON/LOST.
 */
export async function resettleMarket(
  marketId: string,
  eventId: string,
  winningSelectionId: string
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error: reopenError } = await supabase
    .from("predictions")
    .update({ status: "PENDING", points_earned: null, settled_at: null })
    .eq("market_id", marketId);
  if (reopenError) return { error: reopenError.message };

  // setMarketResult writes its own RESULT_CHANGED audit entry once it
  // sees the market already had a winning_selection_id.
  return setMarketResult(marketId, eventId, winningSelectionId);
}

/**
 * Wagering roadmap Phase 2 counterpart to resettleMarket, now wallet-aware
 * (Phase 3): reopen_bets_for_event reverses whatever settle_bets_for_event
 * already paid out for this event's WON/VOID bets — crediting/debiting the
 * wallet back and logging the reversal as its own transaction — before
 * resetting those bets to PENDING, then settle_bets_for_event re-grades
 * and re-pays them against the corrected score. Without the reversal step
 * a re-settle after a score correction could pay a bet out twice.
 */
export async function resettleEventBets(eventId: string): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error: reopenError } = await supabase.rpc("reopen_bets_for_event", { p_event_id: eventId });
  if (reopenError) return { error: reopenError.message };

  const { error: settleError } = await supabase.rpc("settle_bets_for_event", { p_event_id: eventId });
  if (settleError) return { error: settleError.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "RESULT_CHANGED",
    entityType: "RESULT",
    entityId: eventId,
    metadata: { scope: "bets", eventId },
  });

  revalidatePath("/admin/results");
  revalidatePath(`/admin/events/${eventId}`);
  return { data: { id: eventId } };
}
