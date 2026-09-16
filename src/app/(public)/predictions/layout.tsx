import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo";

// Covers /predictions and /predictions/history — a signed-in user's own
// prediction history, not content anyone would search for.
export const metadata: Metadata = NOINDEX_METADATA;

export default function PredictionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
