"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// TODO: move to platform_settings once Phase 0 settles real limits — same
// placeholder-minimum spirit as the rest of the wallet code.
export const MIN_STAKE_KES = 10;
/** Default stake — the accumulator's total, and each leg's own Singles-tab stake — autofills to this. */
export const DEFAULT_STAKE_KES = "10";

export type BetSlipMode = "accumulator" | "singles";

export interface BetSlipItem {
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  /** "Home Team vs Away Team" — lets a selection be told apart from another match's, since the slip can hold picks from several matches at once. */
  eventLabel: string;
  /** Accepted odds — what a placement locks in once submitted. */
  odds: number;
  /** Set when live odds moved after this was selected and hasn't been accepted/declined yet. */
  pendingOdds: number | null;
  /** Only used in Singles mode — each leg staked and placed independently. Accumulator mode uses the shared accumulatorStake instead. */
  singleStake: string;
  status: "idle" | "pending" | "placed" | "error";
  message: string | null;
  /** Generated once per selection and reused on retry — see placeBet's/placeAccumulatorBet's docs. */
  idempotencyKey: string;
}

interface ToggleSelectionInput {
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  eventLabel: string;
  odds: number;
}

interface BetSlipContextValue {
  items: BetSlipItem[];
  /**
   * Accumulator vs Singles. Only meaningful — and only shown as a tab
   * toggle — once there are 2+ items; a single selection has nothing to
   * combine, so it's always placed as a single regardless of this value.
   */
  mode: BetSlipMode;
  /** Explicit user choice — flips a manuallySet flag so crossing the 2-item threshold later doesn't stomp it back to Accumulator. */
  setMode: (mode: BetSlipMode) => void;
  /** Total stake for the whole accumulator — maps 1:1 to what leaves the wallet, never multiplied by leg count. */
  accumulatorStake: string;
  setAccumulatorStake: (stake: string) => void;
  setSingleStake: (selectionId: string, stake: string) => void;
  /** Adds the selection, or removes it if it's already the pick for that market (click-to-deselect). Picking a different outcome within the same market replaces that market's entry; picking one in a different market or a different match just adds alongside what's already there. */
  toggleSelection: (input: ToggleSelectionInput) => void;
  removeItem: (selectionId: string) => void;
  clear: () => void;
  isSelected: (marketId: string, selectionId: string) => boolean;
  /** Called by odds grids as they render fresh data, so a moved price surfaces even for a selection already held. */
  reportLiveOdds: (selectionId: string, currentOdds: number) => void;
  acceptOddsChange: (selectionId: string) => void;
  /** Declining a new price means the user doesn't want this bet at the new price — removes it rather than pretending the old one still applies. */
  declineOddsChange: (selectionId: string) => void;
  setItemResult: (selectionId: string, status: BetSlipItem["status"], message: string | null) => void;
  setAccumulatorResult: (status: "idle" | "pending" | "placed" | "error", message: string | null) => void;
  accumulatorStatus: "idle" | "pending" | "placed" | "error";
  accumulatorMessage: string | null;
  /** Small-screen full bet screen, opened by tapping the yellow strip. */
  mobileSheetOpen: boolean;
  openMobileSheet: () => void;
  closeMobileSheet: () => void;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Persistence ────────────────────────────────────────────────────────
// "Just like a shopping cart": a refresh (or closing the tab) shouldn't
// silently drop selections. Guests get localStorage; a signed-in user
// additionally gets a server-side row (bet_slip_state — see
// 0019_bet_slip_persistence.sql) so the same cart follows them to
// another device/browser. Only items that haven't actually been placed
// yet are ever persisted — a placed bet is already recorded for real in
// `bets`/`accumulator_bets`, restoring it into the slip would just be
// showing a stale duplicate.
const LOCAL_STORAGE_KEY = "betwin:bet-slip:v1";

interface PersistedItem {
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  eventLabel: string;
  odds: number;
  singleStake: string;
  idempotencyKey: string;
}

interface PersistedSlip {
  mode: BetSlipMode;
  accumulatorStake: string;
  items: PersistedItem[];
}

function toPersisted(items: BetSlipItem[], mode: BetSlipMode, accumulatorStake: string): PersistedSlip {
  return {
    mode,
    accumulatorStake,
    items: items
      .filter((i) => i.status !== "placed")
      .map((i) => ({
        marketId: i.marketId,
        marketName: i.marketName,
        selectionId: i.selectionId,
        selectionLabel: i.selectionLabel,
        eventLabel: i.eventLabel,
        odds: i.odds,
        singleStake: i.singleStake,
        idempotencyKey: i.idempotencyKey,
      })),
  };
}

function fromPersisted(p: PersistedSlip): BetSlipItem[] {
  return p.items.map((i) => ({ ...i, pendingOdds: null, status: "idle", message: null }));
}

function loadLocal(): PersistedSlip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSlip;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocal(slip: PersistedSlip) {
  if (typeof window === "undefined") return;
  try {
    if (slip.items.length === 0) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(slip));
    }
  } catch {
    // Storage full/disabled — the slip still works for this session, it just won't survive a refresh.
  }
}

/**
 * Bet slip — holds a selection from every market someone has tapped,
 * across as many different matches as they like (one entry per market;
 * picking a different outcome within the same market replaces it). Two
 * modes once there are 2+ selections: Accumulator (default) combines
 * everything into one stake at combined odds; Singles places each
 * selection independently with its own stake. Presentation lives
 * elsewhere — BetSlipDesktopPanel (always-expanded right-hand panel) and
 * BetSlipMobileStrip/Sheet (yellow strip + full screen) — this context
 * only owns state, including keeping it alive across a refresh.
 */
export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BetSlipItem[]>([]);
  const [mode, setModeState] = useState<BetSlipMode>("accumulator");
  const [accumulatorStake, setAccumulatorStake] = useState("");
  const [accumulatorStatus, setAccumulatorStatus] = useState<"idle" | "pending" | "placed" | "error">("idle");
  const [accumulatorMessage, setAccumulatorMessage] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const modeManuallySet = useRef(false);
  const prevItemCount = useRef(0);
  const hydrated = useRef(false);

  // ── Prune stale selections restored from local/server storage. ──────
  // A restored slip can reference a selection that no longer checks out
  // — deleted/reset in the database, deactivated, or its market/event
  // closed since it was added. Left alone, that item just sits there
  // looking selected until the user tries to place and gets a confusing
  // "could not be found" failure from the RPC. Instead, validate every
  // restored id against current state right after loading it, and
  // silently drop whatever no longer qualifies — same rules
  // place_bet/place_accumulator_bet enforce server-side, applied early.
  // Declared here, before the hydration effect below that calls it, so
  // it's already initialized by the time that effect's dependency array
  // is evaluated during render.
  const pruneStale = useCallback(async (supabase: ReturnType<typeof createClient>, ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("market_selections")
      .select("id, active, market:markets(status, event:events(status))")
      .in("id", ids);

    const validIds = new Set(
      (data ?? [])
        .filter((row) => {
          const market = row.market as unknown as { status: string; event: { status: string } | null } | null;
          return (
            row.active &&
            market?.status === "OPEN" &&
            (market?.event?.status === "PUBLISHED" || market?.event?.status === "LIVE")
          );
        })
        .map((row) => row.id as string)
    );

    if (validIds.size === ids.length) return; // everything still checks out

    structuralChange.current = true;
    setItems((prev) => prev.filter((i) => validIds.has(i.selectionId)));
  }, []);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  // Flipped true by any add/remove/clear/mode-switch — anything that changes
  // *which selections are in the slip*, as opposed to someone still typing a
  // stake amount. Read (and reset) by the persistence effect below to decide
  // whether to save right away or keep the normal typing debounce.
  const structuralChange = useRef(false);

  // ── Hydrate once on mount: local cache first (so there's no flash of
  // empty state), then prefer the server's copy if a signed-in user has
  // one — that's the copy that follows them across devices. ──────────
  useEffect(() => {
    const local = loadLocal();
    const supabase = createClient();

    if (local && local.items.length > 0) {
      setItems(fromPersisted(local));
      setModeState(local.mode);
      setAccumulatorStake(local.accumulatorStake);
      prevItemCount.current = local.items.length;
      modeManuallySet.current = true; // a restored slip keeps whatever tab it was left on, not the auto-default
      pruneStale(supabase, local.items.map((i) => i.selectionId));
    }

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null;
      if (!user) {
        hydrated.current = true;
        return;
      }

      const { data } = await supabase.from("bet_slip_state").select("state").eq("user_id", user.id).maybeSingle();
      const serverSlip = data?.state as PersistedSlip | undefined;
      if (serverSlip && Array.isArray(serverSlip.items) && serverSlip.items.length > 0) {
        setItems(fromPersisted(serverSlip));
        setModeState(serverSlip.mode);
        setAccumulatorStake(serverSlip.accumulatorStake);
        prevItemCount.current = serverSlip.items.length;
        modeManuallySet.current = true;
        pruneStale(supabase, serverSlip.items.map((i) => i.selectionId));
      } else if (local && local.items.length > 0) {
        // First time this account has a server cart — carry the local
        // (guest) draft over instead of losing it.
        await supabase.from("bet_slip_state").upsert({ user_id: user.id, state: local as unknown as Record<string, unknown> });
      }
      hydrated.current = true;
    })();
  }, [pruneStale]);

  // ── Prune stale selections restored from local/server storage. ──────
  // A restored slip can reference a selection that no longer checks out
  // — deleted/reset in the database, deactivated, or its market/event
  // closed since it was added. Left alone, that item just sits there
  // looking selected until the user tries to place and gets a confusing
  // "could not be found" failure from the RPC. Instead, validate every
  // restored id against current state right after loading it, and
  // silently drop whatever no longer qualifies — same rules
  // place_bet/place_accumulator_bet enforce server-side, applied early.
  // ── Auto-default to Accumulator the moment the slip crosses from
  // <2 to 2+ items — but only if the user hasn't already picked a tab
  // for this "session" of having multiple items. Dropping back below 2
  // resets that so the next multi-selection starts fresh on Accumulator
  // again, per the "must automatically initialize" spec. ──────────────
  useEffect(() => {
    if (prevItemCount.current < 2 && items.length >= 2 && !modeManuallySet.current) {
      setModeState("accumulator");
    }
    if (items.length < 2) {
      modeManuallySet.current = false;
    }
    prevItemCount.current = items.length;
  }, [items.length]);

  // ── Persist on every change, once initial hydration has finished so
  // this doesn't immediately stomp a just-loaded cart with an empty one.
  // Structural changes (a selection added/removed, slip cleared, tab
  // switched) save right away — those are discrete clicks, not something
  // that benefits from debouncing, and waiting risked a fast refresh
  // catching storage still holding the pre-change state (see "Clear all"
  // history below). Stake-amount typing stays debounced, since that fires
  // on every keystroke and doesn't need a network round-trip each time. ─
  useEffect(() => {
    if (!hydrated.current) return;
    const snapshot = toPersisted(items, mode, accumulatorStake);
    const delay = structuralChange.current ? 0 : 500;
    structuralChange.current = false;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveLocal(snapshot);
      const userId = userIdRef.current;
      if (!userId) return;
      const supabase = createClient();
      if (snapshot.items.length === 0) {
        supabase.from("bet_slip_state").delete().eq("user_id", userId);
      } else {
        supabase.from("bet_slip_state").upsert({ user_id: userId, state: snapshot as unknown as Record<string, unknown> });
      }
    }, delay);
    return () => clearTimeout(saveTimer.current);
  }, [items, mode, accumulatorStake]);

  // ── Safety net for the debounce above: if the tab is about to close or
  // go to background, don't leave a pending save sitting in the 500ms
  // window — flush it now. Otherwise a refresh right after any change
  // (not just clear) can catch storage still holding the previous state. ─
  useEffect(() => {
    function flushNow() {
      if (!hydrated.current) return;
      clearTimeout(saveTimer.current);
      const snapshot = toPersisted(items, mode, accumulatorStake);
      saveLocal(snapshot);
      const userId = userIdRef.current;
      if (!userId) return;
      const supabase = createClient();
      if (snapshot.items.length === 0) {
        supabase.from("bet_slip_state").delete().eq("user_id", userId);
      } else {
        supabase.from("bet_slip_state").upsert({ user_id: userId, state: snapshot as unknown as Record<string, unknown> });
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushNow();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushNow);
    };
  }, [items, mode, accumulatorStake]);

  const setMode = useCallback((next: BetSlipMode) => {
    modeManuallySet.current = true;
    structuralChange.current = true;
    setModeState(next);
  }, []);

  const toggleSelection = useCallback<BetSlipContextValue["toggleSelection"]>((input) => {
    structuralChange.current = true;
    setItems((prev) => {
      const existing = prev.find((i) => i.marketId === input.marketId);
      if (existing?.selectionId === input.selectionId) {
        return prev.filter((i) => i.marketId !== input.marketId);
      }
      const withoutMarket = prev.filter((i) => i.marketId !== input.marketId);
      return [
        ...withoutMarket,
        {
          ...input,
          pendingOdds: null,
          singleStake: DEFAULT_STAKE_KES,
          status: "idle",
          message: null,
          idempotencyKey: newIdempotencyKey(),
        },
      ];
    });
    setAccumulatorStake((prev) => (prev.trim() === "" ? DEFAULT_STAKE_KES : prev));
    setAccumulatorStatus("idle");
    setAccumulatorMessage(null);
  }, []);

  const removeItem = useCallback((selectionId: string) => {
    structuralChange.current = true;
    setItems((prev) => prev.filter((i) => i.selectionId !== selectionId));
  }, []);

  const clear = useCallback(() => {
    structuralChange.current = true;
    setItems([]);
    setAccumulatorStake("");
    setAccumulatorStatus("idle");
    setAccumulatorMessage(null);
    setMobileSheetOpen(false);
  }, []);

  const setSingleStake = useCallback((selectionId: string, stake: string) => {
    setItems((prev) => prev.map((i) => (i.selectionId === selectionId ? { ...i, singleStake: stake } : i)));
  }, []);

  const setItemResult = useCallback((selectionId: string, status: BetSlipItem["status"], message: string | null) => {
    setItems((prev) => prev.map((i) => (i.selectionId === selectionId ? { ...i, status, message } : i)));
  }, []);

  const setAccumulatorResult = useCallback((status: "idle" | "pending" | "placed" | "error", message: string | null) => {
    setAccumulatorStatus(status);
    setAccumulatorMessage(message);
    if (status === "placed") {
      setItems((prev) => prev.map((i) => ({ ...i, status: "placed" })));
    }
  }, []);

  const isSelected = useCallback(
    (marketId: string, selectionId: string) => items.some((i) => i.marketId === marketId && i.selectionId === selectionId),
    [items]
  );

  const reportLiveOdds = useCallback((selectionId: string, currentOdds: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.selectionId !== selectionId) return i;
        if (i.status === "placed" || i.status === "pending") return i;
        if (i.pendingOdds !== null) return i; // already flagged, don't overwrite an unresolved change
        if (currentOdds === i.odds) return i;
        return { ...i, pendingOdds: currentOdds };
      })
    );
  }, []);

  const acceptOddsChange = useCallback((selectionId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.selectionId === selectionId && i.pendingOdds !== null ? { ...i, odds: i.pendingOdds, pendingOdds: null } : i))
    );
  }, []);

  const declineOddsChange = useCallback((selectionId: string) => {
    setItems((prev) => prev.filter((i) => i.selectionId !== selectionId));
  }, []);

  const openMobileSheet = useCallback(() => setMobileSheetOpen(true), []);
  const closeMobileSheet = useCallback(() => setMobileSheetOpen(false), []);

  const value = useMemo<BetSlipContextValue>(
    () => ({
      items,
      mode,
      setMode,
      accumulatorStake,
      setAccumulatorStake,
      setSingleStake,
      toggleSelection,
      removeItem,
      clear,
      isSelected,
      reportLiveOdds,
      acceptOddsChange,
      declineOddsChange,
      setItemResult,
      setAccumulatorResult,
      accumulatorStatus,
      accumulatorMessage,
      mobileSheetOpen,
      openMobileSheet,
      closeMobileSheet,
    }),
    [
      items,
      mode,
      setMode,
      accumulatorStake,
      setSingleStake,
      toggleSelection,
      removeItem,
      clear,
      isSelected,
      reportLiveOdds,
      acceptOddsChange,
      declineOddsChange,
      setItemResult,
      setAccumulatorResult,
      accumulatorStatus,
      accumulatorMessage,
      mobileSheetOpen,
      openMobileSheet,
      closeMobileSheet,
    ]
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip(): BetSlipContextValue {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within a BetSlipProvider");
  return ctx;
}