import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { NOINDEX_METADATA } from "@/lib/seo";

// Covers the whole /account subtree — wallet, history, security,
// responsible gambling settings. All auth-gated (redirects to login
// below), so a crawler could never see real content here anyway; this
// is the defensive backstop in case a page ever gets linked from
// somewhere Google can reach.
export const metadata: Metadata = NOINDEX_METADATA;

/**
 * /account — split sidebar + tab layout (wagering roadmap Phase 6).
 * Each sidebar item is its own route (/account, /account/wallet, etc.)
 * rather than client-side tabs, matching how /profile/settings and
 * /profile/achievements are already separate routes in this codebase —
 * each tab's data fetch stays server-rendered and independently
 * bookmarkable/reloadable.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: walletSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "wallet_enabled")
    .single();
  const walletEnabled = Boolean(walletSetting?.value ?? false);

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <AccountSidebar walletEnabled={walletEnabled} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
