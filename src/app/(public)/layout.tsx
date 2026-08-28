import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { BRAND } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { parseMpesaPaymentConfig } from "@/lib/mpesa";

interface RawLiveEvent {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
}

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: "Predict match outcomes, climb the leaderboard, and follow live sports events.",
};

/**
 * Applies to every public route. Admin routes get their own layout
 * (src/app/admin/layout.tsx) so the two surfaces stay visually distinct
 * per section 20's "keep admin visually separate" requirement.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Header ticker (section 8): mirrors the query on /live, capped to a
  // handful since this only needs to feed a one-line ticker, not a full
  // grid. Was previously never fetched at all — LiveTicker always got an
  // empty array and permanently showed "No live matches right now".
  const { data: liveRows } = await supabase
    .from("events")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .eq("status", "LIVE")
    .order("start_time")
    .limit(5);
  const liveRowsTyped = (liveRows ?? []) as RawLiveEvent[];

  const liveTeamIds = [...new Set(liveRowsTyped.flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const { data: liveTeams } = liveTeamIds.length
    ? await supabase.from("teams").select("id, name, short_name").in("id", liveTeamIds)
    : { data: [] as { id: string; name: string; short_name: string | null }[] };
  const liveTeamById = new Map((liveTeams ?? []).map((t) => [t.id, t]));

  const liveEvents = liveRowsTyped.map((e) => ({
    id: e.id,
    homeTeam: liveTeamById.get(e.home_team_id)?.short_name ?? liveTeamById.get(e.home_team_id)?.name ?? "TBD",
    awayTeam: liveTeamById.get(e.away_team_id)?.short_name ?? liveTeamById.get(e.away_team_id)?.name ?? "TBD",
    homeScore: e.home_score,
    awayScore: e.away_score,
  }));

  // Wagering roadmap Phase 4: header balance + Deposit button, gated
  // behind wallet_enabled (Phase 8's rollout flag, introduced early in
  // the Phase 4 migration — see its scope note) so the UI doesn't appear
  // for ordinary users before deposits actually work.
  const { data: walletSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "wallet_enabled")
    .single();
  const walletEnabled = Boolean(walletSetting?.value ?? false);

  let walletBalance: number | null = null;
  if (user && walletEnabled) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("total_balance")
      .eq("user_id", user.id)
      .single();
    walletBalance = wallet?.total_balance ?? 0;
  }

  const { data: mpesaSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "mpesa_payment_config")
    .single();
  const mpesaConfig = parseMpesaPaymentConfig(mpesaSetting?.value);

  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        {/* Visually hidden until focused — first tab stop, lets keyboard/screen-reader users skip Header+Sidebar (accessibility pass, section 5). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
        >
          Skip to main content
        </a>
        {/*
          No RealtimeRefresher mounted here for "events" on purpose: the
          homepage and /live already mount `<RealtimeRefresher table="events" />`,
          and router.refresh() re-renders this whole layout (ticker
          included) along with them. A second identically-named "events"
          channel at this level would double-subscribe on every page that
          already has one instead of adding real coverage.

          "wallets" has no such page-level owner — the balance only lives
          in this layout's Header — so it's subscribed here instead,
          scoped to the signed-in user's own row, and only while the
          wallet UI is actually visible.
        */}
        <Header
          userEmail={user?.email ?? null}
          liveEvents={liveEvents}
          walletBalance={walletEnabled ? walletBalance : undefined}
          mpesaConfig={walletEnabled ? mpesaConfig : undefined}
        />
        {user && walletEnabled && <RealtimeRefresher table="wallets" filter={`user_id=eq.${user.id}`} />}
        <div className="mx-auto flex w-full max-w-[1440px] flex-1">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
