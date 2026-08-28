"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Wallet, History, ShieldAlert, Lock } from "lucide-react";

interface AccountSidebarProps {
  /** Hides the Wallet link when wallet_enabled is off — same gate as the header (Phase 4). */
  walletEnabled: boolean;
}

const BASE_LINKS = [
  { href: "/account", label: "Profile Info", icon: User },
  { href: "/account/wallet", label: "Wallet", icon: Wallet, requiresWallet: true },
  { href: "/account/history", label: "Bet History", icon: History },
  { href: "/account/responsible-gambling", label: "Responsible Gambling", icon: ShieldAlert },
  { href: "/account/security", label: "Security & 2FA", icon: Lock },
] as const;

/** Left sidebar for the account section (Phase 6 — split sidebar + tab layout). */
export function AccountSidebar({ walletEnabled }: AccountSidebarProps) {
  const pathname = usePathname();
  const links = BASE_LINKS.filter((l) => !("requiresWallet" in l && l.requiresWallet) || walletEnabled);

  return (
    <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:w-56 md:shrink-0 md:flex-col md:overflow-visible">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors md:shrink ${
              active
                ? "bg-surface text-gold"
                : "text-text-secondary hover:bg-surface hover:text-text-primary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
