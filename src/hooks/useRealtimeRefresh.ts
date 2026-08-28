"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Postgres changes on one table (Phase 5 — section 38,
 * "add [Realtime] only where it provides real value"). On any matching
 * change it calls `router.refresh()`, debounced, so the current server
 * component re-fetches fresh data without a full page reload or any
 * client-side data-fetching duplication.
 *
 * Used for things a user is actively watching that change from *outside*
 * their own actions — a match going LIVE→FINISHED, another player's
 * prediction getting settled — where a stale screen is actually
 * misleading, not just cosmetic.
 */
export function useRealtimeRefresh(table: string, filter?: string) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => {
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 400);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
