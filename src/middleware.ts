import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every request.
 *   1. Refreshes the Supabase auth session cookie.
 *   2. Blocks unauthenticated or non-admin users from /admin/*.
 *
 * This is a defense-in-depth check, NOT the source of truth for
 * authorization — RLS policies and server-side role checks in each
 * Server Action/Route Handler are what actually protect data. A user
 * must never gain access to admin data purely by this middleware having
 * a bug; every admin data call re-checks role server-side too.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute =
    request.nextUrl.pathname.startsWith("/admin") &&
    request.nextUrl.pathname !== "/admin/login";

  if (isAdminRoute) {
    // Not signed in at all: send them to log in, remembering where they
    // were headed. This is the one case where it's fine to reveal that an
    // admin login exists — it's the legitimate entry point for admins.
    if (!user) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";

    // Signed in, but a plain USER (or a profile lookup that came back
    // empty) poking at /admin/*: don't redirect them to "/" — that still
    // confirms an admin console exists at this URL. Rewrite to a
    // guaranteed-unmatched path under /admin so Next.js renders the
    // ordinary admin/not-found.tsx boundary with a real 404 status, the
    // same as if the route never existed for them.
    if (!isAdmin) {
      return NextResponse.rewrite(new URL("/admin/__not_found__", request.url));
    }

    return response;
  }

  // ── Maintenance mode (Phase 4, /admin/settings) ──────────────────────
  // Blocks the public site for everyone except signed-in admins once the
  // toggle is on. Runs after the admin-route branch above (admins always
  // reach /admin regardless of this flag) and is skipped for the
  // maintenance page itself and admin login, so an admin always has a
  // way in to turn it back off.
  const isExemptRoute =
    request.nextUrl.pathname === "/maintenance" || request.nextUrl.pathname === "/admin/login";

  if (!isExemptRoute) {
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .single();

    const maintenanceMode = Boolean(setting?.value);

    if (maintenanceMode) {
      let isAdmin = false;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
      }
      if (!isAdmin) {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets, image optimization files,
     * and the SEO metadata routes (robots.txt/sitemap.xml) — those must
     * always return their real content type to crawlers, even during
     * maintenance mode, never a redirect to the HTML maintenance page.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
