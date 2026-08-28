import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

/** /search — wired to the header SearchBar; searches sports, competitions, and teams (section 9). */
export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const supabase = await createClient();

  if (!q) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Search</h1>
        <EmptyState title="Type something to search." description="Search across sports, competitions, and teams." />
      </div>
    );
  }

  const [{ data: sports }, { data: competitions }, { data: teams }] = await Promise.all([
    supabase.from("sports").select("id, name, slug, icon").eq("active", true).ilike("name", `%${q}%`).limit(10),
    supabase
      .from("competitions")
      .select("id, name, slug, country")
      .eq("active", true)
      .ilike("name", `%${q}%`)
      .limit(10),
    supabase.from("teams").select("id, name, competition_id").eq("active", true).ilike("name", `%${q}%`).limit(10),
  ]);

  const competitionIds = [...new Set((teams ?? []).map((t) => t.competition_id))];
  const { data: teamCompetitions } = competitionIds.length
    ? await supabase.from("competitions").select("id, slug, name").in("id", competitionIds)
    : { data: [] };
  const competitionById = new Map((teamCompetitions ?? []).map((c) => [c.id, c]));

  const hasResults = (sports?.length ?? 0) + (competitions?.length ?? 0) + (teams?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold">Search results for &ldquo;{q}&rdquo;</h1>

      {!hasResults ? (
        <EmptyState title="No results found." description="Try a different search term." />
      ) : (
        <>
          {sports && sports.length > 0 && (
            <ResultSection title="Sports">
              {sports.map((s) => (
                <Link
                  key={s.id}
                  href={`/sports/${s.slug}`}
                  className="card flex items-center gap-2 p-3 transition-colors hover:border-gold/40"
                >
                  <span aria-hidden="true">{s.icon || "🏆"}</span>
                  <span className="text-text-primary">{s.name}</span>
                </Link>
              ))}
            </ResultSection>
          )}

          {competitions && competitions.length > 0 && (
            <ResultSection title="Competitions">
              {competitions.map((c) => (
                <Link
                  key={c.id}
                  href={`/competitions/${c.slug}`}
                  className="card flex items-center justify-between gap-2 p-3 transition-colors hover:border-gold/40"
                >
                  <span className="text-text-primary">{c.name}</span>
                  {c.country && <span className="text-xs text-text-secondary">{c.country}</span>}
                </Link>
              ))}
            </ResultSection>
          )}

          {teams && teams.length > 0 && (
            <ResultSection title="Teams">
              {teams.map((t) => {
                const competition = competitionById.get(t.competition_id);
                return (
                  <div key={t.id} className="card flex items-center justify-between gap-2 p-3">
                    <span className="text-text-primary">{t.name}</span>
                    {competition && (
                      <Link href={`/competitions/${competition.slug}`} className="text-xs text-gold hover:underline">
                        {competition.name}
                      </Link>
                    )}
                  </div>
                );
              })}
            </ResultSection>
          )}
        </>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
