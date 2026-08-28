-- Betwin — Phase 2 (Wagering Roadmap): bet placement & settlement logic
--
-- Scope note: this migration builds the settlement half of Phase 2 —
-- automatic win/loss computation per market family off an event's final
-- score, extending the admin Results flow so marking an event FINISHED
-- settles every `bets` row tied to it, per the roadmap.
--
-- It deliberately does NOT add an insert policy or RPC for placing bets.
-- The roadmap's own spec for placeBet is "debits the wallet in the same
-- transaction" — there is still no wallet (Phase 3), so any insert path
-- opened now would create bets with no matching debit, i.e. free money.
-- src/actions/bets.ts documents exactly what's ready to wire up once
-- Phase 3 lands.

-- ── Outcome codes ────────────────────────────────────────────────────────
-- The points-game selections (MATCH_RESULT, CORRECT_SCORE, etc.) identify
-- themselves to users by free-text `name`/`value` and are settled by an
-- admin manually picking a winning_selection_id — a human reads "Correct
-- Score 2-1" and knows what it means, so free text is fine there.
--
-- Automatic settlement can't do that: it needs to know, unambiguously,
-- that a given selection *means* "the away team wins" or "total goals
-- over the line" so it can compare that meaning against home_score/
-- away_score. outcome_code is that fixed vocabulary — nullable because
-- it's only meaningful for the six wagering market types added in Phase 1.
create type public.selection_outcome_code as enum (
  'HOME', 'DRAW', 'AWAY',
  'OVER', 'UNDER',
  'HANDICAP_HOME', 'HANDICAP_AWAY',
  'BTTS_YES', 'BTTS_NO',
  'DOUBLE_CHANCE_1X', 'DOUBLE_CHANCE_X2', 'DOUBLE_CHANCE_12'
);

alter table public.market_selections
  add column outcome_code public.selection_outcome_code;

comment on column public.market_selections.outcome_code is
  'Fixed vocabulary a wagering selection maps to, so settle_bets_for_event '
  'can compute WON/LOST/VOID from the final score without parsing free-text '
  'names. Null for points-game selections, which stay manually settled via '
  'markets.winning_selection_id + settle_market like before.';

-- outcome_code carries the same "shown to users" sensitivity as
-- current_odds (both describe what's being bet on), so it gets the same
-- column-level grant treatment from the Phase 1 migration rather than
-- being left on the table-level default.
grant select (outcome_code) on public.market_selections to anon, authenticated;

-- ── Per-bet settlement logic ─────────────────────────────────────────────
-- Pure function: given a market's type/line and a selection's outcome
-- code, plus the event's final score, returns what a bet on that
-- selection should settle to. No table access, so it's easy to unit-test
-- from SQL directly (see examples in the migration's PR/review notes)
-- independent of any real bet/event rows.
--
-- Handicap and BTTS get their own branches per the roadmap note that they
-- "need their own comparison logic, not just 'score matches selection'"
-- — every branch here compares the score against what the outcome code
-- *means*, not against a single stored "winning selection".
create or replace function public.evaluate_bet_outcome(
  p_market_type public.market_type,
  p_line_value numeric,
  p_outcome_code public.selection_outcome_code,
  p_home_score integer,
  p_away_score integer
)
returns public.bet_status
language plpgsql
immutable
as $$
declare
  v_total integer;
  v_adjusted_home numeric;
begin
  if p_home_score is null or p_away_score is null or p_outcome_code is null then
    return 'VOID';
  end if;

  case p_market_type
    when 'MATCH_WINNER_3WAY' then
      case p_outcome_code
        when 'HOME' then return case when p_home_score > p_away_score then 'WON' else 'LOST' end;
        when 'AWAY' then return case when p_away_score > p_home_score then 'WON' else 'LOST' end;
        when 'DRAW' then return case when p_home_score = p_away_score then 'WON' else 'LOST' end;
        else return 'VOID';
      end case;

    when 'MONEYLINE' then
      -- 2-way, no draw outcome exists on this market. A tied final score
      -- means the event data doesn't fit a moneyline market (wrong sport,
      -- or the event actually needs overtime handling) — void rather than
      -- silently picking a side.
      if p_home_score = p_away_score then
        return 'VOID';
      end if;
      case p_outcome_code
        when 'HOME' then return case when p_home_score > p_away_score then 'WON' else 'LOST' end;
        when 'AWAY' then return case when p_away_score > p_home_score then 'WON' else 'LOST' end;
        else return 'VOID';
      end case;

    when 'OVER_UNDER' then
      if p_line_value is null then return 'VOID'; end if;
      v_total := p_home_score + p_away_score;
      case p_outcome_code
        when 'OVER' then return case when v_total > p_line_value then 'WON' else 'LOST' end;
        when 'UNDER' then return case when v_total < p_line_value then 'WON' else 'LOST' end;
        else return 'VOID';
      end case;

    when 'HANDICAP' then
      if p_line_value is null then return 'VOID'; end if;
      -- Convention (matches the admin market-builder's "Line" field):
      -- line_value is added to the home team's score. A home favorite is
      -- entered as a negative line (e.g. -1.5), an underdog as positive.
      v_adjusted_home := p_home_score + p_line_value;
      case p_outcome_code
        when 'HANDICAP_HOME' then
          if v_adjusted_home > p_away_score then return 'WON';
          elsif v_adjusted_home = p_away_score then return 'VOID'; -- push (only reachable with an integer line)
          else return 'LOST';
          end if;
        when 'HANDICAP_AWAY' then
          if v_adjusted_home < p_away_score then return 'WON';
          elsif v_adjusted_home = p_away_score then return 'VOID';
          else return 'LOST';
          end if;
        else return 'VOID';
      end case;

    when 'BOTH_TEAMS_TO_SCORE' then
      case p_outcome_code
        when 'BTTS_YES' then
          return case when p_home_score > 0 and p_away_score > 0 then 'WON' else 'LOST' end;
        when 'BTTS_NO' then
          return case when p_home_score > 0 and p_away_score > 0 then 'LOST' else 'WON' end;
        else return 'VOID';
      end case;

    when 'DOUBLE_CHANCE' then
      -- Unlike every other family, more than one Double Chance selection
      -- can legitimately win at once (a home win satisfies both 1X and
      -- 12) — there's no single "winning selection" concept here, each
      -- selection is judged independently against the score.
      case p_outcome_code
        when 'DOUBLE_CHANCE_1X' then return case when p_home_score >= p_away_score then 'WON' else 'LOST' end;
        when 'DOUBLE_CHANCE_X2' then return case when p_away_score >= p_home_score then 'WON' else 'LOST' end;
        when 'DOUBLE_CHANCE_12' then return case when p_home_score <> p_away_score then 'WON' else 'LOST' end;
        else return 'VOID';
      end case;

    else
      -- Not a wagering market type (points-game types, or OTHER) — those
      -- are never expected to reach this function; void defensively
      -- rather than guessing.
      return 'VOID';
  end case;
end;
$$;

-- ── Event-level settlement ───────────────────────────────────────────────
-- Settles every PENDING bet on p_event_id's wagering markets against the
-- event's own home_score/away_score, then marks those markets SETTLED.
-- Only touches PENDING bets, so — like settle_market for the points game
-- — it's safe to call again after a correction re-opens bets to PENDING
-- (see resettleEventBets in actions/admin/results.ts).
--
-- security definer so the admin Server Action (via the service-role
-- client) can call it without needing broader table privileges than RLS
-- would otherwise grant — same pattern as settle_market.
create or replace function public.settle_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_home_score integer;
  v_away_score integer;
begin
  select home_score, away_score into v_home_score, v_away_score
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event % not found.', p_event_id;
  end if;
  if v_home_score is null or v_away_score is null then
    raise exception 'Event % has no final score yet.', p_event_id;
  end if;

  update public.bets b
  set
    status = public.evaluate_bet_outcome(
      m.type, m.line_value, ms.outcome_code, v_home_score, v_away_score
    ),
    settled_at = now()
  from public.markets m
  join public.market_selections ms on ms.market_id = m.id
  where b.market_id = m.id
    and b.selection_id = ms.id
    and b.event_id = p_event_id
    and b.status = 'PENDING'
    and m.type in (
      'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
      'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE'
    );

  update public.markets
  set status = 'SETTLED'
  where event_id = p_event_id
    and status = 'OPEN'
    and type in (
      'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
      'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE'
    );
end;
$$;
