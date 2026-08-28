/**
 * Shared pagination helpers for server-rendered admin/list pages
 * (Phase 5 — section 45 query review). Pages stay plain GET query params
 * (?page=2) so lists remain server-rendered, bookmarkable, and don't need
 * a client component just to turn a page.
 */

export const DEFAULT_PAGE_SIZE = 25;

/** Parses a `?page=` search param into a safe 1-indexed page number. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/** Converts a 1-indexed page + page size into a Supabase `.range()` pair. */
export function pageRange(page: number, pageSize: number = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

export function totalPages(count: number | null, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (!count || count <= 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}
