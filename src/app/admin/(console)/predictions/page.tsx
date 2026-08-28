import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";
import type { PredictionStatus } from "@/types/database";

interface PredictionRow {
  id: string;
  status: PredictionStatus;
  points_earned: number | null;
  created_at: string;
  settled_at: string | null;
  username: string;
  eventLabel: string;
  marketName: string;
  selectionName: string;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "VOID", label: "Void" },
];

const STATUS_STYLES: Record<PredictionStatus, string> = {
  PENDING: "border border-border text-text-secondary",
  WON: "bg-success/15 text-success",
  LOST: "bg-live/15 text-live",
  VOID: "border border-border text-text-secondary line-through",
};

/**
 * /admin/predictions: read-only, admin-wide view over every user's
 * predictions (section 20). Individual picks stay hidden from other
 * users everywhere else in the app (see the RLS note in the Phase 3
 * migration) — this is the one place an admin can see them, for support
 * and dispute investigation.
 */
export default async function AdminPredictionsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  await requireAdmin();
  const { status = "" } = searchParams;
  const page = parsePage(searchParams.page);
  const supabase = await createClient();

  let query = supabase
    .from("predictions")
    .select(
      "id, status, points_earned, created_at, settled_at, user_id, event_id, market_id, selection_id",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status as PredictionStatus);
  }

  const { data: predictions, count } = await query.range(...pageRange(page));

  const userIds = [...new Set((predictions ?? []).map((p) => p.user_id))];
  const eventIds = [...new Set((predictions ?? []).map((p) => p.event_id))];
  const marketIds = [...new Set((predictions ?? []).map((p) => p.market_id))];
  const selectionIds = [...new Set((predictions ?? []).map((p) => p.selection_id))];

  const [{ data: users }, { data: events }, { data: markets }, { data: selections }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, username").in("id", userIds) : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("events").select("id, home_team_id, away_team_id").in("id", eventIds)
      : Promise.resolve({ data: [] }),
    marketIds.length ? supabase.from("markets").select("id, name").in("id", marketIds) : Promise.resolve({ data: [] }),
    selectionIds.length
      ? supabase.from("market_selections").select("id, name").in("id", selectionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const teamIds = [
    ...new Set((events ?? []).flatMap((e) => [e.home_team_id, e.away_team_id])),
  ];
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };

  const usernameById = new Map((users ?? []).map((u) => [u.id, u.username]));
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const marketNameById = new Map((markets ?? []).map((m) => [m.id, m.name]));
  const selectionNameById = new Map((selections ?? []).map((s) => [s.id, s.name]));

  const rows: PredictionRow[] = (predictions ?? []).map((p) => {
    const event = eventById.get(p.event_id);
    const eventLabel = event
      ? `${teamNameById.get(event.home_team_id) ?? "—"} vs ${teamNameById.get(event.away_team_id) ?? "—"}`
      : "—";
    return {
      id: p.id,
      status: p.status,
      points_earned: p.points_earned,
      created_at: p.created_at,
      settled_at: p.settled_at,
      username: usernameById.get(p.user_id) ?? "—",
      eventLabel,
      marketName: marketNameById.get(p.market_id) ?? "—",
      selectionName: selectionNameById.get(p.selection_id) ?? "—",
    };
  });

  const columns: AdminTableColumn<PredictionRow>[] = [
    { key: "user", label: "User", render: (r) => `@${r.username}` },
    { key: "event", label: "Event", render: (r) => r.eventLabel },
    { key: "market", label: "Market", render: (r) => r.marketName },
    { key: "selection", label: "Pick", render: (r) => r.selectionName },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[r.status]}`}
        >
          {r.status}
        </span>
      ),
    },
    { key: "points", label: "Points", render: (r) => r.points_earned ?? "—" },
    { key: "submitted", label: "Submitted", render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Predictions</h1>

      <form className="mb-4 flex gap-3" action="/admin/predictions" method="get">
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <AdminTable
        columns={columns}
        rows={rows}
        keyField={(r) => r.id}
        emptyTitle="No predictions match."
        emptyDescription="Try a different status filter."
      />
      <Pagination
        page={page}
        totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)}
        basePath="/admin/predictions"
        searchParams={{ status }}
      />
    </div>
  );
}
