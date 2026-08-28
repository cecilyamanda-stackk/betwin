"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Trophy, ListChecks, User } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/sports", label: "Sports", icon: Trophy },
  { href: "/predictions", label: "Predictions", icon: ListChecks },
  { href: "/profile", label: "Profile", icon: User },
];

/** Bottom tab bar shown below md breakpoint (section 34). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              active ? "text-gold" : "text-text-secondary"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
