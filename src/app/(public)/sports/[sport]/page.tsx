import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

/** /sports/[sport] — competitions within one sport (section 12). */
export default async function SportPage({ params }: { params: { sport: string } }) {
  const supabase = await createClient();

  const { data: sport } = await supabase
    .from("sports")
    .select("id, name, slug, icon")
    .eq("slug", params.sport)
    .eq("active", true)
    .maybeSingle();

  if (!sport) notFound();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, slug, country")
    .eq("sport_id", sport.id)
    .eq("active", true)
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <span aria-hidden="true">{sport.icon || "🏆"}</span>
        {sport.name}
      </h1>

      {!competitions || competitions.length === 0 ? (
        <EmptyState title="No competitions yet." description="Competitions will appear here once published." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((c) => (
            <Link
              key={c.id}
              href={`/competitions/${c.slug}`}
              className="card flex flex-col gap-1 p-4 transition-colors hover:border-gold/40"
            >
              <span className="font-medium text-text-primary">{c.name}</span>
              {c.country && <span className="text-xs text-text-secondary">{c.country}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
