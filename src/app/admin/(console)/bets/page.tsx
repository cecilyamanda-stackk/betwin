import Link from "next/link";
import { Award, Layers } from "lucide-react";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatKES } from "@/lib/currency";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";
import { fetchAllPicks, tallyByMarket, dedupeSlips, enrichPicks, type EnrichedPick } from "@/lib/admin/betInsights";
import type { BetStatus } from "@/types/database";

interface MarketSummary {
  key: string;
  eventLabel: string;
  marketName: string;
  totalPicks: number;
  bonusCandidates: number;
  selections: {
    name: string;
    count: number;
    share: number;
    isMajority: boolean;
  }[];
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "VOID", label: "Void" },
];

const STATUS_STYLES: Record<BetStatus, string> = {
  PENDING: "border border-border text-text-secondary",
  WON: "bg-success/15 text-success",
  LOST: "bg-live/15 text-live",
  VOID: "border border-border text-text-secondary line-through",
};

// Segment colors for the distribution bars, majority pick first. Kept
// short — most markets here are 2-3-way (Home/Draw/Away, Over/Under,
// Yes/No); a market with more selections than colors just repeats the
// last one, which only matters for the rare high-selection market and
// still reads fine since the legend below the bar carries the real
// information.
const SEGMENT_COLORS = ["bg-gold", "bg-text-secondary/50", "bg-live/50", "bg-success/50"];

/**
 * /admin/bets: every real-money pick across every bettor — straight bets
 * AND accumulator (combo) legs, both shapes (see src/lib/admin/betInsights.ts
 * for why a combo leg counts the same as a single bet here) — plus a
 * market-by-market distribution view so an admin can see which side of a
 * market carried the crowd. The free-to-play /admin/predictions page
 * never needed this, since points-game picks don't carry stakes.
 *
 * The distribution is also how "bonus candidates" get surfaced: a pick
 * that landed on the minority side of its market (fewer bettors chose
 * it) and still settled WON is a good, low-noise signal for "this person
 * called it when most people didn't" — worth a manual bonus review. That
 * flag is computed here, not stored — it's a read of the existing
 * `status` + sibling-pick counts, not a new column, so there's nothing to
 * keep in sync if bets get re-settled.
 */
export default async function AdminBetsPage({
  searchParams,
}: {
  searchParams: { status?: string; bonus?: string; page?: string };
}) {
  await requireAdmin();
  const { status = "", bonus } = searchParams;
  const bonusOnly = bonus === "1";
  const page = parsePage(searchParams.page);
  const supabase = await createClient();

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

  // ── Stat cards — deduped to one entry per slip so a combo's stake/payout isn't counted once per leg ──
  const slips = dedupeSlips(picks);
  const totalStaked = slips.reduce((sum, s) => sum + s.stakeAmount, 0);
  const pendingExposure = slips.filter((s) => s.status === "PENDING").reduce((sum, s) => sum + s.potentialPayout, 0);
  const bonusCandidateCount = enriched.filter((p) => p.isBonusCandidate).length;

  // ── "Most contested markets" panel — top markets by pick volume ──
  const marketSummaries: MarketSummary[] = [...marketTally.entries()]
    .map(([marketId, tally]): MarketSummary => {
      const samplePick = picks.find((p) => p.marketId === marketId)!;
      return {
        key: marketId,
        eventLabel: eventLabel(samplePick.eventId),
        marketName: marketNameById.get(marketId) ?? "—",
        totalPicks: tally.total,
        bonusCandidates: enriched.filter((p) => p.marketId === marketId && p.isBonusCandidate).length,
        selections: [...tally.bySelection.entries()]
          .map(([selectionId, count]) => ({
            name: selectionNameById.get(selectionId) ?? "—",
            count,
            share: Math.round((count / tally.total) * 100),
            isMajority: count === tally.majorityCount,
          }))
          .sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => b.totalPicks - a.totalPicks)
    .slice(0, 6);

  // ── Filter + paginate (in memory — see fetchAllPicks's own doc for why the underlying scan is unpaginated) ──
  let filtered = enriched;
  if (bonusOnly) {
    filtered = filtered.filter((p) => p.isBonusCandidate);
  } else if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }
  const [from, to] = pageRange(page);
  const pageRows = filtered.slice(from, to + 1);

  const columns: AdminTableColumn<EnrichedPick>[] = [
    { key: "user", label: "Bettor", render: (r) => `@${r.username}` },
    {
      key: "event",
      label: "Game",
      render: (r) => (
        <div>
          <p>{r.eventLabel}</p>
          {r.kickoff && (
            <p className="text-xs text-text-secondary">{new Date(r.kickoff).toLocaleDateString()}</p>
          )}
        </div>
      ),
    },
    {
      key: "market",
      label: "Market",
      render: (r) => (
        <div>
          <p>{r.marketName}</p>
          {r.slipType === "accumulator" && (
            <span className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs text-text-secondary">
              <Layers className="h-3 w-3" aria-hidden="true" />
              1 of {r.legCount} legs
            </span>
          )}
        </div>
      ),
    },
    {
      key: "pick",
      label: "Pick",
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span>{r.selectionName}</span>
          <div className="flex flex-wrap gap-1">
            <span
              className={`inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                r.isMajority ? "border border-border text-text-secondary" : "bg-gold/15 text-gold"
              }`}
            >
              {r.isMajority ? "Majority" : "Minority"} pick · {r.selectionShare}%
            </span>
            {r.isBonusCandidate && (
              <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-gold px-2 py-0.5 text-[11px] font-bold text-background">
                <Award className="h-3 w-3" aria-hidden="true" />
                Bonus candidate
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "stake",
      label: "Stake",
      render: (r) => (
        <div>
          <p>{formatKES(r.stakeAmount)}</p>
          {r.slipType === "accumulator" && <p className="text-xs text-text-secondary">combo total</p>}
        </div>
      ),
    },
    { key: "odds", label: "Odds", render: (r) => r.oddsAtPlacement.toFixed(2) },
    {
      key: "payout",
      label: "Potential payout",
      render: (r) => (
        <div>
          <p>{formatKES(r.potentialPayout)}</p>
          {r.slipType === "accumulator" && <p className="text-xs text-text-secondary">combo total</p>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[r.status]}`}
        >
          {r.status}
        </span>
      ),
    },
    { key: "placed", label: "Placed", render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold">Bets</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Every pick placed — single bets and accumulator legs alike — who placed it, and which side of each
        market carried the crowd.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-text-primary">{picks.length}</p>
          <p className="mt-1 text-sm text-text-secondary">Total picks ({slips.length} slips)</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-text-primary">{formatKES(totalStaked)}</p>
          <p className="mt-1 text-sm text-text-secondary">Total staked</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-text-primary">{formatKES(pendingExposure)}</p>
          <p className="mt-1 text-sm text-text-secondary">Pending payout exposure</p>
        </div>
        <Link href="/admin/bets?bonus=1" className="card p-4 transition-colors hover:border-gold/40">
          <p className="flex items-center gap-1.5 text-2xl font-bold text-gold">
            <Award className="h-5 w-5" aria-hidden="true" />
            {bonusCandidateCount}
          </p>
          <p className="mt-1 text-sm text-text-secondary">Bonus candidates (won against the crowd)</p>
        </Link>
      </div>

      {marketSummaries.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold">Most contested markets</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {marketSummaries.map((m) => (
              <div key={m.key} className="card p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">{m.eventLabel}</p>
                    <p className="text-xs text-text-secondary">
                      {m.marketName} · {m.totalPicks} pick{m.totalPicks === 1 ? "" : "s"}
                    </p>
                  </div>
                  {m.bonusCandidates > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                      <Award className="h-3 w-3" aria-hidden="true" />
                      {m.bonusCandidates}
                    </span>
                  )}
                </div>

                <div className="flex h-2.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                  {m.selections.map((s, i) => (
                    <div
                      key={s.name}
                      style={{ width: `${s.share}%` }}
                      className={SEGMENT_COLORS[Math.min(i, SEGMENT_COLORS.length - 1)]}
                      title={`${s.name}: ${s.count} (${s.share}%)`}
                    />
                  ))}
                </div>

                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  {m.selections.map((s) => (
                    <li key={s.name} className={s.isMajority ? "font-semibold text-text-primary" : ""}>
                      {s.name} — {s.count} ({s.share}%){s.isMajority ? " · majority" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-3" action="/admin/bets" method="get">
        <select
          name="status"
          defaultValue={status}
          disabled={bonusOnly}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60 disabled:opacity-50"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="bonus"
            value="1"
            defaultChecked={bonusOnly}
            className="h-4 w-4 rounded border-border accent-gold"
          />
          Bonus candidates only (won against the majority)
        </label>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <AdminTable
        columns={columns}
        rows={pageRows}
        keyField={(r) => r.id}
        emptyTitle="No bets match."
        emptyDescription={
          bonusOnly
            ? "No minority-pick winners yet — check back after more markets settle."
            : "Try a different status filter."
        }
      />
      <Pagination
        page={page}
        totalPages={computeTotalPages(filtered.length, DEFAULT_PAGE_SIZE)}
        basePath="/admin/bets"
        searchParams={{ status, bonus: bonusOnly ? "1" : undefined }}
      />
    </div>
  );
}
