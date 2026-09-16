import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /robots.txt. Disallowed paths are the ones that are either private
 * (auth-gated — a crawler would just hit a login redirect anyway),
 * internal (/admin), or thin/duplicate content that shouldn't compete
 * with the real pages for ranking (/search results, /maintenance).
 * These paths also carry a `noindex` meta tag on the pages themselves
 * (see lib/seo.ts's NOINDEX_METADATA) — disallowing here keeps crawlers
 * from spending budget on them at all, the noindex tag is the backstop
 * for anything that gets linked to from elsewhere regardless.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/profile", "/predictions", "/auth/reset-password", "/search", "/maintenance"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
