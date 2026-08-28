"use client";

import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

/**
 * Renders nothing — just mounts `useRealtimeRefresh` from inside a server
 * page. Drop this next to server-fetched data that should update live
 * (Phase 5 — section 38) without turning the whole page into a client
 * component or duplicating its fetch/rendering logic client-side.
 */
export function RealtimeRefresher({ table, filter }: { table: string; filter?: string }) {
  useRealtimeRefresh(table, filter);
  return null;
}
