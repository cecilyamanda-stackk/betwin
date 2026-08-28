"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface PlaceBetInput {
  selectionId: string;
  stakeAmount: number;
  /**
   * Client-generated (crypto.randomUUID()), same key reused on a retry
   * of the same bet-slip line item — never a fresh key per attempt. See
   * place_bet in the Phase 5 migration for the replay behavior this
   * enables: a retried request that already succeeded returns the same
   * bet again instead of placing a second one.
   */
  idempotencyKey?: string;
}

export interface PlaceBetResult {
  betId: string;
  oddsAtPlacement: number;
  potentialPayout: number;
}

/**
 * Wagering roadmap Phase 2 spec, Phase 3 wallet.
 *
 * All the actual logic — re-reading current_odds server-side (never a
 * client-supplied value), checking the event/market/selection are open,
 * confirming the wallet covers the stake, and writing the bet + its
 * debit transaction atomically — lives in the `place_bet` Postgres
 * function (see supabase/migrations/0009_phase3_wallet_transactions.sql).
 * This action is a thin, typed wrapper plus cache invalidation: a
 * security-definer RPC is what makes "debit the wallet and insert the
 * bet" actually atomic, which a multi-step Server Action using the
 * row-level-security client couldn't guarantee on its own.
 */
export async function placeBet(input: PlaceBetInput): Promise<ActionResult<PlaceBetResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to place a bet." };

  if (!(input.stakeAmount > 0)) {
    return { error: "Stake must be greater than zero." };
  }

  const { data, error } = await supabase
    .rpc("place_bet", {
      p_selection_id: input.selectionId,
      p_stake_amount: input.stakeAmount,
      p_idempotency_key: input.idempotencyKey ?? null,
    })
    .single();

  if (error) {
    // Postgres RAISE EXCEPTION messages (e.g. "Insufficient balance.",
    // "This market is closed for betting.") come through as error.message
    // and are already written to be shown to the user as-is.
    return { error: error.message };
  }

  revalidatePath("/", "layout"); // header balance display (Phase 4)
  revalidatePath("/predictions/history"); // bet history (Phase 6)

  return {
    data: {
      betId: data.bet_id,
      oddsAtPlacement: data.odds_at_placement,
      potentialPayout: data.potential_payout,
    },
  };
}
