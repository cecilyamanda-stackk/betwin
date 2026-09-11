import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BetStatus } from "@/types/database";

/**
 * One market pick, from either wager shape (see 0018_accumulator_bets.sql
 * for why they're two tables). A straight `bets` row is one Pick; an
 * accumulator contributes one Pick per leg — someone backing Arsenal
 * inside a 4-leg accumulator is still a bettor on Arsenal, so anything
 * that answers "who bet on this game" or "which side got more action"
 * needs to count legs exactly like single bets, not ignore them.
 *
 * `stakeAmount` and `potentialPayout` are the pick's own bet/slip values —
 * for an accumulator leg that means the WHOLE accumulator's stake and
 * payout, not a per-leg split (accumulators don't divide the stake across
 * legs; the full amount rides on every leg together). Do not sum these
 * across picks that share a `slipId` — that double/triple-counts a single
 * accumulator's stake once per leg. `oddsAtPlacement`, by contrast, IS
 * this pick's own value either way (a leg's individual odds, not the
 * accumulator's combined odds) since Postgres stores it per-leg.
 *
 * `status` and `slipStatus` are deliberately separate: a leg is graded
 * independently against its own event's result (`status`), while the
 * accumulator as a whole only resolves once every leg has (`slipStatus`,
 * from accumulator_bets.status — see finalize_accumulator_bets). For a
 * single bet the two are always identical, since there's no separate slip
 * to roll up from.
 */
export interface Pick {
  id: string; // bets.id, or accumulator_bet_legs.id
  slipId: string; // bets.id (same as id for a single) or accumulator_bets.id
  slipType: "single" | "accumulator";
  legCount: number; // 1 for a single; total legs in the slip for a combo pick
  userId: string;
  eventId: string;
  marketId: string;
  selectionId: string;
  stakeAmount: number;
  oddsAtPlacement: number;
  potentialPayout: number;
  status: BetStatus; // this pick's own status — a leg is graded independently of its slip
  slipStatus: BetStatus; // the whole bet/accumulator's rolled-up status
  createdAt: string;
}

/**
 * Fetches every pick across both wager shapes and flattens them into one
 * list. Three lean queries (no name joins — callers resolve
 * user/event/market/selection names themselves, the same way
 * /admin/predictions already does) rather than one heavy join, so this
 * stays cheap enough to call unpaginated — an accurate "which side is the
 * majority" read needs every pick on a market, not a page of them.
 */
export async function fetchAllPicks(supabase: SupabaseClient<Database>): Promise<Pick[]> {
  const [{ data: bets }, { data: accSlips }, { data: legs }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, user_id, event_id, market_id, selection_id, stake_amount, odds_at_placement, potential_payout, status, created_at"),
    supabase
      .from("accumulator_bets")
      .select("id, user_id, stake_amount, potential_payout, status, created_at"),
    supabase
      .from("accumulator_bet_legs")
      .select("id, accumulator_bet_id, event_id, market_id, selection_id, odds_at_placement, status, created_at"),
  ]);

  const singles: Pick[] = (bets ?? []).map((b) => ({
    id: b.id,
    slipId: b.id,
    slipType: "single" as const,
    legCount: 1,
    userId: b.user_id,
    eventId: b.event_id,
    marketId: b.market_id,
    selectionId: b.selection_id,
    stakeAmount: Number(b.stake_amount),
    oddsAtPlacement: Number(b.odds_at_placement),
    potentialPayout: Number(b.potential_payout),
    status: b.status,
    slipStatus: b.status,
    createdAt: b.created_at,
  }));

  const slipById = new Map((accSlips ?? []).map((s) => [s.id, s]));
  const legsBySlip = new Map<string, number>();
  for (const leg of legs ?? []) {
    legsBySlip.set(leg.accumulator_bet_id, (legsBySlip.get(leg.accumulator_bet_id) ?? 0) + 1);
  }

  const combos: Pick[] = (legs ?? [])
    .map((leg): Pick | null => {
      const slip = slipById.get(leg.accumulator_bet_id);
      if (!slip) return null;
      return {
        id: leg.id,
        slipId: slip.id,
        slipType: "accumulator" as const,
        legCount: legsBySlip.get(slip.id) ?? 1,
        userId: slip.user_id,
        eventId: leg.event_id,
        marketId: leg.market_id,
        selectionId: leg.selection_id,
        stakeAmount: Number(slip.stake_amount),
        oddsAtPlacement: Number(leg.odds_at_placement),
        potentialPayout: Number(slip.potential_payout),
        status: leg.status,
        slipStatus: slip.status,
        createdAt: leg.created_at,
      };
    })
    .filter((p): p is Pick => p !== null);

  return [...singles, ...combos];
}

export interface MarketTally {
  total: number;
  majorityCount: number;
  bySelection: Map<string, number>;
}

/** How many picks landed on each selection, per market — the basis for majority/minority. */
export function tallyByMarket(picks: Pick[]): Map<string, MarketTally> {
  const bySelectionRaw = new Map<string, Map<string, number>>();
  for (const p of picks) {
    if (!bySelectionRaw.has(p.marketId)) bySelectionRaw.set(p.marketId, new Map());
    const bySelection = bySelectionRaw.get(p.marketId)!;
    bySelection.set(p.selectionId, (bySelection.get(p.selectionId) ?? 0) + 1);
  }
  const result = new Map<string, MarketTally>();
  for (const [marketId, bySelection] of bySelectionRaw) {
    result.set(marketId, {
      total: [...bySelection.values()].reduce((a, b) => a + b, 0),
      majorityCount: Math.max(...bySelection.values()),
      bySelection,
    });
  }
  return result;
}

/** How many picks (singles + combo legs) reference each event — "how commonly shared" a game is. */
export function tallyByEvent(picks: Pick[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const p of picks) {
    result.set(p.eventId, (result.get(p.eventId) ?? 0) + 1);
  }
  return result;
}

/** A pick is against the crowd if its selection isn't tied for the most-picked in its market. */
export function isMajorityPick(pick: Pick, marketTally: Map<string, MarketTally>): boolean {
  const tally = marketTally.get(pick.marketId);
  if (!tally) return true;
  return (tally.bySelection.get(pick.selectionId) ?? 0) === tally.majorityCount;
}

export interface SlipTotal {
  stakeAmount: number;
  potentialPayout: number;
  status: BetStatus;
}

/**
 * Collapses picks down to one entry per slip (bet or accumulator) —
 * every leg of the same accumulator repeats that slip's stake/payout, so
 * summing money figures over the raw Pick list overcounts a combo once
 * per leg. Use this whenever a total needs to reflect what was actually
 * staked/at risk, e.g. "total staked" or "pending payout exposure".
 */
export function dedupeSlips(picks: Pick[]): SlipTotal[] {
  const seen = new Map<string, SlipTotal>();
  for (const p of picks) {
    if (!seen.has(p.slipId)) {
      seen.set(p.slipId, { stakeAmount: p.stakeAmount, potentialPayout: p.potentialPayout, status: p.slipStatus });
    }
  }
  return [...seen.values()];
}

export interface EnrichedPick extends Pick {
  username: string;
  eventLabel: string;
  kickoff: string;
  marketName: string;
  selectionName: string;
  selectionShare: number; // 0-100, this pick's share of picks on its market
  isMajority: boolean;
  isBonusCandidate: boolean; // WON + went against the market's majority pick
}

export interface PickLookups {
  usernameById: Map<string, string>;
  eventLabelById: Map<string, string>;
  kickoffById: Map<string, string>;
  marketNameById: Map<string, string>;
  selectionNameById: Map<string, string>;
}

/**
 * Attaches display names + the majority/minority read to every pick.
 * Shared by /admin/bets (the flat ledger) and /admin/bettors (the
 * game-grouped roster) so the two pages can never disagree about which
 * pick counts as "majority" or a "bonus candidate" — one definition, two
 * views over it.
 */
export function enrichPicks(
  picks: Pick[],
  marketTally: Map<string, MarketTally>,
  lookups: PickLookups
): EnrichedPick[] {
  return picks.map((pick) => {
    const tally = marketTally.get(pick.marketId)!;
    const selectionCount = tally.bySelection.get(pick.selectionId) ?? 0;
    const majority = isMajorityPick(pick, marketTally);
    return {
      ...pick,
      username: lookups.usernameById.get(pick.userId) ?? "—",
      eventLabel: lookups.eventLabelById.get(pick.eventId) ?? "—",
      kickoff: lookups.kickoffById.get(pick.eventId) ?? "",
      marketName: lookups.marketNameById.get(pick.marketId) ?? "—",
      selectionName: lookups.selectionNameById.get(pick.selectionId) ?? "—",
      selectionShare: tally.total ? Math.round((selectionCount / tally.total) * 100) : 100,
      isMajority: majority,
      isBonusCandidate: pick.status === "WON" && !majority,
    };
  });
}
