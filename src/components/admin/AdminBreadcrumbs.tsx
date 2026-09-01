"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ADMIN_NAV } from "@/components/admin/AdminNavList";
import { useAdminBreadcrumbLabels } from "@/components/admin/AdminBreadcrumbContext";

const NAV_LABEL_BY_SEGMENT: Record<string, string> = Object.fromEntries(
  ADMIN_NAV.map((item) => [item.href.replace(/^\/admin\//, ""), item.label])
);

function humanize(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Breadcrumb strip under AdminHeader, auto-derived from the route
 * segments the same way AdminNavList's own active-link check parses them.
 * Only renders on pages nested more than one level under /admin — a
 * top-level page like /admin/sports already has its own highlighted nav
 * item, so a one-crumb breadcrumb there would just repeat that.
 *
 * A dynamic id segment (e.g. /admin/events/<id>) falls back to "Event
 * details" unless the page has registered a friendlier label via
 * useAdminBreadcrumbLabel (see AdminBreadcrumbContext) — event and user
 * detail pages do this once their data loads, so the crumb reads
 * "Man Utd vs Arsenal" rather than a raw id.
 */
export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const labels = useAdminBreadcrumbLabels();

  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const topSegment = segments[0] as string;

  let hrefSoFar = "/admin";
  const crumbs = segments.map((segment, i) => {
    hrefSoFar += `/${segment}`;
    const isLast = i === segments.length - 1;

    let label: string;
    if (i === 0 && NAV_LABEL_BY_SEGMENT[segment]) {
      label = NAV_LABEL_BY_SEGMENT[segment];
    } else if (labels[segment]) {
      label = labels[segment];
    } else if (segment === "new") {
      label = "New";
    } else {
      const sectionLabel = NAV_LABEL_BY_SEGMENT[topSegment] ?? humanize(topSegment);
      const singular = sectionLabel.endsWith("s") ? sectionLabel.slice(0, -1) : sectionLabel;
      label = `${singular} details`;
    }

    return { href: hrefSoFar, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="shrink-0 border-b border-border bg-surface px-4 py-2.5 md:px-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
        <li>
          <Link href="/admin/dashboard" className="transition-colors hover:text-text-primary">
            Admin
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {crumb.isLast ? (
              <span aria-current="page" className="font-medium text-text-primary">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="transition-colors hover:text-text-primary">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
