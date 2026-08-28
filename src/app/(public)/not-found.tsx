import Link from "next/link";
import { SearchX } from "lucide-react";
import { BRAND } from "@/lib/branding";

/** Handles notFound() calls and any unmatched /* route under (public), e.g. a deleted event's old URL. */
export default function PublicNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <SearchX className="h-10 w-10 text-text-secondary" aria-hidden="true" />
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Page not found.</h1>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Whatever you were looking for isn&apos;t here — it may have moved or never existed.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/" className="btn-primary">
          Back to {BRAND.name}
        </Link>
        <Link href="/sports" className="btn-secondary">
          Browse Sports
        </Link>
      </div>
    </div>
  );
}
