/**
 * Hand-authored. Once there's a live Supabase project to point at,
 * regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * and delete this notice.
 */
export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "LIVE"
  | "SUSPENDED"
  | "FINISHED"
  | "CANCELLED";

export type MarketType =
  | "MATCH_RESULT"
  | "CORRECT_SCORE"
  | "TOTAL_GOALS"
  | "BOTH_TEAMS_SCORE"
  | "OTHER"
  // Added in the wagering roadmap's Phase 1 (real-money markets). The five
  // original values above are untouched/still valid for existing rows.
  | "MATCH_WINNER_3WAY"
  | "MONEYLINE"
  | "OVER_UNDER"
  | "HANDICAP"
  | "BOTH_TEAMS_TO_SCORE"
  | "DOUBLE_CHANCE";

export type MarketStatus = "OPEN" | "SUSPENDED" | "SETTLED";

export type PredictionStatus = "PENDING" | "WON" | "LOST" | "VOID";

// Wagering roadmap Phase 1. Kept separate from PredictionStatus even
// though the values are almost identical — `bets` is a new, parallel
// table to `predictions` (see the scope note in the Phase 1 migration),
// not a rename of it, so its status enum stays independent too.
export type BetStatus = "PENDING" | "WON" | "LOST" | "VOID";

// Wagering roadmap Phase 2. Fixed vocabulary a wagering selection maps
// to, so the DB's settle_bets_for_event() can compute WON/LOST/VOID from
// an event's final score without parsing free-text selection names. Null
// on points-game selections (see src/lib/markets/wagering.ts for which
// market types use which codes).
export type SelectionOutcomeCode =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "OVER"
  | "UNDER"
  | "HANDICAP_HOME"
  | "HANDICAP_AWAY"
  | "BTTS_YES"
  | "BTTS_NO"
  | "DOUBLE_CHANCE_1X"
  | "DOUBLE_CHANCE_X2"
  | "DOUBLE_CHANCE_12";

// Wagering roadmap Phase 3.
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "BET_DEBIT" | "BET_PAYOUT" | "BET_REFUND" | "ADJUSTMENT";
export type TransactionStatus = "COMPLETED" | "PENDING_REVIEW" | "REJECTED";

// Wagering roadmap Phase 6.
export type DepositLimitPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

// Manual M-Pesa deposit reconciliation (stopgap until Daraja API access exists).
export type ManualDepositStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ChallengeStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export interface Database {
  // Lets @supabase/supabase-js (2.45+ typegen shape) resolve query builder
  // types instead of silently degrading every `.from(...)` call to `never`.
  __InternalSupabase: {
    PostgrestVersion: "13.0.4";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          country: string | null;
          role: Role;
          suspended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          role?: Role;
          suspended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          role?: Role;
          suspended?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      sports: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          icon?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitions: {
        Row: {
          id: string;
          sport_id: string;
          name: string;
          slug: string;
          country: string | null;
          logo_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sport_id: string;
          name: string;
          slug: string;
          country?: string | null;
          logo_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sport_id?: string;
          name?: string;
          slug?: string;
          country?: string | null;
          logo_url?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          competition_id: string;
          name: string;
          short_name: string | null;
          logo_url: string | null;
          country: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          name: string;
          short_name?: string | null;
          logo_url?: string | null;
          country?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: string;
          name?: string;
          short_name?: string | null;
          logo_url?: string | null;
          country?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          competition_id: string;
          home_team_id: string;
          away_team_id: string;
          start_time: string;
          status: EventStatus;
          home_score: number | null;
          away_score: number | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          home_team_id: string;
          away_team_id: string;
          start_time: string;
          status?: EventStatus;
          home_score?: number | null;
          away_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: string;
          home_team_id?: string;
          away_team_id?: string;
          start_time?: string;
          status?: EventStatus;
          home_score?: number | null;
          away_score?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      markets: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          type: MarketType;
          status: MarketStatus;
          winning_selection_id: string | null;
          // Phase 1 (wagering roadmap): the Over/Under total or Handicap
          // spread this market is built around. Null for market types
          // that don't use a line.
          line_value: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          type?: MarketType;
          status?: MarketStatus;
          winning_selection_id?: string | null;
          line_value?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          type?: MarketType;
          status?: MarketStatus;
          winning_selection_id?: string | null;
          line_value?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_selections: {
        Row: {
          id: string;
          market_id: string;
          name: string;
          value: string | null;
          active: boolean;
          // Phase 1 (wagering roadmap). current_odds is public (decimal
          // odds shown in the UI); true_probability is an internal risk
          // figure — the DB grants it only to service_role, so any client
          // read of this row will get `undefined`/omitted for that field
          // regardless of what this type claims.
          current_odds: number | null;
          true_probability: number | null;
          // Wagering roadmap Phase 2. Only meaningful alongside
          // current_odds on the six wagering market types — null for
          // points-game selections.
          outcome_code: SelectionOutcomeCode | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          name: string;
          value?: string | null;
          active?: boolean;
          current_odds?: number | null;
          true_probability?: number | null;
          outcome_code?: SelectionOutcomeCode | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          value?: string | null;
          active?: boolean;
          current_odds?: number | null;
          true_probability?: number | null;
          outcome_code?: SelectionOutcomeCode | null;
        };
        Relationships: [];
      };
      bets: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          stake_amount: number;
          odds_at_placement: number;
          // Generated column (stake_amount * odds_at_placement) — never
          // set it directly in an Insert/Update.
          potential_payout: number;
          status: BetStatus;
          settled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          stake_amount: number;
          odds_at_placement: number;
          status?: BetStatus;
          settled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: BetStatus;
          settled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Accumulator (multiples) betting — combines several selections from
      // different matches into one stake at combined odds. Rows are only
      // ever written by place_accumulator_bet / finalize_accumulator_bets
      // (see 0018_accumulator_bets.sql) — no insert/update policy exists
      // for a direct client write, same trust boundary as `bets`.
      accumulator_bets: {
        Row: {
          id: string;
          user_id: string;
          stake_amount: number;
          total_odds_at_placement: number;
          // Generated column (stake_amount * total_odds_at_placement).
          potential_payout: number;
          status: BetStatus;
          settled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stake_amount: number;
          total_odds_at_placement: number;
          status?: BetStatus;
          settled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: BetStatus;
          settled_at?: string | null;
          total_odds_at_placement?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      accumulator_bet_legs: {
        Row: {
          id: string;
          accumulator_bet_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          odds_at_placement: number;
          status: BetStatus;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          accumulator_bet_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          odds_at_placement: number;
          status?: BetStatus;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: BetStatus;
          settled_at?: string | null;
        };
        Relationships: [];
      };
      // Server-side bet slip cart (see 0019_bet_slip_persistence.sql) — a
      // signed-in user's in-progress, not-yet-placed selections, so a
      // refresh (or a different device) doesn't lose them. Unlike
      // `bets`/`accumulator_bets` this *does* have direct client
      // insert/update/delete RLS policies — nothing here moves money, it's
      // just a cart, the same trust level as any other "my own draft data"
      // table.
      bet_slip_state: {
        Row: {
          user_id: string;
          state: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          state?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: {
          state?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Wagering roadmap Phase 3. Rows are only ever written by the
      // place_bet / settle_bets_for_event / request_withdrawal /
      // resolve_withdrawal / adjust_wallet_balance functions — there's no
      // insert/update policy for a direct client write (see the Phase 3
      // migration), so Insert/Update below exist for completeness rather
      // than a path the app actually uses.
      wallets: {
        Row: {
          user_id: string;
          withdrawable_cash: number;
          bonus_funds: number;
          // Generated column (withdrawable_cash + bonus_funds).
          total_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          withdrawable_cash?: number;
          bonus_funds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          withdrawable_cash?: number;
          bonus_funds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          payment_method_token: string;
          display_label: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          payment_method_token: string;
          display_label: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          display_label?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          status: TransactionStatus;
          // Signed — see the column comment in the Phase 3 migration.
          amount: number;
          bet_id: string | null;
          accumulator_bet_id: string | null;
          payment_method_id: string | null;
          idempotency_key: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          status?: TransactionStatus;
          amount: number;
          bet_id?: string | null;
          accumulator_bet_id?: string | null;
          payment_method_id?: string | null;
          idempotency_key?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          status?: TransactionStatus;
        };
        Relationships: [];
      };
      // Wagering roadmap Phase 6. Only ever written via set_deposit_limit
      // / start_self_exclusion (see the Phase 6 migration) — no
      // insert/update policy exists for a direct client write, since
      // self-exclusion's irreversibility depends on that.
      responsible_gambling_settings: {
        Row: {
          user_id: string;
          deposit_limit_amount: number | null;
          deposit_limit_period: DepositLimitPeriod | null;
          excluded_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          deposit_limit_amount?: number | null;
          deposit_limit_period?: DepositLimitPeriod | null;
          excluded_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          deposit_limit_amount?: number | null;
          deposit_limit_period?: DepositLimitPeriod | null;
          excluded_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Manual M-Pesa deposit reconciliation. Users can insert their own
      // PENDING claim directly (see the migration's RLS policy); only
      // resolve_manual_deposit_request can move it to APPROVED/REJECTED.
      manual_deposit_requests: {
        Row: {
          id: string;
          user_id: string;
          mpesa_code: string;
          mpesa_phone: string;
          claimed_amount: number;
          status: ManualDepositStatus;
          admin_note: string | null;
          transaction_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mpesa_code: string;
          mpesa_phone: string;
          claimed_amount: number;
          status?: "PENDING";
          created_at?: string;
        };
        Update: {
          status?: ManualDepositStatus;
          admin_note?: string | null;
          transaction_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          status: PredictionStatus;
          points_earned: number | null;
          settled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          market_id: string;
          selection_id: string;
          status?: PredictionStatus;
          points_earned?: number | null;
          settled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          selection_id?: string;
          status?: PredictionStatus;
          points_earned?: number | null;
          settled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          icon: string;
          criteria: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description: string;
          icon?: string;
          criteria: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          icon?: string;
          criteria?: Record<string, unknown>;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          earned_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      user_follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      prediction_challenges: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          start_time: string;
          end_time: string;
          status: ChallengeStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          status?: ChallengeStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          status?: ChallengeStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      challenge_entries: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          points_earned: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id: string;
          points_earned?: number;
          joined_at?: string;
        };
        Update: {
          points_earned?: number;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          value?: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      system_notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      leaderboard_scores: {
        Row: {
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          country: string | null;
          points_earned: number | null;
          settled_at: string | null;
          competition_id: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      settle_market: {
        Args: {
          p_market_id: string;
          p_winning_selection_id: string;
          p_points_for_win?: number;
        };
        Returns: undefined;
      };
      // Wagering roadmap Phase 2.
      settle_bets_for_event: {
        Args: {
          p_event_id: string;
        };
        Returns: undefined;
      };
      evaluate_bet_outcome: {
        Args: {
          p_market_type: MarketType;
          p_line_value: number | null;
          p_outcome_code: SelectionOutcomeCode | null;
          p_home_score: number;
          p_away_score: number;
        };
        Returns: BetStatus;
      };
      // Wagering roadmap Phase 3.
      place_bet: {
        Args: {
          p_selection_id: string;
          p_stake_amount: number;
          p_idempotency_key?: string | null;
        };
        Returns: { bet_id: string; odds_at_placement: number; potential_payout: number }[];
      };
      // Accumulator (multiples) betting — see 0018_accumulator_bets.sql.
      place_accumulator_bet: {
        Args: {
          p_selection_ids: string[];
          p_stake_amount: number;
          p_idempotency_key?: string | null;
        };
        Returns: { accumulator_bet_id: string; total_odds: number; potential_payout: number }[];
      };
      request_withdrawal: {
        Args: {
          p_amount: number;
          p_mpesa_phone: string;
        };
        Returns: { transaction_id: string; status: TransactionStatus; estimated_processing_hours: number }[];
      };
      resolve_withdrawal: {
        Args: {
          p_transaction_id: string;
          p_approve: boolean;
        };
        Returns: undefined;
      };
      adjust_wallet_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_bucket: "withdrawable_cash" | "bonus_funds";
          p_reason: string;
        };
        Returns: undefined;
      };
      reopen_bets_for_event: {
        Args: {
          p_event_id: string;
        };
        Returns: undefined;
      };
      // User-initiated bet cancellation (see 0017_user_bet_cancellation.sql).
      cancel_bet: {
        Args: {
          p_bet_id: string;
        };
        Returns: { refunded_amount: number }[];
      };
      // Wagering roadmap Phase 6.
      set_deposit_limit: {
        Args: {
          p_amount: number | null;
          p_period: DepositLimitPeriod | null;
        };
        Returns: undefined;
      };
      start_self_exclusion: {
        Args: {
          p_days: number;
        };
        Returns: string;
      };
      // Manual M-Pesa deposit reconciliation.
      resolve_manual_deposit_request: {
        Args: {
          p_request_id: string;
          p_approve: boolean;
          p_admin_user_id: string;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      get_profile_cards: {
        Args: {
          profile_ids: string[];
        };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          country: string | null;
        }[];
      };
    };
  };
}
