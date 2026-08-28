import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";
import type { AuditAction, AuditEntityType } from "@/lib/auth/audit";

interface AuditRow {
  id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actorUsername: string;
}

const ENTITY_FILTERS: AuditEntityType[] = [
  "EVENT",
  "MARKET",
  "RESULT",
  "USER",
  "COMPETITION",
  "TEAM",
  "SPORT",
  "NOTIFICATION",
  "SETTINGS",
];

/**
 * /admin/audit-logs: searchable/filterable view over audit_logs, which
 * every admin mutation has written to since Phase 1 via writeAuditLog().
 * This is the first page that actually reads them back.
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: { entity?: string; action?: string; page?: string };
}) {
  await requireAdmin();
  const { entity = "", action = "" } = searchParams;
  const page = parsePage(searchParams.page);
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (entity) query = query.eq("entity_type", entity);
  if (action.trim()) query = query.ilike("action", `%${action.trim()}%`);

  const { data: logs, count } = await query.range(...pageRange(page));

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_user_id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", actorIds)
    : { data: [] };
  const usernameById = new Map((actors ?? []).map((a) => [a.id, a.username]));

  const rows: AuditRow[] = (logs ?? []).map((l) => ({
    id: l.id,
    action: l.action as AuditAction,
    entity_type: l.entity_type as AuditEntityType,
    entity_id: l.entity_id,
    metadata: l.metadata as Record<string, unknown>,
    created_at: l.created_at,
    actorUsername: usernameById.get(l.actor_user_id) ?? "—",
  }));

  const columns: AdminTableColumn<AuditRow>[] = [
    { key: "when", label: "When", render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "actor", label: "Actor", render: (r) => `@${r.actorUsername}` },
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <span className="inline-flex items-center rounded-pill bg-surface-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-text-primary">
          {r.action}
        </span>
      ),
    },
    { key: "entity", label: "Entity", render: (r) => `${r.entity_type} · ${r.entity_id.slice(0, 8)}` },
    {
      key: "metadata",
      label: "Details",
      render: (r) =>
        Object.keys(r.metadata ?? {}).length > 0 ? (
          <code className="text-xs text-text-secondary">{JSON.stringify(r.metadata)}</code>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Audit Logs</h1>

      <form className="mb-4 flex flex-wrap gap-3" action="/admin/audit-logs" method="get">
        <select
          name="entity"
          defaultValue={entity}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60"
        >
          <option value="">All entity types</option>
          {ENTITY_FILTERS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="action"
          defaultValue={action}
          placeholder="Search action (e.g. EVENT_PUBLISHED)..."
          className="w-full max-w-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-gold/60"
        />
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <AdminTable
        columns={columns}
        rows={rows}
        keyField={(r) => r.id}
        emptyTitle="No audit entries match."
        emptyDescription="Try clearing the filters."
      />
      <Pagination
        page={page}
        totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)}
        basePath="/admin/audit-logs"
        searchParams={{ entity, action }}
      />
    </div>
  );
}
