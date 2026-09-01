import type { MarketType, SelectionOutcomeCode } from "@/types/database";

/**
 * The six real-money market families added in Phase 1 of the wagering
 * roadmap, as distinct from the original free-to-play families
 * (MATCH_RESULT, CORRECT_SCORE, TOTAL_GOALS, BOTH_TEAMS_SCORE, OTHER)
 * that back the points/leaderboard game and stay untouched.
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
];

export function isWageringMarketType(type: MarketType): boolean {
  return WAGERING_MARKET_TYPES.includes(type);
}

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
