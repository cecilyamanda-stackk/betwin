"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface BreadcrumbContextValue {
  labels: Record<string, string>;
  setLabel: (key: string, label: string) => void;
  clearLabel: (key: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

/**
 * Wraps the admin console so any nested page can register a friendly
 * breadcrumb label for a dynamic route segment (e.g. an event id → "Man
 * Utd vs Arsenal") without AdminBreadcrumbs having to know how to fetch
 * that data itself. Scoped to the console layout, not global — the
 * breadcrumb is admin-only chrome.
 */
export function AdminBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setLabel = useCallback((key: string, label: string) => {
    setLabels((prev) => (prev[key] === label ? prev : { ...prev, [key]: label }));
  }, []);

  const clearLabel = useCallback((key: string) => {
    setLabels((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ labels, setLabel, clearLabel }}>{children}</BreadcrumbContext.Provider>
  );
}

/**
 * Call from a detail page/manager once the entity's display name is
 * known — e.g. `useAdminBreadcrumbLabel(event.id, `${homeTeam} vs
 * ${awayTeam}`)`. Registers on mount, clears on unmount so a stale label
 * from a previously visited entity never lingers.
 */
export function useAdminBreadcrumbLabel(key: string | undefined, label: string | undefined) {
  const ctx = useContext(BreadcrumbContext);

  useEffect(() => {
    if (!ctx || !key || !label) return;
    ctx.setLabel(key, label);
    return () => ctx.clearLabel(key);
  }, [ctx, key, label]);
}

/** Read by AdminBreadcrumbs to resolve any segment that's had a friendly label registered. */
export function useAdminBreadcrumbLabels() {
  return useContext(BreadcrumbContext)?.labels ?? {};
}
