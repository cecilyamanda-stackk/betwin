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

export interface PlaceAccumulatorBetInput {
  selectionIds: string[];
  stakeAmount: number;
  /** Same reuse-on-retry convention as placeBet's idempotencyKey. */
  idempotencyKey?: string;
}

export interface PlaceAccumulatorBetResult {
  accumulatorBetId: string;
  totalOdds: number;
  potentialPayout: number;
}

/**
 * Accumulator (multiples) placement — one stake across every selection
 * in the slip, at their combined (multiplied) odds. Thin wrapper over
 * place_accumulator_bet (see supabase/migrations/0018_accumulator_bets.sql),
 * same reasoning as placeBet: the wallet debit and the bet/legs insert
 * have to be one atomic unit, which only a security-definer RPC
 * guarantees.
 */
export async function placeAccumulatorBet(
  input: PlaceAccumulatorBetInput
): Promise<ActionResult<PlaceAccumulatorBetResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to place a bet." };
  if (!(input.stakeAmount > 0)) {
    return { error: "Stake must be greater than zero." };
  }
  if (input.selectionIds.length < 2) {
    return { error: "An accumulator needs at least 2 selections." };
  }

  const { data, error } = await supabase
    .rpc("place_accumulator_bet", {
      p_selection_ids: input.selectionIds,
      p_stake_amount: input.stakeAmount,
      p_idempotency_key: input.idempotencyKey ?? null,
    })
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout"); // header balance display
  revalidatePath("/account/history"); // bet history

  return {
    data: {
      accumulatorBetId: data.accumulator_bet_id,
      totalOdds: data.total_odds,
      potentialPayout: data.potential_payout,
    },
  };
}

export interface CancelBetResult {
  refundedAmount: number;
}

/**
 * Lets a user undo a bet they didn't mean to place — most commonly the
 * "placed it twice by mistake" case, where Active Bets previously gave
 * them no way to fix it. Only reachable for a bet that's still PENDING
 * on an event that hasn't started; see cancel_bet in
 * supabase/migrations/0017_user_bet_cancellation.sql for the actual
 * refund + wallet-rebalancing logic, which this is a thin wrapper over,
 * same pattern as placeBet above.
 */
export async function cancelBet(betId: string): Promise<ActionResult<CancelBetResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be signed in to cancel a bet." };

  const { data, error } = await supabase.rpc("cancel_bet", { p_bet_id: betId }).single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout"); // header balance display
  revalidatePath("/account/history"); // Active Bets list

  return { data: { refundedAmount: data.refunded_amount } };
}
