/**
 * Seeds the Premier League 2026/27 schedule (Matchdays 1–21, as supplied)
 * into the sports catalogue: one competition, 20 teams, and 209 events.
 *
 * Scope: schedule/team data ONLY. This script does not create markets or
 * market_selections — it only populates sports, competitions, teams, and
 * events, so there is nothing here for odds or wagering to attach to.
 *
 * Status mapping:
 *   - Matches already played (source marked "FT" with a final score)
 *     -> status "FINISHED", home_score/away_score set.
 *   - Matches with a confirmed kickoff time -> status "PUBLISHED".
 *   - Matches still listed "TBD" (kickoff not yet announced, matchdays
 *     10–21 in the source) -> status "DRAFT" so they don't show as
 *     scheduled until a real kickoff time is set later.
 *
 * Kickoff times are stored as given in the source, assumed to already be
 * localized to Africa/Nairobi (UTC+3) — adjust FIXTURES below if that
 * assumption is wrong for your data source. Finished matches didn't carry
 * a kickoff time in the source (only a highlights-clip marker), so those
 * default to 15:00 local as a placeholder; the date itself is correct.
 *
 * Usage:
 *   npm run seed:epl-fixtures
 *
 * Safe to re-run: competition/teams are matched by slug/name (same
 * getOrCreate pattern as scripts/seed-games.ts), and events are matched
 * by (competition, home team, away team, start_time) so re-running
 * updates scores/status on existing rows instead of duplicating them.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL, loaded
 * from .env.local — same as scripts/seed-games.ts.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first.");
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function getOrCreateSport(name: string, icon: string) {
  const slug = slugify(name);
  const { data: existing } = await supabase.from("sports").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("sports")
    .insert({ name, slug, icon, active: true })
    .select("id")
    .single();
  if (error) fail(`Could not create sport "${name}": ${error.message}`);
  console.log(`✓ Sport: ${name}`);
  return data!.id as string;
}

async function getOrCreateCompetition(sportId: string, name: string, country: string) {
  const slug = slugify(name);
  const { data: existing } = await supabase.from("competitions").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("competitions")
    .insert({ sport_id: sportId, name, slug, country, active: true })
    .select("id")
    .single();
  if (error) fail(`Could not create competition "${name}": ${error.message}`);
  console.log(`✓ Competition: ${name}`);
  return data!.id as string;
}

async function getOrCreateTeam(competitionId: string, name: string, shortName: string, country: string) {
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("teams")
    .insert({ competition_id: competitionId, name, short_name: shortName, country, active: true })
    .select("id")
    .single();
  if (error) fail(`Could not create team "${name}": ${error.message}`);
  console.log(`✓ Team: ${name}`);
  return data!.id as string;
}

// ── Teams ────────────────────────────────────────────────────────────────
// name -> short code, all England for this competition.
const TEAMS: Record<string, string> = {
  "Arsenal": "ARS",
  "Aston Villa": "AVL",
  "Bournemouth": "BOU",
  "Brentford": "BRE",
  "Brighton": "BHA",
  "Chelsea": "CHE",
  "Coventry": "COV",
  "Everton": "EVE",
  "Fulham": "FUL",
  "Hull": "HUL",
  "Ipswich Town": "IPS",
  "Leeds": "LEE",
  "Liverpool": "LIV",
  "Man City": "MCI",
  "Man United": "MUN",
  "Newcastle": "NEW",
  "Nottm Forest": "NFO",
  "Palace": "CRY",
  "Spurs": "TOT",
  "Sunderland": "SUN",
};

// ── Fixtures ─────────────────────────────────────────────────────────────
// Matchdays 1–21 as supplied. "start" is an ISO timestamp with the +03:00
// (Africa/Nairobi) offset baked in — see the header note above.
type FixtureStatus = "FINISHED" | "PUBLISHED" | "DRAFT";
interface Fixture {
  matchday: number;
  start: string;
  home: string;
  away: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
}

const FIXTURES: Fixture[] = [
  { matchday: 1, start: "2026-08-21T15:00:00+03:00", home: "Arsenal", away: "Coventry", status: "FINISHED", homeScore: 3, awayScore: 0 },
  { matchday: 1, start: "2026-08-22T15:00:00+03:00", home: "Hull", away: "Man United", status: "FINISHED", homeScore: 2, awayScore: 0 },
  { matchday: 1, start: "2026-08-22T15:00:00+03:00", home: "Ipswich Town", away: "Sunderland", status: "FINISHED", homeScore: 2, awayScore: 1 },
  { matchday: 1, start: "2026-08-22T15:00:00+03:00", home: "Everton", away: "Palace", status: "FINISHED", homeScore: 2, awayScore: 0 },
  { matchday: 1, start: "2026-08-22T15:00:00+03:00", home: "Nottm Forest", away: "Leeds", status: "FINISHED", homeScore: 0, awayScore: 1 },
  { matchday: 1, start: "2026-08-22T15:00:00+03:00", home: "Brentford", away: "Spurs", status: "FINISHED", homeScore: 3, awayScore: 0 },
  { matchday: 1, start: "2026-08-23T15:00:00+03:00", home: "Man City", away: "Bournemouth", status: "FINISHED", homeScore: 2, awayScore: 1 },
  { matchday: 1, start: "2026-08-23T15:00:00+03:00", home: "Brighton", away: "Aston Villa", status: "FINISHED", homeScore: 4, awayScore: 0 },
  { matchday: 1, start: "2026-08-23T15:00:00+03:00", home: "Newcastle", away: "Liverpool", status: "FINISHED", homeScore: 2, awayScore: 2 },
  { matchday: 1, start: "2026-08-24T15:00:00+03:00", home: "Fulham", away: "Chelsea", status: "FINISHED", homeScore: 2, awayScore: 3 },
  { matchday: 2, start: "2026-08-28T22:00:00+03:00", home: "Palace", away: "Man City", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-29T14:30:00+03:00", home: "Liverpool", away: "Nottm Forest", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-29T17:00:00+03:00", home: "Coventry", away: "Hull", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-29T17:00:00+03:00", home: "Bournemouth", away: "Everton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-29T19:30:00+03:00", home: "Spurs", away: "Newcastle", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-30T16:00:00+03:00", home: "Chelsea", away: "Brighton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-30T16:00:00+03:00", home: "Leeds", away: "Brentford", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-30T16:00:00+03:00", home: "Sunderland", away: "Fulham", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-30T18:30:00+03:00", home: "Man United", away: "Ipswich Town", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 2, start: "2026-08-31T22:00:00+03:00", home: "Aston Villa", away: "Arsenal", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-04T22:00:00+03:00", home: "Ipswich Town", away: "Liverpool", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T14:30:00+03:00", home: "Newcastle", away: "Bournemouth", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T17:00:00+03:00", home: "Brentford", away: "Sunderland", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T17:00:00+03:00", home: "Nottm Forest", away: "Spurs", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T17:00:00+03:00", home: "Man City", away: "Coventry", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T17:00:00+03:00", home: "Fulham", away: "Palace", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T17:00:00+03:00", home: "Brighton", away: "Leeds", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-05T19:30:00+03:00", home: "Hull", away: "Aston Villa", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-06T16:00:00+03:00", home: "Everton", away: "Man United", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 3, start: "2026-09-06T18:30:00+03:00", home: "Arsenal", away: "Chelsea", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T17:00:00+03:00", home: "Liverpool", away: "Fulham", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T17:00:00+03:00", home: "Palace", away: "Ipswich Town", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T17:00:00+03:00", home: "Bournemouth", away: "Brentford", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T17:00:00+03:00", home: "Aston Villa", away: "Nottm Forest", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T17:00:00+03:00", home: "Chelsea", away: "Hull", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T19:30:00+03:00", home: "Spurs", away: "Everton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-12T22:00:00+03:00", home: "Sunderland", away: "Arsenal", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-13T16:00:00+03:00", home: "Coventry", away: "Brighton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-13T18:30:00+03:00", home: "Man United", away: "Man City", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 4, start: "2026-09-14T22:00:00+03:00", home: "Leeds", away: "Newcastle", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-18T22:00:00+03:00", home: "Brentford", away: "Chelsea", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T14:30:00+03:00", home: "Spurs", away: "Aston Villa", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T17:00:00+03:00", home: "Everton", away: "Ipswich Town", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T17:00:00+03:00", home: "Man City", away: "Sunderland", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T17:00:00+03:00", home: "Leeds", away: "Palace", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T17:00:00+03:00", home: "Brighton", away: "Arsenal", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T17:00:00+03:00", home: "Newcastle", away: "Hull", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-19T19:30:00+03:00", home: "Nottm Forest", away: "Coventry", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-20T16:00:00+03:00", home: "Bournemouth", away: "Liverpool", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 5, start: "2026-09-20T18:30:00+03:00", home: "Fulham", away: "Man United", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T14:30:00+03:00", home: "Arsenal", away: "Leeds", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T17:00:00+03:00", home: "Aston Villa", away: "Brentford", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T17:00:00+03:00", home: "Ipswich Town", away: "Fulham", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T17:00:00+03:00", home: "Chelsea", away: "Bournemouth", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T17:00:00+03:00", home: "Sunderland", away: "Brighton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-10T19:30:00+03:00", home: "Man United", away: "Spurs", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-11T16:00:00+03:00", home: "Palace", away: "Nottm Forest", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-11T16:00:00+03:00", home: "Hull", away: "Everton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-11T18:30:00+03:00", home: "Liverpool", away: "Man City", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 6, start: "2026-10-12T22:00:00+03:00", home: "Coventry", away: "Newcastle", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-17T14:30:00+03:00", home: "Everton", away: "Chelsea", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-17T17:00:00+03:00", home: "Fulham", away: "Hull", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-17T17:00:00+03:00", home: "Man City", away: "Ipswich Town", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-17T17:00:00+03:00", home: "Brentford", away: "Liverpool", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-17T19:30:00+03:00", home: "Newcastle", away: "Aston Villa", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-18T16:00:00+03:00", home: "Brighton", away: "Palace", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-18T16:00:00+03:00", home: "Bournemouth", away: "Sunderland", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-18T16:00:00+03:00", home: "Leeds", away: "Man United", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-18T18:30:00+03:00", home: "Nottm Forest", away: "Arsenal", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 7, start: "2026-10-19T22:00:00+03:00", home: "Spurs", away: "Coventry", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-23T22:00:00+03:00", home: "Ipswich Town", away: "Nottm Forest", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-24T14:30:00+03:00", home: "Aston Villa", away: "Man City", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-24T17:00:00+03:00", home: "Coventry", away: "Fulham", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-24T17:00:00+03:00", home: "Liverpool", away: "Brighton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-24T17:00:00+03:00", home: "Arsenal", away: "Everton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-24T19:30:00+03:00", home: "Chelsea", away: "Spurs", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-25T17:00:00+03:00", home: "Hull", away: "Brentford", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-25T17:00:00+03:00", home: "Man United", away: "Bournemouth", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-25T17:00:00+03:00", home: "Palace", away: "Newcastle", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 8, start: "2026-10-25T19:30:00+03:00", home: "Sunderland", away: "Leeds", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T15:30:00+03:00", home: "Chelsea", away: "Man United", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T18:00:00+03:00", home: "Bournemouth", away: "Leeds", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T18:00:00+03:00", home: "Coventry", away: "Sunderland", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T18:00:00+03:00", home: "Man City", away: "Brighton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T18:00:00+03:00", home: "Brentford", away: "Nottm Forest", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T18:00:00+03:00", home: "Hull", away: "Ipswich Town", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-10-31T20:30:00+03:00", home: "Spurs", away: "Palace", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-11-01T17:00:00+03:00", home: "Aston Villa", away: "Fulham", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-11-01T19:30:00+03:00", home: "Liverpool", away: "Arsenal", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 9, start: "2026-11-02T23:00:00+03:00", home: "Newcastle", away: "Everton", status: "PUBLISHED", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Fulham", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Ipswich Town", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Arsenal", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Man United", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Sunderland", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Nottm Forest", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Brighton", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Leeds", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Everton", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 10, start: "2026-11-07T15:00:00+03:00", home: "Palace", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Bournemouth", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Coventry", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Liverpool", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Spurs", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Chelsea", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Man City", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Aston Villa", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Newcastle", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Brentford", away: "Everton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 11, start: "2026-11-21T15:00:00+03:00", home: "Hull", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Man United", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Ipswich Town", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Everton", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Brighton", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Fulham", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Sunderland", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Leeds", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Palace", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Nottm Forest", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 12, start: "2026-11-28T15:00:00+03:00", home: "Arsenal", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Man City", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Spurs", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Hull", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Newcastle", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Bournemouth", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Liverpool", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Chelsea", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Brentford", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Aston Villa", away: "Everton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 13, start: "2026-12-02T15:00:00+03:00", home: "Coventry", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Man United", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Everton", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Brentford", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Bournemouth", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Newcastle", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Aston Villa", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Chelsea", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Nottm Forest", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Spurs", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 14, start: "2026-12-05T15:00:00+03:00", home: "Leeds", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Fulham", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Brighton", away: "Everton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Palace", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Man City", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Sunderland", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Arsenal", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Ipswich Town", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Coventry", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Liverpool", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 15, start: "2026-12-12T15:00:00+03:00", home: "Hull", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Arsenal", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Sunderland", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Brighton", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Bournemouth", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Brentford", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Chelsea", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Leeds", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Man City", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Liverpool", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 16, start: "2026-12-19T15:00:00+03:00", home: "Nottm Forest", away: "Everton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Hull", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Ipswich Town", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Man United", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Everton", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Spurs", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Fulham", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Palace", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Coventry", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Aston Villa", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 17, start: "2026-12-26T15:00:00+03:00", home: "Newcastle", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Palace", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Hull", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Coventry", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Fulham", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Man United", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Aston Villa", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Spurs", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Ipswich Town", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Everton", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 18, start: "2026-12-30T15:00:00+03:00", home: "Newcastle", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Sunderland", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Bournemouth", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Leeds", away: "Everton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Arsenal", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Liverpool", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Man City", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Brighton", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Brentford", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Nottm Forest", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 19, start: "2027-01-02T15:00:00+03:00", home: "Chelsea", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Ipswich Town", away: "Coventry", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Nottm Forest", away: "Hull", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Sunderland", away: "Liverpool", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Arsenal", away: "Brentford", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Brighton", away: "Bournemouth", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Man United", away: "Newcastle", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Fulham", away: "Spurs", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Leeds", away: "Man City", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Everton", away: "Aston Villa", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 20, start: "2027-01-06T15:00:00+03:00", home: "Palace", away: "Chelsea", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Liverpool", away: "Palace", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Spurs", away: "Leeds", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Newcastle", away: "Fulham", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Hull", away: "Arsenal", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Brentford", away: "Brighton", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Aston Villa", away: "Man United", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Man City", away: "Nottm Forest", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Chelsea", away: "Sunderland", status: "DRAFT", homeScore: null, awayScore: null },
  { matchday: 21, start: "2027-01-16T15:00:00+03:00", home: "Bournemouth", away: "Ipswich Town", status: "DRAFT", homeScore: null, awayScore: null },
];

async function upsertEvent(
  competitionId: string,
  teamIds: Record<string, string>,
  fx: Fixture
) {
  const homeId = teamIds[fx.home];
  const awayId = teamIds[fx.away];
  if (!homeId || !awayId) {
    fail(`Unknown team in fixture: ${fx.home} vs ${fx.away}`);
  }

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("home_team_id", homeId)
    .eq("away_team_id", awayId)
    .eq("start_time", fx.start)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("events")
      .update({ status: fx.status, home_score: fx.homeScore, away_score: fx.awayScore })
      .eq("id", existing.id);
    if (error) fail(`Could not update event ${fx.home} vs ${fx.away}: ${error.message}`);
    return { id: existing.id as string, created: false };
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      competition_id: competitionId,
      home_team_id: homeId,
      away_team_id: awayId,
      start_time: fx.start,
      status: fx.status,
      home_score: fx.homeScore,
      away_score: fx.awayScore,
    })
    .select("id")
    .single();
  if (error) fail(`Could not create event ${fx.home} vs ${fx.away}: ${error.message}`);
  return { id: data!.id as string, created: true };
}

async function main() {
  const football = await getOrCreateSport("Football", "⚽");
  const premierLeague = await getOrCreateCompetition(football, "Premier League", "England");

  const teamIds: Record<string, string> = {};
  for (const [name, shortName] of Object.entries(TEAMS)) {
    teamIds[name] = await getOrCreateTeam(premierLeague, name, shortName, "England");
  }

  let created = 0;
  let updated = 0;
  for (const fx of FIXTURES) {
    const result = await upsertEvent(premierLeague, teamIds, fx);
    if (result.created) created += 1;
    else updated += 1;
  }

  console.log(`\n✓ Seed complete: ${created} events created, ${updated} events updated.`);
  console.log(`  (${FIXTURES.filter((f) => f.status === "FINISHED").length} finished, ` +
    `${FIXTURES.filter((f) => f.status === "PUBLISHED").length} published, ` +
    `${FIXTURES.filter((f) => f.status === "DRAFT").length} draft/TBD)\n`);
}

main();
