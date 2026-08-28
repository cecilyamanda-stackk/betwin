import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { EventsManager } from "./EventsManager";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireAdmin();
  const page = parsePage(searchParams.page);
  const supabase = await createClient();

  const [{ data: events, count }, { data: competitions }, { data: teams }] = await Promise.all([
    supabase
      .from("events")
      .select("id, start_time, status, home_team_id, away_team_id, competition_id, home_score, away_score", {
        count: "exact",
      })
      .order("start_time", { ascending: false })
      .range(...pageRange(page)),
    supabase.from("competitions").select("id, name").order("name"),
    supabase.from("teams").select("id, name, competition_id").order("name"),
  ]);

  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const competitionNameById = new Map((competitions ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Events</h1>
      </div>
      <EventsManager
        events={(events ?? []).map((e) => ({
          ...e,
          homeTeamName: teamNameById.get(e.home_team_id) ?? "—",
          awayTeamName: teamNameById.get(e.away_team_id) ?? "—",
          competitionName: competitionNameById.get(e.competition_id) ?? "—",
        }))}
        competitions={competitions ?? []}
        teams={teams ?? []}
      />
      <Pagination page={page} totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)} basePath="/admin/events" />
    </div>
  );
}
