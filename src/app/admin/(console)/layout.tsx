import { notFound, redirect } from "next/navigation";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth/roles";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { AdminBreadcrumbProvider } from "@/components/admin/AdminBreadcrumbContext";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

/**
 * Shared chrome for every authenticated admin page (dashboard, sports,
 * competitions, teams, events, markets, ...). /admin/login is a sibling
 * route outside this group, so it renders without the sidebar/header —
 * there's nothing to navigate to before you're signed in.
 *
 * requireAdmin() here is the real gate; middleware.ts is defense-in-depth
 * only (see the comment there). Mirrors middleware.ts's handling on the
 * rare path where a request reaches here without middleware having caught
 * it: a non-admin gets the ordinary 404, not a generic error screen that
 * confirms a console exists at this URL.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  let profile: Awaited<ReturnType<typeof requireAdmin>>["profile"];
  try {
    ({ profile } = await requireAdmin());
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/admin/login");
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  return (
    <div className="flex h-screen flex-col">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to main content
      </a>
      <AdminBreadcrumbProvider>
        <AdminHeader displayName={profile.display_name ?? profile.username} role={profile.role} />
        <AdminBreadcrumbs />
        <div className="flex flex-1 overflow-hidden">
          <AdminSidebar />
          <main id="admin-main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">{children}</div>
          </main>
        </div>
      </AdminBreadcrumbProvider>
      <AdminCommandPalette />
    </div>
  );
}
