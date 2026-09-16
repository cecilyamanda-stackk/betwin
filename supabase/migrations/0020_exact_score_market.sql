-- Bet606 — Exact Score wagering market
--
-- Adds a 7th real-money market family: admin prices individual scorelines
-- (e.g. "0-1" @ 4.50, "1-1" @ 12.30) instead of picking from a fixed
-- outcome vocabulary. Kept as its own market_type rather than reusing the
-- pre-existing points-game 'CORRECT_SCORE' value — that one is free text,
-- manually settled by an admin picking winning_selection_id; this one is
-- real money and needs the same "settles itself off the final score"
-- guarantee the other six wagering families have.
--
-- Unlike those six, Exact Score selections don't use outcome_code —
-- scorelines aren't a fixed vocabulary, so market_selections.value holds
-- "<home>-<away>" (e.g. "2-1") or the literal 'OTHER' catch-all instead.
-- See isValidExactScoreValue in lib/markets/wagering.ts, which is the
-- same format this settlement logic assumes.

-- Note: like the Phase 1 migration, ALTER TYPE ... ADD VALUE can't be
-- referenced later in the same transaction/file, so this stays the only
-- statement touching the enum here.
alter type public.market_type add value if not exists 'EXACT_SCORE';

-- ── Event-level settlement, extended for Exact Score ────────────────────
-- evaluate_bet_outcome (Phase 2) stays untouched: it's a pure per-selection
-- function keyed on outcome_code, and Exact Score selections don't have
-- one. Grading an Exact Score bet instead needs to know the *market's*
-- winning selection (matched scoreline, or the OTHER catch-all, or no
-- coverage at all) before it can grade each bet against it — that's a
-- market-level lookup, not a per-selection pure function, so it gets its
-- own block here rather than a new evaluate_bet_outcome branch.
create or replace function public.settle_bets_for_event(p_event_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_home_score integer;
  v_away_score integer;
  v_score_key text;
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

  v_score_key := v_home_score::text || '-' || v_away_score::text;

  -- ── The six outcome_code-driven wagering families ──────────────────
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

  -- ── Exact Score ───────────────────────────────────────────────────
  -- Per Exact Score market, the winning selection is: the one whose
  -- value matches the final scoreline exactly, or — if the admin didn't
  -- price that exact line — the 'OTHER' catch-all if one exists. If
  -- neither exists, this market simply doesn't cover what happened;
  -- every bet on it voids (refunded) rather than being marked a loss
  -- for a scoreline the book never offered.
  with exact_score_winner as (
    select
      m.id as market_id,
      coalesce(
        (select ms.id from public.market_selections ms
          where ms.market_id = m.id and ms.value = v_score_key
          limit 1),
        (select ms.id from public.market_selections ms
          where ms.market_id = m.id and ms.value = 'OTHER'
          limit 1)
      ) as winning_selection_id
    from public.markets m
    where m.event_id = p_event_id and m.type = 'EXACT_SCORE'
  )
  update public.bets b
  set
    status = case
      when esw.winning_selection_id is null then 'VOID'
      when b.selection_id = esw.winning_selection_id then 'WON'
      else 'LOST'
    end,
    settled_at = now()
  from public.markets m
  join exact_score_winner esw on esw.market_id = m.id
  where b.market_id = m.id
    and b.event_id = p_event_id
    and b.status = 'PENDING'
    and m.type = 'EXACT_SCORE';

  update public.markets
  set status = 'SETTLED'
  where event_id = p_event_id
    and status = 'OPEN'
    and type in (
      'MATCH_WINNER_3WAY', 'MONEYLINE', 'OVER_UNDER',
      'HANDICAP', 'BOTH_TEAMS_TO_SCORE', 'DOUBLE_CHANCE', 'EXACT_SCORE'
    );
end;
$$;
