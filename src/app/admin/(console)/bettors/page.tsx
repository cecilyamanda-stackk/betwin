import Link from "next/link";
import { Award, Layers } from "lucide-react";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatKES } from "@/lib/currency";
import {
  fetchAllPicks,
  tallyByMarket,
  tallyByEvent,
  enrichPicks,
  type EnrichedPick,
} from "@/lib/admin/betInsights";
import type { BetStatus } from "@/types/database";

const STATUS_STYLES: Record<BetStatus, string> = {
  PENDING: "border border-border text-text-secondary",
  WON: "bg-success/15 text-success",
  LOST: "bg-live/15 text-live",
  VOID: "border border-border text-text-secondary line-through",
};

// How many bettors to show per game before collapsing to "+N more" — only
// applies on the all-games overview; drilling into one game (?event=)
// always shows its full roster.
const ROSTER_PREVIEW_SIZE = 8;
// How many games appear as their own section on the all-games overview.
// The filter strip above it still lists every game with a pick.
const OVERVIEW_GAME_LIMIT = 8;

interface BettorRow {
  userId: string;
  username: string;
  selectionName: string;
  isMajority: boolean;
  totalStake: number;
  pickCount: number;
  status: BetStatus;
  slipType: "single" | "accumulator";
}

/**
 * Groups a market's picks into one row per bettor, majority side first
 * (then by stake, largest first) — the ordering requested for this page:
 * "those who bet on the market get first priority, then whoever backed
 * the majority side starts first."
 *
 * A bettor with more than one pick in the same market (a straight bet
 * AND a combo leg here, say) is collapsed to one row: stake sums across
 * their picks (safe — each pick in a market group comes from a distinct
 * slip, see betInsights.ts) and their most recent pick stands in for
 * which side/status is shown. That's a simplification for the rare case
 * someone hedged both sides of the same market — worth knowing about,
 * not worth a second table.
 */
function buildRoster(marketPicks: EnrichedPick[]): BettorRow[] {
  const byUser = new Map<string, EnrichedPick[]>();
  for (const pick of marketPicks) {
    if (!byUser.has(pick.userId)) byUser.set(pick.userId, []);
    byUser.get(pick.userId)!.push(pick);
  }
  const rows: BettorRow[] = [...byUser.entries()].map(([userId, userPicks]) => {
    const latest = [...userPicks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
    return {
      userId,
      username: latest.username,
      selectionName: latest.selectionName,
      isMajority: latest.isMajority,
      totalStake: userPicks.reduce((sum, p) => sum + p.stakeAmount, 0),
      pickCount: userPicks.length,
      status: latest.status,
      slipType: latest.slipType,
    };
  });
  rows.sort((a, b) => {
    if (a.isMajority !== b.isMajority) return a.isMajority ? -1 : 1;
    return b.totalStake - a.totalStake;
  });
  return rows;
}

/**
 * /admin/bettors: the people behind /admin/bets' ledger, grouped by game
 * instead of listed flat. Games are ordered by how many bettors share
 * them — "Chelsea vs Arsenal" with 40 picks sorts above a game with 3 —
 * and inside each game, bettors on the majority side of the headline
 * market come first, minority-side bettors after (see buildRoster above
 * for the exact tie-break). The filter strip lets an admin jump straight
 * to one game's full roster instead of scrolling the overview.
 *
 * "Headline market" = whichever market on that event has the most picks
 * — usually match winner, but derived rather than hardcoded so a game
 * with an unusually popular Over/Under still groups sensibly. Drilling
 * into a single game (?event=) shows every market with picks on it, not
 * just the headline one.
 */
export default async function AdminBettorsPage({
  searchParams,
}: {
  searchParams: { event?: string };
}) {
  await requireAdmin();
  const supabase = await createClient();
  const selectedEventId = searchParams.event ?? null;

  const picks = await fetchAllPicks(supabase);

  const userIds = [...new Set(picks.map((p) => p.userId))];
  const eventIds = [...new Set(picks.map((p) => p.eventId))];
  const marketIds = [...new Set(picks.map((p) => p.marketId))];
  const selectionIds = [...new Set(picks.map((p) => p.selectionId))];

  const [{ data: users }, { data: events }, { data: markets }, { data: selections }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, username").in("id", userIds) : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("events").select("id, home_team_id, away_team_id, start_time").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    marketIds.length ? supabase.from("markets").select("id, name").in("id", marketIds) : Promise.resolve({ data: [] }),
    selectionIds.length
      ? supabase.from("market_selections").select("id, name").in("id", selectionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const teamIds = [...new Set((events ?? []).flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };

  const usernameById = new Map((users ?? []).map((u) => [u.id, u.username]));
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const marketNameById = new Map((markets ?? []).map((m) => [m.id, m.name]));
  const selectionNameById = new Map((selections ?? []).map((s) => [s.id, s.name]));

  function eventLabel(eventId: string): string {
    const event = eventById.get(eventId);
    if (!event) return "—";
    return `${teamNameById.get(event.home_team_id) ?? "—"} vs ${teamNameById.get(event.away_team_id) ?? "—"}`;
  }

  const eventLabelById = new Map(eventIds.map((id) => [id, eventLabel(id)]));
  const kickoffById = new Map(eventIds.map((id) => [id, eventById.get(id)?.start_time ?? ""]));
  const marketTally = tallyByMarket(picks);
  const enriched = enrichPicks(picks, marketTally, {
    usernameById,
    eventLabelById,
    kickoffById,
    marketNameById,
    selectionNameById,
  });

  // ── Filter strip: every game with a pick, most-shared first ──
  const eventPopularity = tallyByEvent(picks);
  const sortedEventIds = [...eventPopularity.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  // ── Build the game sections ──
  interface GameSection {
    eventId: string;
    marketId: string;
    eventLabel: string;
    marketName: string;
    totalPicks: number;
    roster: BettorRow[];
  }

  let sections: GameSection[] = [];

  if (selectedEventId) {
    // Drilled into one game: every market with picks on it, full rosters.
    const marketIdsForEvent = [...new Set(enriched.filter((p) => p.eventId === selectedEventId).map((p) => p.marketId))];
    sections = marketIdsForEvent
      .map((marketId) => {
        const marketPicks = enriched.filter((p) => p.marketId === marketId);
        return {
          eventId: selectedEventId,
          marketId,
          eventLabel: eventLabelById.get(selectedEventId) ?? "—",
          marketName: marketNameById.get(marketId) ?? "—",
          totalPicks: marketPicks.length,
          roster: buildRoster(marketPicks),
        };
      })
      .sort((a, b) => b.totalPicks - a.totalPicks);
  } else {
    // Overview: one section per game (its headline market only), most-shared games first.
    sections = sortedEventIds.slice(0, OVERVIEW_GAME_LIMIT).map((eventId) => {
      const picksForEvent = enriched.filter((p) => p.eventId === eventId);
      const marketsForEvent = tallyByMarket(picksForEvent);
      const headlineMarketId = [...marketsForEvent.entries()].sort((a, b) => b[1].total - a[1].total)[0]![0];
      const marketPicks = picksForEvent.filter((p) => p.marketId === headlineMarketId);
      return {
        eventId,
        marketId: headlineMarketId,
        eventLabel: eventLabelById.get(eventId) ?? "—",
        marketName: marketNameById.get(headlineMarketId) ?? "—",
        totalPicks: eventPopularity.get(eventId) ?? marketPicks.length,
        roster: buildRoster(marketPicks),
      };
    });
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold">Bettors</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Who&apos;s betting on what, grouped by game — most-shared games first, majority-side bettors listed
        before the crowd&apos;s minority.
      </p>

      {sortedEventIds.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <Link href="/admin/bettors" className={`pill shrink-0 ${!selectedEventId ? "pill-selected" : ""}`}>
            All games
          </Link>
          {sortedEventIds.map((eventId) => (
            <Link
              key={eventId}
              href={`/admin/bettors?event=${eventId}`}
              className={`pill shrink-0 ${selectedEventId === eventId ? "pill-selected" : ""}`}
            >
              {eventLabelById.get(eventId)}
              <span className="ml-1 text-xs opacity-70">{eventPopularity.get(eventId)}</span>
            </Link>
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <EmptyState title="No bets yet." description="Bettors will show up here once picks start coming in." />
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={`${section.eventId}-${section.marketId}`} className="card p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold">{section.eventLabel}</h2>
                  <p className="text-xs text-text-secondary">
                    {section.marketName} · {section.totalPicks} pick{section.totalPicks === 1 ? "" : "s"} ·{" "}
                    {section.roster.length} bettor{section.roster.length === 1 ? "" : "s"}
                  </p>
                </div>
                {!selectedEventId && (
                  <Link
                    href={`/admin/bettors?event=${section.eventId}`}
                    className="shrink-0 text-sm font-medium text-gold hover:underline"
                  >
                    View game
                  </Link>
                )}
              </div>

              <div className="flex flex-col divide-y divide-border/60">
                {(selectedEventId ? section.roster : section.roster.slice(0, ROSTER_PREVIEW_SIZE)).map((row) => (
                  <div key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-medium text-text-primary">@{row.username}</span>
                      <span className="text-text-secondary">{row.selectionName}</span>
                      {row.pickCount > 1 && (
                        <span className="text-xs text-text-secondary">×{row.pickCount}</span>
                      )}
                      {row.slipType === "accumulator" && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <Layers className="h-3 w-3" aria-hidden="true" />
                          combo
                        </span>
                      )}
                      <span
                        className={`inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                          row.isMajority ? "border border-border text-text-secondary" : "bg-gold/15 text-gold"
                        }`}
                      >
                        {row.isMajority ? "Majority" : "Minority"}
                      </span>
                      {row.status === "WON" && !row.isMajority && (
                        <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-gold px-2 py-0.5 text-[11px] font-bold text-background">
                          <Award className="h-3 w-3" aria-hidden="true" />
                          Bonus candidate
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-text-primary">{formatKES(row.totalStake)}</span>
                      <span
                        className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {!selectedEventId && section.roster.length > ROSTER_PREVIEW_SIZE && (
                <Link
                  href={`/admin/bettors?event=${section.eventId}`}
                  className="mt-2 inline-block text-sm font-medium text-gold hover:underline"
                >
                  +{section.roster.length - ROSTER_PREVIEW_SIZE} more bettor
                  {section.roster.length - ROSTER_PREVIEW_SIZE === 1 ? "" : "s"} on this game
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
