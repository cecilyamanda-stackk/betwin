import type { MarketType, SelectionOutcomeCode } from "@/types/database";

/**
 * The real-money market families — the original six from Phase 1 of the
 * wagering roadmap plus Exact Score, as distinct from the free-to-play
 * families (MATCH_RESULT, CORRECT_SCORE, TOTAL_GOALS, BOTH_TEAMS_SCORE,
 * OTHER) that back the points/leaderboard game and stay untouched.
 *
 * Shared by admin actions and admin UI so the two never drift — e.g. the
 * server-side "does this market need a line value" check and the
 * client-side one showing/hiding the field are the same list.
 */
export const WAGERING_MARKET_TYPES: MarketType[] = [
  "MATCH_WINNER_3WAY",
  "MONEYLINE",
  "OVER_UNDER",
  "HANDICAP",
  "BOTH_TEAMS_TO_SCORE",
  "DOUBLE_CHANCE",
  "EXACT_SCORE",
];

export function isWageringMarketType(type: MarketType): boolean {
  return WAGERING_MARKET_TYPES.includes(type);
}

/**
 * Exact Score is the one wagering family whose selections aren't priced
 * through the outcome_code vocabulary (see database.ts) — it's kept as
 * its own check so every place that gates on "does this need an outcome
 * code" (the admin form, resolveOutcomeCode) can exclude it in one spot.
 */
export const EXACT_SCORE_MARKET_TYPE: MarketType = "EXACT_SCORE";

export function isExactScoreMarketType(type: MarketType): boolean {
  return type === EXACT_SCORE_MARKET_TYPE;
}

/** "<home>-<away>", e.g. "2-1". Deliberately plain digits — no negative/decimal scores. */
export const EXACT_SCORE_VALUE_PATTERN = /^\d{1,2}-\d{1,2}$/;

/** The catch-all selection value for "any scoreline not priced above." */
export const EXACT_SCORE_OTHER_VALUE = "OTHER";

export function isValidExactScoreValue(value: string): boolean {
  return value === EXACT_SCORE_OTHER_VALUE || EXACT_SCORE_VALUE_PATTERN.test(value);
}

/**
 * Pre-filled rows for the admin's score-grid builder — the common
 * low-scoring soccer outcomes, ordered the way bettors expect to scan
 * them (draws and near-scores first). Not exhaustive: the grid builder
 * also takes free-form scores for anything outside this list, and an
 * "Any other score" row (EXACT_SCORE_OTHER_VALUE) covers the rest.
 */
export const EXACT_SCORE_GRID_DEFAULTS: string[] = [
  "0-0", "1-0", "0-1",
  "1-1", "2-0", "0-2",
  "2-1", "1-2", "2-2",
  "3-0", "0-3", "3-1",
  "1-3", "3-2", "2-3",
  "3-3", "4-0", "0-4",
  "4-1", "1-4",
];

/** Market types whose settlement needs a `line_value` (Over/Under's total, Handicap's spread). */
export const LINE_VALUE_MARKET_TYPES: MarketType[] = ["OVER_UNDER", "HANDICAP"];

/**
 * Fixed outcome codes per wagering market type. Phase 2's settlement
 * function (`evaluate_bet_outcome` in the DB) switches on these exact
 * codes plus the event's final score — so unlike the points game, a
 * wagering selection's `outcome_code` isn't free text an admin can spell
 * how they like; it has to be one of these or automatic settlement can't
 * find it. The admin UI restricts selection creation to this list for
 * any market type that appears here.
 */
export const OUTCOME_CODES_BY_MARKET_TYPE: Partial<
  Record<MarketType, { value: SelectionOutcomeCode; label: string }[]>
> = {
  MATCH_WINNER_3WAY: [
    { value: "HOME", label: "Home" },
    { value: "DRAW", label: "Draw" },
    { value: "AWAY", label: "Away" },
  ],
  MONEYLINE: [
    { value: "HOME", label: "Home" },
    { value: "AWAY", label: "Away" },
  ],
  OVER_UNDER: [
    { value: "OVER", label: "Over" },
    { value: "UNDER", label: "Under" },
  ],
  HANDICAP: [
    { value: "HANDICAP_HOME", label: "Home (handicap)" },
    { value: "HANDICAP_AWAY", label: "Away (handicap)" },
  ],
  BOTH_TEAMS_TO_SCORE: [
    { value: "BTTS_YES", label: "Yes" },
    { value: "BTTS_NO", label: "No" },
  ],
  DOUBLE_CHANCE: [
    { value: "DOUBLE_CHANCE_1X", label: "Home or Draw (1X)" },
    { value: "DOUBLE_CHANCE_X2", label: "Draw or Away (X2)" },
    { value: "DOUBLE_CHANCE_12", label: "Home or Away (12)" },
  ],
};

export interface MarketTemplateSelection {
  name: string;
  outcomeCode: SelectionOutcomeCode;
}

export interface MarketTemplateMarket {
  name: string;
  type: MarketType;
  /** Suggested default — still editable in the wizard, since the real line varies match to match. */
  lineValue?: number;
  selections: MarketTemplateSelection[];
}

export interface MarketTemplate {
  key: string;
  label: string;
  description: string;
  markets: MarketTemplateMarket[];
}

/**
 * "Create Game" wizard bundles (admin console). Each one pre-fills the
 * market/selection *shape* — name, type, outcome code — so an admin only
 * has to type in odds numbers instead of building every market and
 * selection from scratch for the same handful of standard combinations
 * every match uses. Odds and line values are never hard-coded here:
 * that's real money, so the wizard always asks for them explicitly
 * rather than shipping a plausible-looking default.
 */
export const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    key: "soccer_standard",
    label: "Soccer — standard 4",
    description: "Match Winner (1X2), Over/Under, Both Teams to Score, Double Chance.",
    markets: [
      {
        name: "Match Winner",
        type: "MATCH_WINNER_3WAY",
        selections: [
          { name: "Home", outcomeCode: "HOME" },
          { name: "Draw", outcomeCode: "DRAW" },
          { name: "Away", outcomeCode: "AWAY" },
        ],
      },
      {
        name: "Over/Under",
        type: "OVER_UNDER",
        lineValue: 2.5,
        selections: [
          { name: "Over", outcomeCode: "OVER" },
          { name: "Under", outcomeCode: "UNDER" },
        ],
      },
      {
        name: "Both Teams to Score",
        type: "BOTH_TEAMS_TO_SCORE",
        selections: [
          { name: "Yes", outcomeCode: "BTTS_YES" },
          { name: "No", outcomeCode: "BTTS_NO" },
        ],
      },
      {
        name: "Double Chance",
        type: "DOUBLE_CHANCE",
        selections: [
          { name: "Home or Draw", outcomeCode: "DOUBLE_CHANCE_1X" },
          { name: "Draw or Away", outcomeCode: "DOUBLE_CHANCE_X2" },
          { name: "Home or Away", outcomeCode: "DOUBLE_CHANCE_12" },
        ],
      },
    ],
  },
  {
    key: "moneyline_2way",
    label: "2-way — Moneyline",
    description: "Basketball, tennis, or any sport with no draw.",
    markets: [
      {
        name: "Moneyline",
        type: "MONEYLINE",
        selections: [
          { name: "Home", outcomeCode: "HOME" },
          { name: "Away", outcomeCode: "AWAY" },
        ],
      },
    ],
  },
];
