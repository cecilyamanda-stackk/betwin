import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { BRAND } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/events/EventCard";
import { LiveEventCard } from "@/components/events/LiveEventCard";
import { LeaderboardTable, type LeaderboardRow } from "@/components/leaderboard/LeaderboardTable";
import { TeamsGrid } from "@/components/betslip/TeamsGrid";
import { getOddsBoardEvents } from "@/lib/oddsBoard";
import type { EventStatus } from "@/types/database";

interface RawEvent {
  id: string;
  start_time: string;
  status: EventStatus;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  competition_id: string;
}

/**
 * Homepage (section 11). Order: Teams (bettable games) → Live →
 * Featured → Popular Competitions → Upcoming → Leaderboard preview.
 *
 * "Teams" goes first, above even Live — it's the primary "do something"
 * content once wallet betting is on, so a bettable game shouldn't be
 * buried below sections built for the points game. It's gated on
 * wallet_enabled and simply doesn't render when off or when no event has
 * a fully-priced headline market yet (see getOddsBoardEvents).
 *
 * No "featured" flag exists on events yet, so "Featured Events" stands
 * in with the soonest published events, and "Upcoming Events" picks up
 * where that leaves off (offset by 3) — both are real published events,
 * never fabricated ones.
 */
export default async function HomePage() {
  const supabase = await createClient();

  // Admins landing on "/" (e.g. right after signing in) belong in the
  // console, not the public homepage — this was never wired up before,
  // which is why an admin account saw the exact same homepage as a USER.
  // Checked first and before any of the homepage's own data-fetching, so
  // an admin gets sent on immediately rather than waiting on queries
  // whose results are about to be thrown away.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN") {
      redirect("/admin");
    }
  }

  const [{ data: liveRows }, { data: featuredRows }, { data: upcomingRows }, { data: competitions }, { data: scores }, { data: walletSetting }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id")
        .eq("status", "LIVE")
        .order("start_time")
        .limit(4),
      supabase
        .from("events")
        .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id")
        .eq("status", "PUBLISHED")
        .order("start_time", { ascending: true })
        .limit(3),
      supabase
        .from("events")
        .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score, competition_id")
        .eq("status", "PUBLISHED")
        .order("start_time", { ascending: true })
        .range(3, 8),
      supabase.from("competitions").select("id, name, slug, country").eq("active", true).order("name").limit(6),
      supabase.from("leaderboard_scores").select("user_id, username, display_name, points_earned"),
      supabase.from("platform_settings").select("value").eq("key", "wallet_enabled").single(),
    ]);

  const walletEnabled = Boolean(walletSetting?.value ?? false);
  const oddsBoardEvents = walletEnabled ? await getOddsBoardEvents(supabase) : [];

  const allEvents: RawEvent[] = [...(liveRows ?? []), ...(featuredRows ?? []), ...(upcomingRows ?? [])];
  const teamIds = [...new Set(allEvents.flatMap((e) => [e.home_team_id, e.away_team_id]))];
  const competitionIds = [...new Set(allEvents.map((e) => e.competition_id))];

  const [{ data: teams }, { data: eventCompetitions }] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name, short_name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string; short_name: string | null }[] }),
    competitionIds.length
      ? supabase.from("competitions").select("id, name").in("id", competitionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const competitionNameById = new Map((eventCompetitions ?? []).map((c) => [c.id, c.name]));

  function toCard(e: RawEvent): EventCardData {
    const home = teamById.get(e.home_team_id);
    const away = teamById.get(e.away_team_id);
    return {
      id: e.id,
      startTime: e.start_time,
      status: e.status,
      homeTeamName: home?.name ?? "TBD",
      homeTeamShort: home?.short_name ?? null,
      awayTeamName: away?.name ?? "TBD",
      awayTeamShort: away?.short_name ?? null,
      homeScore: e.home_score,
      awayScore: e.away_score,
      competitionName: competitionNameById.get(e.competition_id) ?? "",
    };
  }

  const pointsByUser = new Map<string, { username: string; displayName: string | null; points: number }>();
  for (const row of scores ?? []) {
    const existing = pointsByUser.get(row.user_id) ?? { username: row.username, displayName: row.display_name, points: 0 };
    existing.points += row.points_earned ?? 0;
    pointsByUser.set(row.user_id, existing);
  }
  const leaderboardPreview: LeaderboardRow[] = [...pointsByUser.entries()]
    .map(([userId, v]) => ({ userId, username: v.username, displayName: v.displayName, points: v.points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      {/* Keeps the Live Now rail's scores/status current without a manual reload (section 38). */}
      <RealtimeRefresher table="events" />
      {oddsBoardEvents.length > 0 && (
        <RealtimeRefresher
          table="market_selections"
          filter={`market_id=in.(${[...new Set(oddsBoardEvents.map((e) => e.marketId))].join(",")})`}
        />
      )}

      <section>
        <h1 className="font-display text-2xl font-bold">Welcome to {BRAND.name}</h1>
        <p className="mt-1 text-text-secondary">
          Predict match outcomes, climb the leaderboard, and follow live sports.
        </p>
      </section>

      {oddsBoardEvents.length > 0 && (
        <HomeSection title="Teams">
          <TeamsGrid events={oddsBoardEvents} />
        </HomeSection>
      )}

      <HomeSection title="Live Now">
        {(liveRows ?? []).length === 0 ? (
          <EmptyState title="No live matches right now." description="Check back later for upcoming matches." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(liveRows ?? []).map((e) => (
              <LiveEventCard key={e.id} event={toCard(e)} />
            ))}
          </div>
        )}
      </HomeSection>

      <HomeSection title="Featured Events">
        {(featuredRows ?? []).length === 0 ? (
          <EmptyState title="No featured events yet." description="Featured matches will appear here once published." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(featuredRows ?? []).map((e) => (
              <EventCard key={e.id} event={toCard(e)} />
            ))}
          </div>
        )}
      </HomeSection>

      <HomeSection title="Popular Competitions">
        {!competitions || competitions.length === 0 ? (
          <EmptyState title="No competitions available yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {competitions.map((c) => (
              <Link
                key={c.id}
                href={`/competitions/${c.slug}`}
                className="card flex flex-col items-center gap-1 p-4 text-center transition-colors hover:border-gold/40"
              >
                <span className="text-sm font-medium text-text-primary">{c.name}</span>
                {c.country && <span className="text-xs text-text-secondary">{c.country}</span>}
              </Link>
            ))}
          </div>
        )}
      </HomeSection>

      <HomeSection title="Upcoming Events">
        {(upcomingRows ?? []).length === 0 ? (
          <EmptyState
            title="No upcoming events yet."
            description="Explore today's events to get started."
            action={
              <Link href="/sports" className="btn-primary">
                Browse Sports
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(upcomingRows ?? []).map((e) => (
              <EventCard key={e.id} event={toCard(e)} />
            ))}
          </div>
        )}
      </HomeSection>

      <HomeSection title="Leaderboard Preview">
        {leaderboardPreview.length === 0 ? (
          <EmptyState title="Leaderboard will populate once predictions are scored." />
        ) : (
          <LeaderboardTable rows={leaderboardPreview} />
        )}
      </HomeSection>
    </div>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
