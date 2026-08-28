import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Base path, e.g. "/admin/users" */
  basePath: string;
  /** Current search params (minus "page") to preserve across page links. */
  searchParams?: Record<string, string | undefined>;
}

function buildHref(basePath: string, page: number, searchParams?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Prev/Next + "Page X of Y" pager for server-rendered list pages
 * (Phase 5 — section 45). Plain links, no client JS: works with the same
 * GET-param pattern the admin filter forms already use, so it composes
 * with existing filters instead of clobbering them.
 */
export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1 ? buildHref(basePath, page - 1, searchParams) : undefined;
  const nextHref = page < totalPages ? buildHref(basePath, page + 1, searchParams) : undefined;

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <PagerLink href={prevHref} label="Previous">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </PagerLink>

      <p className="text-sm text-text-secondary" aria-live="polite">
        Page {page} of {totalPages}
      </p>

      <PagerLink href={nextHref} label="Next">
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-disabled="true" className="btn-secondary pointer-events-none gap-1 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="btn-secondary gap-1">
      {children}
    </Link>
  );
}
