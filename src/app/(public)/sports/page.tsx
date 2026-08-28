import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

/** /sports — every active sport with a live competition count (section 12). */
export default async function SportsPage() {
  const supabase = await createClient();

  const [{ data: sports }, { data: competitions }] = await Promise.all([
    supabase.from("sports").select("id, name, slug, icon").eq("active", true).order("name"),
    supabase.from("competitions").select("id, sport_id").eq("active", true),
  ]);

  const competitionCountBySport = new Map<string, number>();
  for (const c of competitions ?? []) {
    competitionCountBySport.set(c.sport_id, (competitionCountBySport.get(c.sport_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Sports</h1>

      {!sports || sports.length === 0 ? (
        <EmptyState title="No sports available yet." description="Check back once the catalogue is published." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sports.map((s) => (
            <Link
              key={s.id}
              href={`/sports/${s.slug}`}
              className="card flex flex-col items-center gap-2 p-6 text-center transition-colors hover:border-gold/40"
            >
              <span className="text-3xl" aria-hidden="true">
                {s.icon || "🏆"}
              </span>
              <span className="font-medium text-text-primary">{s.name}</span>
              <span className="text-xs text-text-secondary">
                {competitionCountBySport.get(s.id) ?? 0} competition
                {(competitionCountBySport.get(s.id) ?? 0) === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
