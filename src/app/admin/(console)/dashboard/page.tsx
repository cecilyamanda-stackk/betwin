import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Protected by middleware.ts, the (console) layout's requireAdmin() call,
 * AND this one — belt and suspenders is fine for a page that's cheap to
 * render; the layout call is what actually matters.
 *
 * Stat cards now reflect the real sports catalogue (Phase 2) plus the
 * Phase 4 admin data layer: users, and a "needs settlement" count that
 * doubles as a nudge toward /admin/results.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [sports, competitions, teams, events, liveEvents, users, unsettledMarkets] = await Promise.all([
    supabase.from("sports").select("id", { count: "exact", head: true }),
    supabase.from("competitions").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "LIVE"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("markets")
      .select("id, events!inner(status)", { count: "exact", head: true })
      .is("winning_selection_id", null)
      .in("events.status", ["LIVE", "FINISHED"]),
  ]);

  const cards = [
    { label: "Users", value: users.count ?? 0, href: "/admin/users" },
    { label: "Sports", value: sports.count ?? 0, href: "/admin/sports" },
    { label: "Competitions", value: competitions.count ?? 0, href: "/admin/competitions" },
    { label: "Teams", value: teams.count ?? 0, href: "/admin/teams" },
    { label: "Events", value: events.count ?? 0, href: "/admin/events" },
    { label: "Live now", value: liveEvents.count ?? 0, href: "/admin/events" },
    { label: "Needs a result", value: unsettledMarkets.count ?? 0, href: "/admin/results" },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-4 transition-colors hover:border-gold/40">
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
            <p className="mt-1 text-sm text-text-secondary">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
