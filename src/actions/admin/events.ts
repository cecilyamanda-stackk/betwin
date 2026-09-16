"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog, type AuditAction } from "@/lib/auth/audit";
import {
  LINE_VALUE_MARKET_TYPES,
  OUTCOME_CODES_BY_MARKET_TYPE,
  isWageringMarketType,
  isExactScoreMarketType,
  isValidExactScoreValue,
  EXACT_SCORE_OTHER_VALUE,
} from "@/lib/markets/wagering";
import type { EventStatus, MarketType, SelectionOutcomeCode } from "@/types/database";

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export interface EventInput {
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  startTime: string; // ISO string
}

export async function createEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();

  if (input.homeTeamId === input.awayTeamId) {
    return { error: "Home and away team must be different." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      competition_id: input.competitionId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      start_time: input.startTime,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "EVENT_CREATED",
    entityType: "EVENT",
    entityId: data.id,
    metadata: { competitionId: input.competitionId, startTime: input.startTime },
  });

  revalidatePath("/admin/events");
  return { data };
}

export async function updateEvent(
  id: string,
  input: EventInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();

  if (input.homeTeamId === input.awayTeamId) {
    return { error: "Home and away team must be different." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({
      competition_id: input.competitionId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      start_time: input.startTime,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "EVENT_UPDATED",
    entityType: "EVENT",
    entityId: id,
    metadata: { ...input },
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  return { data: { id } };
}

// Allowed forward/lateral transitions for the event state machine
// (ROADMAP.md / spec section 23). SUSPENDED can resume back to LIVE.
// Anything not listed here is rejected, so a bad button click or a
// replayed request can never skip a state.
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["LIVE", "SUSPENDED", "CANCELLED"],
  LIVE: ["SUSPENDED", "FINISHED"],
  SUSPENDED: ["LIVE", "CANCELLED", "FINISHED"],
  FINISHED: [],
  CANCELLED: [],
};

const STATUS_AUDIT_ACTION: Record<EventStatus, AuditAction> = {
  DRAFT: "EVENT_UPDATED",
  PUBLISHED: "EVENT_PUBLISHED",
  LIVE: "EVENT_RESUMED",
  SUSPENDED: "EVENT_SUSPENDED",
  FINISHED: "EVENT_FINISHED",
  CANCELLED: "EVENT_CANCELLED",
};

export async function updateEventStatus(
  id: string,
  targetStatus: EventStatus,
  scores?: { homeScore: number; awayScore: number }
): Promise<ActionResult<{ id: string; status: EventStatus }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from("events")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !current) return { error: "Event not found." };

  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(targetStatus)) {
    return { error: `Cannot move an event from ${current.status} to ${targetStatus}.` };
  }
  if (targetStatus === "FINISHED" && !scores) {
    return { error: "A final score is required to mark an event FINISHED." };
  }

  const { error } = await supabase
    .from("events")
    .update({
      status: targetStatus,
      ...(scores ? { home_score: scores.homeScore, away_score: scores.awayScore } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Wagering roadmap Phase 2: unlike the points game's markets (which
  // stay OPEN until an admin manually picks a winning selection on the
  // Results page), the six wagering market types settle automatically
  // the moment a final score exists. Errors here are surfaced but don't
  // roll back the status change above — same non-atomic-across-calls
  // trade-off the existing setMarketResult/settle_market pair already
  // makes; a failed settlement can be retried via resettleEventBets.
  if (targetStatus === "FINISHED" && scores) {
    const { error: settleError } = await supabase.rpc("settle_bets_for_event", { p_event_id: id });
    if (settleError) return { error: `Event marked FINISHED, but settling bets failed: ${settleError.message}` };
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: STATUS_AUDIT_ACTION[targetStatus],
    entityType: "EVENT",
    entityId: id,
    metadata: { from: current.status, to: targetStatus, ...scores },
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  return { data: { id, status: targetStatus } };
}

// Market types that compare a score/stat against a line (Phase 1 of the
// wagering roadmap) — the admin form only shows the line_value input for
// these. Shared with the client component from lib/markets/wagering so
// the server-side gate and the UI gate can't drift apart.

export interface MarketInput {
  eventId: string;
  name: string;
  type: MarketType;
  /** Required for OVER_UNDER/HANDICAP, ignored for every other type. */
  lineValue?: number;
}

export async function createMarket(input: MarketInput): Promise<
  ActionResult<{ id: string; name: string; type: MarketType; status: string; line_value: number | null }>
> {
  const { user } = await requireAdmin();

  const needsLine = LINE_VALUE_MARKET_TYPES.includes(input.type);
  if (needsLine && (input.lineValue === undefined || Number.isNaN(input.lineValue))) {
    return { error: `${input.type.replace(/_/g, " ")} markets require a line value.` };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .insert({
      event_id: input.eventId,
      name: input.name,
      type: input.type,
      line_value: needsLine ? input.lineValue : null,
    })
    .select("id, name, type, status, line_value")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "MARKET_CREATED",
    entityType: "MARKET",
    entityId: data.id,
    metadata: { eventId: input.eventId, name: input.name, type: input.type, lineValue: input.lineValue },
  });

  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath("/admin/markets");
  return { data };
}

export interface SelectionInput {
  marketId: string;
  eventId: string; // only used to revalidate the right event detail page
  name: string;
  value?: string;
  /** Decimal odds shown to users. Optional — a selection can be created
   *  before it's priced and given odds later via updateSelectionOdds. */
  currentOdds?: number;
  /** Internal risk-desk figure, 0–1. Never returned to non-admin clients
   *  (enforced by column-level DB grants, not just by this action). */
  trueProbability?: number;
  /** Required on the six wagering market types (Phase 2's
   *  settle_bets_for_event needs it to grade the bet); ignored/nulled on
   *  every other market type, which stays manually settled by an admin
   *  picking a winning_selection_id like before. */
  outcomeCode?: SelectionOutcomeCode;
}

function validateOdds(currentOdds?: number, trueProbability?: number): string | undefined {
  if (currentOdds !== undefined && !(currentOdds > 1)) {
    return "Odds must be greater than 1.00.";
  }
  if (trueProbability !== undefined && (trueProbability < 0 || trueProbability > 1)) {
    return "True probability must be between 0 and 1.";
  }
  return undefined;
}

/**
 * Validates outcomeCode against the market it's being attached to:
 * required and must be one of the fixed codes for wagering market types,
 * disallowed (nulled, not errored — simplest UX for a stray value) for
 * every other type since points-game settlement never reads it.
 */
function resolveOutcomeCode(
  marketType: MarketType,
  outcomeCode: SelectionOutcomeCode | undefined
): { value: SelectionOutcomeCode | null; error?: string } {
  // Exact Score is a wagering type but doesn't use the fixed outcome_code
  // vocabulary — scorelines are unbounded, so settlement reads `value`
  // instead (see settle_bets_for_event's Exact Score block).
  if (!isWageringMarketType(marketType) || isExactScoreMarketType(marketType)) {
    return { value: null };
  }
  const allowed = OUTCOME_CODES_BY_MARKET_TYPE[marketType] ?? [];
  if (!outcomeCode) {
    return { value: null, error: "This market type needs an outcome code so it can be settled automatically." };
  }
  if (!allowed.some((c) => c.value === outcomeCode)) {
    return { value: null, error: `"${outcomeCode}" isn't a valid outcome for this market type.` };
  }
  return { value: outcomeCode };
}

export async function createSelection(
  input: SelectionInput
): Promise<
  ActionResult<{
    id: string;
    market_id: string;
    name: string;
    value: string | null;
    active: boolean;
    current_odds: number | null;
    outcome_code: SelectionOutcomeCode | null;
  }>
> {
  const { user } = await requireAdmin();

  const oddsError = validateOdds(input.currentOdds, input.trueProbability);
  if (oddsError) return { error: oddsError };

  const supabase = createAdminClient();

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("type")
    .eq("id", input.marketId)
    .single();
  if (marketError || !market) return { error: "Market not found." };

  const outcome = resolveOutcomeCode(market.type, input.outcomeCode);
  if (outcome.error) return { error: outcome.error };

  if (isExactScoreMarketType(market.type)) {
    const scoreValue = (input.value ?? "").trim();
    if (!isValidExactScoreValue(scoreValue)) {
      return { error: 'Score must be "<home>-<away>" (e.g. "2-1"), or "OTHER" for any other score.' };
    }
  }

  const { data, error } = await supabase
    .from("market_selections")
    .insert({
      market_id: input.marketId,
      name: input.name,
      value: input.value || null,
      current_odds: input.currentOdds ?? null,
      true_probability: input.trueProbability ?? null,
      outcome_code: outcome.value,
    })
    .select("id, market_id, name, value, active, current_odds, outcome_code")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SELECTION_CREATED",
    entityType: "MARKET",
    entityId: input.marketId,
    metadata: { name: input.name, value: input.value, currentOdds: input.currentOdds, outcomeCode: outcome.value },
  });

  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath("/admin/markets");
  return { data };
}

export interface SelectionOddsInput {
  selectionId: string;
  marketId: string;
  eventId: string; // only used to revalidate the right event detail page
  currentOdds?: number;
  trueProbability?: number;
}

/**
 * Re-prices an existing selection. Separate from createSelection so the
 * odds-adjustment UI (and its own audit trail entry) can be reused once a
 * market is already live with bets against it — Phase 2's placeBet
 * re-reads current_odds at placement time, so this is the only path that
 * changes what a *new* bet locks in; it never touches odds_at_placement
 * on bets already placed.
 */
export async function updateSelectionOdds(
  input: SelectionOddsInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();

  const oddsError = validateOdds(input.currentOdds, input.trueProbability);
  if (oddsError) return { error: oddsError };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_selections")
    .update({
      ...(input.currentOdds !== undefined ? { current_odds: input.currentOdds } : {}),
      ...(input.trueProbability !== undefined ? { true_probability: input.trueProbability } : {}),
    })
    .eq("id", input.selectionId);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SELECTION_ODDS_UPDATED",
    entityType: "MARKET",
    entityId: input.marketId,
    metadata: { selectionId: input.selectionId, currentOdds: input.currentOdds },
  });

  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath("/admin/markets");
  return { data: { id: input.selectionId } };
}

// ── Exact Score grid builder ───────────────────────────────────────────
// One at a time via createSelection is fine for a 1X2 market, but Exact
// Score markets routinely need 10-20+ priced scorelines. This bulk path
// backs the admin's score-grid form: admin only types the odds for the
// scorelines they want to offer, blank rows are skipped.

export interface ExactScoreLine {
  /** "<home>-<away>" (e.g. "2-1") or the "OTHER" catch-all. */
  score: string;
  odds: number;
}

export interface CreatedSelection {
  id: string;
  market_id: string;
  name: string;
  value: string | null;
  active: boolean;
  current_odds: number | null;
  outcome_code: SelectionOutcomeCode | null;
}

export async function createExactScoreSelections(input: {
  marketId: string;
  eventId: string;
  lines: ExactScoreLine[];
}): Promise<ActionResult<{ count: number; selections: CreatedSelection[] }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("type")
    .eq("id", input.marketId)
    .single();
  if (marketError || !market) return { error: "Market not found." };
  if (!isExactScoreMarketType(market.type)) return { error: "This isn't an Exact Score market." };

  if (input.lines.length === 0) {
    return { error: "Enter odds for at least one score." };
  }
  for (const line of input.lines) {
    if (!isValidExactScoreValue(line.score)) {
      return { error: `"${line.score}" isn't a valid score.` };
    }
    if (!(line.odds > 1)) {
      return { error: `Odds for ${line.score} must be greater than 1.00.` };
    }
  }
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (seen.has(line.score)) return { error: `"${line.score}" was entered more than once.` };
    seen.add(line.score);
  }

  const { data: existing } = await supabase
    .from("market_selections")
    .select("value")
    .eq("market_id", input.marketId);
  const existingValues = new Set((existing ?? []).map((s) => s.value));
  const newLines = input.lines.filter((l) => !existingValues.has(l.score));
  if (newLines.length === 0) {
    return { error: "Every one of those scores is already priced on this market." };
  }

  const { data: inserted, error } = await supabase
    .from("market_selections")
    .insert(
      newLines.map((l) => ({
        market_id: input.marketId,
        name: l.score === EXACT_SCORE_OTHER_VALUE ? "Any other score" : l.score,
        value: l.score,
        current_odds: l.odds,
        outcome_code: null,
      }))
    )
    .select("id, market_id, name, value, active, current_odds, outcome_code");
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SELECTION_CREATED",
    entityType: "MARKET",
    entityId: input.marketId,
    metadata: { bulk: true, count: newLines.length, scores: newLines.map((l) => l.score) },
  });

  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath("/admin/markets");
  return { data: { count: newLines.length, selections: inserted ?? [] } };
}

// ── Market/selection management ─────────────────────────────────────────
// Deletion is guarded against real money: a market or selection that
// already has bets (or points-game predictions) against it never gets
// deleted out from under those rows — `active` is the safe way to pull a
// selection out of rotation without touching betting/audit history.

export interface MarketUpdateInput {
  name: string;
  /** Required for OVER_UNDER/HANDICAP, ignored for every other type. */
  lineValue?: number;
}

export async function updateMarket(
  marketId: string,
  eventId: string,
  input: MarketUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { data: market, error: fetchError } = await supabase
    .from("markets")
    .select("type")
    .eq("id", marketId)
    .single();
  if (fetchError || !market) return { error: "Market not found." };

  const needsLine = LINE_VALUE_MARKET_TYPES.includes(market.type);
  if (needsLine && (input.lineValue === undefined || Number.isNaN(input.lineValue))) {
    return { error: `${market.type.replace(/_/g, " ")} markets require a line value.` };
  }

  const { error } = await supabase
    .from("markets")
    .update({ name: input.name, line_value: needsLine ? input.lineValue : null })
    .eq("id", marketId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "MARKET_UPDATED",
    entityType: "MARKET",
    entityId: marketId,
    metadata: { name: input.name, lineValue: input.lineValue },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/markets");
  return { data: { id: marketId } };
}

export async function deleteMarket(marketId: string, eventId: string): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { count: betCount, error: betCountError } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("market_id", marketId);
  if (betCountError) return { error: betCountError.message };
  if ((betCount ?? 0) > 0) {
    return { error: "Can't delete — bets have already been placed on this market. Suspend it instead." };
  }

  const { count: predictionCount, error: predictionCountError } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("market_id", marketId);
  if (predictionCountError) return { error: predictionCountError.message };
  if ((predictionCount ?? 0) > 0) {
    return { error: "Can't delete — predictions have already been made on this market." };
  }

  const { error } = await supabase.from("markets").delete().eq("id", marketId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "MARKET_DELETED",
    entityType: "MARKET",
    entityId: marketId,
    metadata: { eventId },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/markets");
  return { data: { id: marketId } };
}

export async function deleteSelection(
  selectionId: string,
  marketId: string,
  eventId: string
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { count: betCount, error: betCountError } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("selection_id", selectionId);
  if (betCountError) return { error: betCountError.message };
  if ((betCount ?? 0) > 0) {
    return { error: "Can't delete — bets have already been placed on this selection. Deactivate it instead." };
  }

  const { count: predictionCount, error: predictionCountError } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("selection_id", selectionId);
  if (predictionCountError) return { error: predictionCountError.message };
  if ((predictionCount ?? 0) > 0) {
    return { error: "Can't delete — predictions have already been made on this selection." };
  }

  const { error } = await supabase.from("market_selections").delete().eq("id", selectionId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SELECTION_DELETED",
    entityType: "MARKET",
    entityId: marketId,
    metadata: { selectionId },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/markets");
  return { data: { id: selectionId } };
}

export async function toggleSelectionActive(
  selectionId: string,
  marketId: string,
  eventId: string,
  active: boolean
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.from("market_selections").update({ active }).eq("id", selectionId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    action: "SELECTION_UPDATED",
    entityType: "MARKET",
    entityId: marketId,
    metadata: { selectionId, active },
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/markets");
  return { data: { id: selectionId } };
}
