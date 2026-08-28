"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { BRAND } from "@/lib/branding";

/**
 * Catches any rendering/data error thrown by a page or layout under
 * (public) — homepage down to a single event page — and shows a
 * recoverable error state instead of Next.js's default crash screen
 * (Phase 5 — "empty/error states for every remaining page").
 *
 * Deliberately doesn't leak `error.message` to the user: Server Component
 * errors are stripped of detail by Next.js in production anyway, and any
 * detail present here could be a raw Supabase/Postgres error we don't
 * want surfaced. `error.digest` is safe and worth keeping for support.
 */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-live" aria-hidden="true" />
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Something went wrong.</h1>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          That page hit an unexpected error. You can try again, or head back home.
        </p>
        {error.digest && <p className="mt-2 text-xs text-text-secondary">Reference: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to {BRAND.name}
        </Link>
      </div>
    </div>
  );
}
