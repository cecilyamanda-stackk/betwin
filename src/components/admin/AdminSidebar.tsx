import { AdminNavList } from "@/components/admin/AdminNavList";

/**
 * Admin operations console nav (section 20/42). Deliberately separate
 * from the public Sidebar — see the note in admin/layout.tsx about the
 * admin surface reading as its own console, not a themed site variant.
 *
 * Hidden below `lg` (same convention the public site's Sidebar already
 * uses for its own breakpoint) — AdminMobileNav's drawer takes over below
 * that, rendering the exact same AdminNavList so the two never drift.
 */
export function AdminSidebar() {
  return (
    <nav className="hidden h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4 lg:flex">
      <AdminNavList />
    </nav>
  );
}
