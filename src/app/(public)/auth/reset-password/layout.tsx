import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo";

// Covers /auth/reset-password and /auth/reset-password/confirm. Unlike
// /auth/login and /auth/register (kept indexable — "bet606 login" is a
// real, common branded search), a reset-password link is single-use,
// often carries a token in the query string, and has nothing to offer
// someone arriving from search. Both pages are Client Components, so
// metadata can't be exported directly from them — this layout is what
// makes it possible.
export const metadata: Metadata = NOINDEX_METADATA;

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
