import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventCard, type EventCardData } from "@/components/events/EventCard";
import { SITE_URL } from "@/lib/seo";

export async function generateMetadata({ params }: { params: { competition: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("name, slug, country")
    .eq("slug", params.competition)
    .eq("active", true)
    .maybeSingle();
  if (!competition) return {};

  const place = competition.country ? ` (${competition.country})` : "";
  return {
    title: `${competition.name} Odds & Predictions`,
    description: `${competition.name}${place} betting odds, fixtures, and match predictions in Kenya. Bet on ${competition.name} matches on Bet606.`,
    alternates: { canonical: `${SITE_URL}/competitions/${competition.slug}` },
  };
}

/** /competitions/[competition] — teams + events within one competition (section 12). */
export default async function CompetitionPage({ params }: { params: { competition: string } }) {
  const supabase = await createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, slug, country")
    .eq("slug", params.competition)
    .eq("active", true)
    .maybeSingle();

  if (!competition) notFound();

  const [{ data: teams }, { data: events }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, country")
      .eq("competition_id", competition.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("events")
      .select("id, start_time, status, home_team_id, away_team_id, home_score, away_score")
      .eq("competition_id", competition.id)
      .order("start_time"),
  ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const eventCards: EventCardData[] = (events ?? []).map((e) => {
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
      competitionName: competition.name,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold">{competition.name}</h1>
        {competition.country && <p className="text-text-secondary">{competition.country}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Events</h2>
        {eventCards.length === 0 ? (
          <EmptyState title="No events yet." description="Events will appear here once published." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eventCards.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Teams</h2>
        {!teams || teams.length === 0 ? (
          <EmptyState title="No teams yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {teams.map((t) => (
              <div key={t.id} className="card flex items-center gap-2 p-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-bold text-text-secondary"
                  aria-hidden="true"
                >
                  {(t.short_name || t.name).slice(0, 3).toUpperCase()}
                </span>
                <span className="truncate text-sm text-text-primary">{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
