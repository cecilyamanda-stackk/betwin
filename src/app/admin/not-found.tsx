import Link from "next/link";
import { SearchX } from "lucide-react";
import { BRAND } from "@/lib/branding";

/**
 * Renders for any unmatched path under /admin, INCLUDING the rewrite
 * middleware.ts issues for a signed-in non-admin USER hitting /admin/*.
 *
 * Deliberately generic — no "sign in as an admin" hint, no link back into
 * the console. For a regular user this route should look and behave
 * exactly like it doesn't exist, not like a locked door.
 */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <SearchX className="h-10 w-10 text-text-secondary" aria-hidden="true" />
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Page not found.</h1>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Whatever you were looking for isn&apos;t here — it may have moved or never existed.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Back to {BRAND.name}
      </Link>
    </div>
  );
}
