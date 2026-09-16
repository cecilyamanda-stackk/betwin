import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/seo";

// Regenerated hourly rather than on every request — cheap enough, and a
// sitemap doesn't need to be second-by-second fresh; crawlers re-fetch
// it periodically on their own schedule anyway.
export const revalidate = 3600;

/**
 * /sitemap.xml — every URL here is a real, publicly-viewable page (RLS's
 * "published"/"active" columns are exactly what gates public visibility
 * elsewhere in the app, so reusing those filters here keeps the sitemap
 * from ever listing something a crawler would 404 or get redirected
 * away from). Auth-gated pages (/account, /profile, /predictions),
 * /search, and /admin are deliberately left out — see robots.ts for why.
 *
 * Events are capped to the 500 most recent published ones rather than
 * listing every event ever played: sitemaps support far more than that,
 * but an ever-growing list of long-settled matches adds crawl-budget
 * cost without adding search value.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: sports }, { data: competitions }, { data: challenges }, { data: events }] = await Promise.all([
    supabase.from("sports").select("slug, updated_at").eq("active", true),
    supabase.from("competitions").select("slug, updated_at").eq("active", true),
    supabase.from("prediction_challenges").select("slug, updated_at").eq("status", "ACTIVE"),
    supabase
      .from("events")
      .select("id, updated_at, start_time")
      .eq("published", true)
      .order("start_time", { ascending: false })
      .limit(500),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/live`, changeFrequency: "always", priority: 0.9 },
    { url: `${SITE_URL}/sports`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${SITE_URL}/challenges`, changeFrequency: "daily", priority: 0.6 },
  ];

  const sportEntries: MetadataRoute.Sitemap = (sports ?? []).map((s) => ({
    url: `${SITE_URL}/sports/${s.slug}`,
    lastModified: s.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const competitionEntries: MetadataRoute.Sitemap = (competitions ?? []).map((c) => ({
    url: `${SITE_URL}/competitions/${c.slug}`,
    lastModified: c.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const challengeEntries: MetadataRoute.Sitemap = (challenges ?? []).map((c) => ({
    url: `${SITE_URL}/challenges/${c.slug}`,
    lastModified: c.updated_at,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  const eventEntries: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${SITE_URL}/events/${e.id}`,
    lastModified: e.updated_at,
    changeFrequency: "hourly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...sportEntries, ...competitionEntries, ...challengeEntries, ...eventEntries];
}
