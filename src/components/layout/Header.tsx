import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { LiveTicker } from "./LiveTicker";
import { SearchBar } from "@/components/ui/SearchBar";
import { AuthButtons } from "./AuthButtons";
import { SignOutButton } from "./SignOutButton";
import { DepositButton } from "@/components/wallet/DepositButton";
import type { MpesaPaymentConfig } from "@/lib/mpesa";
import { formatKES } from "@/lib/currency";

interface HeaderProps {
  /** Signed-in user's email, or null if signed out. Replaces the Login/Register buttons once set. */
  userEmail: string | null;
  /** Currently-LIVE events, fetched by (public)/layout.tsx. Empty until an admin marks one LIVE. */
  liveEvents?: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  }[];
  /**
   * Wagering roadmap Phase 4. Undefined/null hides the balance + Deposit
   * button entirely — used both for signed-out visitors and for the
   * wallet_enabled platform setting being off (see (public)/layout.tsx).
   */
  walletBalance?: number | null;
  mpesaConfig?: MpesaPaymentConfig;
}

/**
 * Sticky top navigation (section 8). Server component — auth state is
 * passed in from the layout, which already knows the session.
 */
export function Header({ userEmail, liveEvents = [], walletBalance, mpesaConfig }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:gap-6 md:px-6">
        <Link href="/" aria-label="Betwin home" className="shrink-0">
          <BrandLogo />
        </Link>

        <LiveTicker liveEvents={liveEvents} />

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <div className="hidden flex-1 justify-end sm:flex">
            <SearchBar />
          </div>

          {userEmail ? (
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {walletBalance !== undefined && walletBalance !== null && mpesaConfig && (
                <>
                  <span className="pill shrink-0 font-mono text-gold" title="Wallet balance">
                    {formatKES(walletBalance)}
                  </span>
                  <DepositButton mpesaConfig={mpesaConfig} />
                </>
              )}
              {/*
                Hidden below md, not just truncated further: on mobile
                there's already a Profile tab in MobileNav, so this link
                is redundant there — freeing the room the balance/Deposit
                button need on a screen that previously only had to fit
                the email + sign-out (roadmap: "needs its own pass rather
                than just appending").
              */}
              <Link
                href="/profile"
                className="hidden max-w-[180px] truncate text-sm font-medium text-text-primary hover:text-gold md:inline"
                title={userEmail}
              >
                {userEmail}
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <AuthButtons />
          )}
        </div>
      </div>
    </header>
  );
}
