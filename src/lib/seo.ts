import type { Metadata } from "next";
import { BRAND } from "@/lib/branding";

/**
 * Single source of truth for SEO config — same "update this file only"
 * pattern as lib/branding.ts.
 *
 * NEXT_PUBLIC_SITE_URL MUST be set to the real production domain (see
 * .env.example) for the sitemap, robots.txt, canonical URLs, and Open
 * Graph tags to point at the right place. Falls back to a placeholder so
 * local dev/build never crashes without it — that placeholder must never
 * ship to production; nothing here will error, it'll just generate a
 * sitemap/canonical URLs pointing at the wrong domain.
 */
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bet606.example";
export const SITE_URL = rawSiteUrl.replace(/\/$/, "");

/**
 * The keyword set this pass targets: the brand name itself (people
 * search "bet606" directly), + "Kenya betting site"-shaped queries, +
 * the sport/football-odds terms most likely to bring in search traffic
 * that converts. Only feeds the <meta name="keywords"> tag (which most
 * engines now ignore for ranking, Google included) — the real work is
 * making sure these terms actually appear in each page's title/
 * description/on-page content, which is what search engines actually
 * weigh. Keep this list honest to what's really on the page; stuffing
 * unrelated terms here does nothing but risk looking spammy.
 */
export const SEO_KEYWORDS = [
  "Bet606",
  "bet606 kenya",
  "Kenya betting site",
  "sports betting Kenya",
  "online betting Kenya",
  "football predictions Kenya",
  "live betting Kenya",
  "football odds Kenya",
  "sports prediction platform",
  "predict and win Kenya",
];

/** `${title} — Bet606` for page titles, capped so it doesn't get truncated in search results. */
export function pageTitle(title: string): string {
  return `${title} — ${BRAND.name}`;
}

/** Shared defaults every page-level Metadata export should spread in first, then override. */
export const BASE_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND.name,
  keywords: SEO_KEYWORDS,
  robots: { index: true, follow: true },
  openGraph: {
    siteName: BRAND.name,
    locale: "en_KE",
    type: "website",
    images: [{ url: "/images/bet606-hero-banner.png", width: 1672, height: 941, alt: `${BRAND.name} — ${BRAND.tagline}` }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/bet606-hero-banner.png"],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

/** Metadata for pages that should never be indexed (auth-gated, thin/duplicate, or internal). */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
