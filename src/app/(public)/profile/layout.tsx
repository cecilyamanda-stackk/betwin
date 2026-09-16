import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo";

// Covers /profile, /profile/achievements, /profile/settings — all
// per-user pages with no standalone search value, and search engines
// would only ever see a login redirect for them anyway.
export const metadata: Metadata = NOINDEX_METADATA;

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
