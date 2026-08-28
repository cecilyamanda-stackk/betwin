import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { CompetitionsManager } from "./CompetitionsManager";

export default async function AdminCompetitionsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: competitions }, { data: sports }] = await Promise.all([
    supabase
      .from("competitions")
      .select("id, name, slug, country, active, sport_id")
      .order("name"),
    supabase.from("sports").select("id, name").order("name"),
  ]);

  const sportNameById = new Map((sports ?? []).map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Competitions</h1>
      </div>
      <CompetitionsManager
        competitions={(competitions ?? []).map((c) => ({
          ...c,
          sportName: sportNameById.get(c.sport_id) ?? "—",
        }))}
        sports={sports ?? []}
      />
    </div>
  );
}
