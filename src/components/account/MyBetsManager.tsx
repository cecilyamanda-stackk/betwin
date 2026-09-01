"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { BetStatus, EventStatus } from "@/types/database";
import { formatKES } from "@/lib/currency";
import { cancelBet } from "@/actions/bets";

export interface MySingleBetCard {
  kind: "single";
  id: string;
  homeTeam: string;
  awayTeam: string;
  competitionName: string | null;
  marketName: string;
  selectionLabel: string;
  odds: number;
  stake: number;
  potentialPayout: number;
  status: BetStatus;
  eventStatus: EventStatus;
  homeScore: number | null;
  awayScore: number | null;
  createdAt: string;
}

export interface MyAccumulatorLeg {
  eventLabel: string;
  marketName: string;
  selectionLabel: string;
  odds: number;
  status: BetStatus;
}

export interface MyAccumulatorBetCard {
  kind: "accumulator";
  id: string;
  legs: MyAccumulatorLeg[];
  totalOdds: number;
  stake: number;
  potentialPayout: number;
  status: BetStatus;
  createdAt: string;
}

export type MyBetCard = MySingleBetCard | MyAccumulatorBetCard;

const SETTLED_BADGE: Record<Exclude<BetStatus, "PENDING">, { label: string; className: string }> = {
  WON: { label: "WON", className: "bg-success/15 text-success" },
  LOST: { label: "LOST", className: "bg-live/15 text-live" },
  VOID: { label: "VOID", className: "border border-border text-text-secondary" },
};

/** Badge for a still-PENDING single bet — reflects the *event's* state, not the bet's (which stays PENDING until settlement either way). */
function ActiveBadge({ eventStatus }: { eventStatus: EventStatus }) {
  if (eventStatus === "LIVE" || eventStatus === "SUSPENDED") {
    return (
      <span className="inline-flex items-center rounded-pill bg-live/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-live">
        <span className="live-dot mr-1.5" />
        {eventStatus === "LIVE" ? "Live" : "Suspended"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-pill bg-gold/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-gold">
      Upcoming
    </span>
  );
}

/** Badge for a still-PENDING accumulator — no single event to reflect (its legs can span several), so this just says "Pending". */
function AccumulatorPendingBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-gold/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-gold">
      Pending
    </span>
  );
}

function SettledBadge({ status }: { status: Exclude<BetStatus, "PENDING"> }) {
  const { label, className } = SETTLED_BADGE[status];
  return (
    <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

/** Small per-leg status dot inside an accumulator card — WON green, LOST red, VOID grey, still PENDING dimmed. */
function LegStatusDot({ status }: { status: BetStatus }) {
  const className =
    status === "WON"
      ? "bg-success"
      : status === "LOST"
        ? "bg-live"
        : status === "VOID"
          ? "bg-text-secondary/50"
          : "bg-gold";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

/**
 * A PENDING single bet can only be self-cancelled while its event hasn't
 * kicked off yet — see cancel_bet's own check in
 * supabase/migrations/0017_user_bet_cancellation.sql. Gating the button
 * on the same condition here means a user never sees "Cancel" on a bet
 * they're not actually allowed to cancel, rather than showing it and
 * letting the server reject it.
 *
 * Accumulators don't get this control yet — cancelling one leg of a
 * combined bet raises the same "how do the other legs' odds get
 * repriced" question a void-leg settlement answers by dropping it from
 * the product, but doing that safely *before* the other legs have
 * settled needs more thought than this pass covers. Scope boundary, not
 * an oversight.
 */
function CancelBetControl({ betId }: { betId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelBet(betId);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Cancel this bet and refund the stake?</span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-md bg-live px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Keep bet
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-live">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-live"
    >
      <X className="h-3.5 w-3.5" />
      Cancel bet
    </button>
  );
}

function SingleCard({ bet }: { bet: MySingleBetCard }) {
  const scoreLine =
    bet.homeScore !== null && bet.awayScore !== null ? `${bet.homeScore}–${bet.awayScore}` : null;
  const cancellable = bet.status === "PENDING" && bet.eventStatus === "PUBLISHED";

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {bet.competitionName && <p className="truncate text-xs text-text-secondary">{bet.competitionName}</p>}
          <p className="truncate text-sm font-medium text-text-primary">
            {bet.homeTeam} vs {bet.awayTeam}
            {scoreLine && <span className="ml-2 font-mono text-text-secondary">{scoreLine}</span>}
          </p>
        </div>
        <div className="shrink-0">
          {bet.status === "PENDING" ? (
            <ActiveBadge eventStatus={bet.eventStatus} />
          ) : (
            <SettledBadge status={bet.status} />
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-text-secondary">
        {bet.marketName}: <span className="font-medium text-text-primary">{bet.selectionLabel}</span>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-text-secondary">
          Odds <span className="font-mono text-text-primary">{bet.odds.toFixed(2)}</span> · Stake{" "}
          <span className="font-mono text-text-primary">{formatKES(bet.stake)}</span>
        </span>
        <span className={`font-semibold ${bet.status === "LOST" ? "text-text-secondary line-through" : "text-text-primary"}`}>
          {bet.status === "WON"
            ? `Won ${formatKES(bet.potentialPayout)}`
            : bet.status === "VOID"
              ? `Refunded ${formatKES(bet.stake)}`
              : `Possible win ${formatKES(bet.potentialPayout)}`}
        </span>
      </div>

      {cancellable && (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <CancelBetControl betId={bet.id} />
        </div>
      )}
    </div>
  );
}

/** An accumulator's card: every leg listed with its own status dot, then the combined odds/stake/payout — one bet, several matches. */
function AccumulatorCard({ bet }: { bet: MyAccumulatorBetCard }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">
          Accumulator · {bet.legs.length} selection{bet.legs.length === 1 ? "" : "s"}
        </p>
        <div className="shrink-0">
          {bet.status === "PENDING" ? <AccumulatorPendingBadge /> : <SettledBadge status={bet.status} />}
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        {bet.legs.map((leg, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <LegStatusDot status={leg.status} />
              <span className="min-w-0 truncate text-text-secondary">
                {leg.eventLabel} — <span className="text-text-primary">{leg.selectionLabel}</span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs text-text-secondary">{leg.odds.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-text-secondary">
          Total odds <span className="font-mono text-text-primary">{bet.totalOdds.toFixed(2)}</span> · Stake{" "}
          <span className="font-mono text-text-primary">{formatKES(bet.stake)}</span>
        </span>
        <span className={`font-semibold ${bet.status === "LOST" ? "text-text-secondary line-through" : "text-text-primary"}`}>
          {bet.status === "WON"
            ? `Won ${formatKES(bet.potentialPayout)}`
            : bet.status === "VOID"
              ? `Refunded ${formatKES(bet.stake)}`
              : `Possible win ${formatKES(bet.potentialPayout)}`}
        </span>
      </div>
    </div>
  );
}

function BetCard({ bet }: { bet: MyBetCard }) {
  return bet.kind === "single" ? <SingleCard bet={bet} /> : <AccumulatorCard bet={bet} />;
}

interface MyBetsManagerProps {
  activeBets: MyBetCard[];
  settledBets: MyBetCard[];
  settledPagination?: React.ReactNode;
}

/**
 * "My Bets" — active vs settled, singles and accumulators merged into
 * one list per tab (newest first). Each single bet shows exactly what
 * the stake and odds add up to (Stake × Odds = Possible Win, the same
 * figure odds_at_placement/potential_payout already lock in at
 * placement time); each accumulator shows every leg plus the combined
 * odds/stake/payout the same way place_accumulator_bet computed it.
 *
 * No cash-out. That needs a live re-pricing engine deciding what a bet
 * is worth *before* it settles, which doesn't exist here — Phase 2's
 * roadmap explicitly flagged partial cash-out as an undecided question,
 * and it's still undecided. A cash-out button with no real offer behind
 * it would be worse than not having one.
 */
export function MyBetsManager({ activeBets, settledBets, settledPagination }: MyBetsManagerProps) {
  const [tab, setTab] = useState<"active" | "settled">("active");

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="My Bets" className="flex gap-1 border-b border-border">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          onClick={() => setTab("active")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "active" ? "border-b-2 border-gold text-text-primary" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Active Bets ({activeBets.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "settled"}
          onClick={() => setTab("settled")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "settled" ? "border-b-2 border-gold text-text-primary" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Settled Bets
        </button>
      </div>

      {tab === "active" ? (
        activeBets.length === 0 ? (
          <p className="card px-6 py-10 text-center text-sm text-text-secondary">
            No active bets. Odds show up on an event&apos;s Betting tab once markets are priced.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activeBets.map((b) => (
              <BetCard key={`${b.kind}-${b.id}`} bet={b} />
            ))}
          </div>
        )
      ) : settledBets.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-text-secondary">No settled bets yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {settledBets.map((b) => (
            <BetCard key={`${b.kind}-${b.id}`} bet={b} />
          ))}
          {settledPagination}
        </div>
      )}
    </div>
  );
}
