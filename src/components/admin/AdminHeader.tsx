"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface AdminHeaderProps {
  displayName: string;
  role: string;
}

/**
 * Top bar for every /admin page — identity + sign out, always visible.
 * Below `lg`, also carries the hamburger button that opens AdminMobileNav's
 * drawer, since AdminSidebar hides itself at that breakpoint. Identity text
 * hides below `sm` rather than fighting the hamburger + logo + sign-out
 * button for space on the smallest screens.
 */
export function AdminHeader({ displayName, role }: AdminHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-2 md:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <BrandLogo showWordmark={false} />
          <span className="font-display text-sm font-bold text-text-primary">Admin</span>
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("admin-command-palette:open"))}
          aria-label="Jump to a page (Ctrl+K)"
          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-text-secondary transition-colors hover:border-gold/50 hover:text-text-primary"
        >
          <Search className="h-4 w-4" />
          <kbd className="hidden text-[10px] text-text-secondary md:inline">{isMac ? "\u2318K" : "Ctrl K"}</kbd>
        </button>
        <span className="hidden text-sm text-text-secondary sm:inline">
          <span className="text-text-primary">{displayName}</span> · {role}
        </span>
        <SignOutButton />
      </div>
      <AdminMobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </header>
  );
}
