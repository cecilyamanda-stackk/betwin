import { requireAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { UsersTable } from "./UsersTable";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage, pageRange, totalPages as computeTotalPages, DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";
import type { Role } from "@/types/database";

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super admin" },
];

/**
 * /admin/users (section 20/29): search by username/email, filter by role,
 * click through to /admin/users/[id] for role changes and suspension.
 * Uses plain GET query params rather than a client component so the list
 * stays server-rendered and shareable/bookmarkable by filter.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; page?: string };
}) {
  await requireAdmin();
  const { q = "", role = "" } = searchParams;
  const page = parsePage(searchParams.page);
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, email, role, suspended, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q.trim()) {
    query = query.or(`username.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`);
  }
  if (role) {
    query = query.eq("role", role as Role);
  }

  const { data: users, count } = await query.range(...pageRange(page));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Users</h1>
      </div>

      <form className="mb-4 flex flex-wrap gap-3" action="/admin/users" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search username or email..."
          className="w-full max-w-xs rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-gold/60"
        />
        <select
          name="role"
          defaultValue={role}
          className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-gold/60"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <UsersTable users={users ?? []} />
      <Pagination
        page={page}
        totalPages={computeTotalPages(count, DEFAULT_PAGE_SIZE)}
        basePath="/admin/users"
        searchParams={{ q, role }}
      />
    </div>
  );
}
