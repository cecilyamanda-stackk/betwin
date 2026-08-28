"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Catches errors thrown anywhere in the authenticated /admin/(console)
 * tree (dashboard, users, events, ...) — see (public)/error.tsx for the
 * public-site equivalent and the reasoning for not surfacing raw error
 * detail. Scoped to (console) rather than all of /admin so /admin/login
 * (outside the group) keeps rendering its own errors normally.
 */
export default function AdminConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-live" aria-hidden="true" />
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">This page hit an error.</h1>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Nothing was saved that shouldn&apos;t have been — try again, or use the sidebar to go elsewhere.
        </p>
        {error.digest && <p className="mt-2 text-xs text-text-secondary">Reference: {error.digest}</p>}
      </div>
      <button type="button" onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  );
}
