import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountSidebar } from "@/components/account/AccountSidebar";

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
