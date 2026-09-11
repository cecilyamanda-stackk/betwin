"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Shield,
  Users2,
  UsersRound,
  CalendarDays,
  ListTree,
  UserCog,
  ClipboardCheck,
  Target,
  Receipt,
  BarChart3,
  Bell,
  ScrollText,
  Settings,
  Wallet,
} from "lucide-react";

/**
 * Grouped so related tasks sit visually together — teams/sports/competitions
 * all feed events; events/markets/results are the lifecycle of a single
 * game; deposits/predictions are money movement, kept apart from read-only
 * reporting (Community) and pure administration (System). See Phase 2 of
 * the admin UI/UX roadmap for the reasoning behind this exact grouping.
 *
 * Flattened via ADMIN_NAV (below) wherever something just needs "all the
 * links" (e.g. the old escape-pattern audit) rather than the grouped view.
 */
interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/sports", label: "Sports", icon: Trophy },
      { href: "/admin/competitions", label: "Competitions", icon: Shield },
      { href: "/admin/teams", label: "Teams", icon: Users2 },
    ],
  },
  {
    title: "Games",
    items: [
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/markets", label: "Markets", icon: ListTree },
      { href: "/admin/results", label: "Results", icon: ClipboardCheck },
    ],
  },
  {
    title: "Wagering & Money",
    items: [
      { href: "/admin/deposits", label: "Deposits", icon: Wallet },
      { href: "/admin/bets", label: "Bets", icon: Receipt },
      { href: "/admin/bettors", label: "Bettors", icon: UsersRound },
      { href: "/admin/predictions", label: "Predictions", icon: Target },
    ],
  },
  {
    title: "Community",
    items: [
      { href: "/admin/leaderboards", label: "Leaderboards", icon: BarChart3 },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Flat view of the same nav, for callers that just need "every admin link" (e.g. route audits). */
export const ADMIN_NAV = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

interface AdminNavListProps {
  /** Called after a link is activated — the mobile drawer uses this to close itself. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The admin console's nav links, grouped, as a single source of truth.
 * Rendered directly by AdminSidebar on desktop and inside AdminMobileNav's
 * drawer below `lg` — one copy of "what's in the nav, which link is
 * active, and how it's grouped" so the two surfaces can't drift apart.
 *
 * Section labels reuse the same visual language as the public site's
 * Sidebar.tsx SidebarSection (uppercase, tracking-wider, text-xs,
 * text-text-secondary) rather than inventing a new pattern.
 *
 * No lock/dimmed treatment for SUPER_ADMIN-only items yet — today
 * requireSuperAdmin only gates a single action inside the Users page
 * (src/actions/admin/users.ts's updateUserRole), not a whole page, so
 * there's nothing at the nav level to visually restrict. Revisit once a
 * requireSuperAdmin-gated action grows to cover an entire admin page.
 */
export function AdminNavList({ onNavigate, className = "" }: AdminNavListProps) {
  const pathname = usePathname();

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {group.title}
          </h3>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-surface-secondary text-text-primary"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
