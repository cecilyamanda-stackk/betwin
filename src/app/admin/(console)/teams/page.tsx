import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { TeamsManager } from "./TeamsManager";

export default async function AdminTeamsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: teams }, { data: competitions }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, country, active, competition_id")
      .order("name"),
    supabase.from("competitions").select("id, name").order("name"),
  ]);

  const competitionNameById = new Map((competitions ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Teams</h1>
      </div>
      <TeamsManager
        teams={(teams ?? []).map((t) => ({
          ...t,
          competitionName: competitionNameById.get(t.competition_id) ?? "—",
        }))}
        competitions={competitions ?? []}
      />
    </div>
  );
}
