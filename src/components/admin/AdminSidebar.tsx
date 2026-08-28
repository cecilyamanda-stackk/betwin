"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Shield,
  Users2,
  CalendarDays,
  ListTree,
  UserCog,
  ClipboardCheck,
  Target,
  BarChart3,
  Bell,
  ScrollText,
  Settings,
  Wallet,
} from "lucide-react";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sports", label: "Sports", icon: Trophy },
  { href: "/admin/competitions", label: "Competitions", icon: Shield },
  { href: "/admin/teams", label: "Teams", icon: Users2 },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/markets", label: "Markets", icon: ListTree },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/results", label: "Results", icon: ClipboardCheck },
  { href: "/admin/deposits", label: "Deposits", icon: Wallet },
  { href: "/admin/predictions", label: "Predictions", icon: Target },
  { href: "/admin/leaderboards", label: "Leaderboards", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

/**
 * Admin operations console nav (section 20/42). Deliberately separate
 * from the public Sidebar — see the note in admin/layout.tsx about the
 * admin surface reading as its own console, not a themed site variant.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-4">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
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
    </nav>
  );
}
