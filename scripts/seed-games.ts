/**
 * Seeds demo sports-catalogue data: a couple of sports, competitions,
 * teams, and a handful of events (one of each status in the state
 * machine) with markets and selections attached. Also seeds the Phase 3
 * achievement definitions and one demo prediction challenge, so a fresh
 * database has something to earn badges against and a challenge to join.
 *
 * Usage:
 *   npm run seed:games              # base demo catalogue (2 leagues + NBA + ATP, ~9 events)
 *   npm run seed:games -- --once    # skip event creation if any events already exist
 *   npm run seed:games -- --bulk    # also add 30 more PUBLISHED events, for exercising
 *                                    # Phase 5 pagination on admin list pages
 *
 * Safe to re-run: sports/competitions are matched by slug, teams by
 * (competition, name), achievements by code, and the demo challenge by
 * slug — existing rows are reused rather than duplicated. Demo events ARE
 * re-created on every run (so you always get a fresh LIVE match to test
 * with) unless you pass --once, which skips event creation entirely if
 * any demo events already exist. --bulk events are always additive (never
 * matched/reused) — run it as many times as you want more volume.
 * Achievements/challenge seeding always runs, --once or not, since it's
 * cheap and fully idempotent.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL — same
 * as scripts/seed-admin.ts, and loads them from .env.local the same way.
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

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

async function createDemoEvent(opts: {
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  startTime: Date;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "FINISHED";
  homeScore?: number;
  awayScore?: number;
  marketName: string;
  selections: { name: string; value?: string }[];
}) {
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      competition_id: opts.competitionId,
      home_team_id: opts.homeTeamId,
      away_team_id: opts.awayTeamId,
      start_time: opts.startTime.toISOString(),
      status: opts.status,
      home_score: opts.homeScore ?? null,
      away_score: opts.awayScore ?? null,
    })
    .select("id")
    .single();
  if (error) fail(`Could not create demo event: ${error.message}`);

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .insert({ event_id: event!.id, name: opts.marketName, type: "MATCH_RESULT" })
    .select("id")
    .single();
  if (marketError) fail(`Could not create demo market: ${marketError.message}`);

  const { error: selectionsError } = await supabase
    .from("market_selections")
    .insert(opts.selections.map((s) => ({ market_id: market!.id, name: s.name, value: s.value ?? null })));
  if (selectionsError) fail(`Could not create demo selections: ${selectionsError.message}`);

  return event!.id as string;
}

async function seedAchievements() {
  const achievements = [
    {
      code: "FIRST_PREDICTION",
      name: "First Pick",
      description: "Submit your first prediction.",
      icon: "🎯",
      criteria: { type: "prediction_count", threshold: 1 },
    },
    {
      code: "FIVE_PREDICTIONS",
      name: "Getting Started",
      description: "Submit 5 predictions.",
      icon: "🔥",
      criteria: { type: "prediction_count", threshold: 5 },
    },
    {
      code: "TEN_PREDICTIONS",
      name: "Regular Predictor",
      description: "Submit 10 predictions.",
      icon: "⭐",
      criteria: { type: "prediction_count", threshold: 10 },
    },
    {
      code: "TWENTY_FIVE_PREDICTIONS",
      name: "Prediction Pro",
      description: "Submit 25 predictions.",
      icon: "🏅",
      criteria: { type: "prediction_count", threshold: 25 },
    },
    {
      code: "FIRST_WIN",
      name: "First Win",
      description: "Get your first prediction right.",
      icon: "🏆",
      criteria: { type: "win_count", threshold: 1 },
    },
    {
      code: "FIVE_WINS",
      name: "Sharp Shooter",
      description: "Get 5 predictions right.",
      icon: "🎖️",
      criteria: { type: "win_count", threshold: 5 },
    },
  ];

  for (const a of achievements) {
    const { data: existing } = await supabase.from("achievements").select("id").eq("code", a.code).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("achievements").insert(a);
    if (error) fail(`Could not create achievement "${a.code}": ${error.message}`);
    console.log(`✓ Achievement: ${a.name}`);
  }
}

async function seedChallenge() {
  const slug = "weekend-warmup";
  const { data: existing } = await supabase.from("prediction_challenges").select("id").eq("slug", slug).maybeSingle();
  if (existing) return;

  const now = Date.now();
  const { error } = await supabase.from("prediction_challenges").insert({
    name: "Weekend Warmup",
    slug,
    description: "Predict this weekend's headline matches and climb the mini leaderboard.",
    start_time: new Date(now).toISOString(),
    end_time: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ACTIVE",
  });
  if (error) fail(`Could not create demo challenge: ${error.message}`);
  console.log("✓ Demo challenge: Weekend Warmup (ACTIVE)");
}

async function main() {
  await seedAchievements();
  await seedChallenge();

  const skipEvents = process.argv.includes("--once");
  if (skipEvents) {
    const { count } = await supabase.from("events").select("id", { count: "exact", head: true });
    if (count && count > 0) {
      console.log("✓ --once passed and events already exist — skipping event creation.\n");
      return;
    }
  }

  const football = await getOrCreateSport("Football", "⚽");
  const basketball = await getOrCreateSport("Basketball", "🏀");
  const tennis = await getOrCreateSport("Tennis", "🎾");

  const premierLeague = await getOrCreateCompetition(football, "Premier League", "England");
  const laLiga = await getOrCreateCompetition(football, "La Liga", "Spain");
  const nba = await getOrCreateCompetition(basketball, "NBA", "USA");
  const atpTour = await getOrCreateCompetition(tennis, "ATP Tour", "International");

  const arsenal = await getOrCreateTeam(premierLeague, "Arsenal", "ARS", "England");
  const chelsea = await getOrCreateTeam(premierLeague, "Chelsea", "CHE", "England");
  const liverpool = await getOrCreateTeam(premierLeague, "Liverpool", "LIV", "England");
  const manCity = await getOrCreateTeam(premierLeague, "Manchester City", "MCI", "England");
  const tottenham = await getOrCreateTeam(premierLeague, "Tottenham Hotspur", "TOT", "England");
  const newcastle = await getOrCreateTeam(premierLeague, "Newcastle United", "NEW", "England");

  const realMadrid = await getOrCreateTeam(laLiga, "Real Madrid", "RMA", "Spain");
  const barcelona = await getOrCreateTeam(laLiga, "Barcelona", "BAR", "Spain");
  const atleticoMadrid = await getOrCreateTeam(laLiga, "Atletico Madrid", "ATM", "Spain");
  const sevilla = await getOrCreateTeam(laLiga, "Sevilla", "SEV", "Spain");

  const lakers = await getOrCreateTeam(nba, "Los Angeles Lakers", "LAL", "USA");
  const celtics = await getOrCreateTeam(nba, "Boston Celtics", "BOS", "USA");
  const warriors = await getOrCreateTeam(nba, "Golden State Warriors", "GSW", "USA");
  const bucks = await getOrCreateTeam(nba, "Milwaukee Bucks", "MIL", "USA");
  const nuggets = await getOrCreateTeam(nba, "Denver Nuggets", "DEN", "USA");
  const heat = await getOrCreateTeam(nba, "Miami Heat", "MIA", "USA");

  // Tennis has no "team" in the schema sense — each player is seeded as a
  // one-off "team" row so MATCH_RESULT events/markets work unmodified.
  const djokovic = await getOrCreateTeam(atpTour, "Novak Djokovic", "DJO", "Serbia");
  const alcaraz = await getOrCreateTeam(atpTour, "Carlos Alcaraz", "ALC", "Spain");
  const sinner = await getOrCreateTeam(atpTour, "Jannik Sinner", "SIN", "Italy");
  const medvedev = await getOrCreateTeam(atpTour, "Daniil Medvedev", "MED", "Russia");

  const now = Date.now();
  const hours = (n: number) => new Date(now + n * 60 * 60 * 1000);

  await createDemoEvent({
    competitionId: premierLeague,
    homeTeamId: arsenal,
    awayTeamId: chelsea,
    startTime: hours(48),
    status: "PUBLISHED",
    marketName: "Match Result",
    selections: [{ name: "Arsenal" }, { name: "Draw" }, { name: "Chelsea" }],
  });
  console.log("✓ Demo event: Arsenal vs Chelsea (PUBLISHED)");

  await createDemoEvent({
    competitionId: premierLeague,
    homeTeamId: liverpool,
    awayTeamId: manCity,
    startTime: hours(-1),
    status: "LIVE",
    marketName: "Match Result",
    selections: [{ name: "Liverpool" }, { name: "Draw" }, { name: "Manchester City" }],
  });
  console.log("✓ Demo event: Liverpool vs Manchester City (LIVE)");

  await createDemoEvent({
    competitionId: nba,
    homeTeamId: lakers,
    awayTeamId: celtics,
    startTime: hours(96),
    status: "DRAFT",
    marketName: "Match Result",
    selections: [{ name: "Lakers" }, { name: "Celtics" }],
  });
  console.log("✓ Demo event: Lakers vs Celtics (DRAFT)");

  await createDemoEvent({
    competitionId: nba,
    homeTeamId: warriors,
    awayTeamId: bucks,
    startTime: hours(-30),
    status: "FINISHED",
    homeScore: 112,
    awayScore: 108,
    marketName: "Match Result",
    selections: [{ name: "Warriors" }, { name: "Bucks" }],
  });
  console.log("✓ Demo event: Warriors vs Bucks (FINISHED, 112–108)");

  await createDemoEvent({
    competitionId: laLiga,
    homeTeamId: realMadrid,
    awayTeamId: barcelona,
    startTime: hours(72),
    status: "PUBLISHED",
    marketName: "Match Result",
    selections: [{ name: "Real Madrid" }, { name: "Draw" }, { name: "Barcelona" }],
  });
  console.log("✓ Demo event: Real Madrid vs Barcelona (PUBLISHED)");

  await createDemoEvent({
    competitionId: laLiga,
    homeTeamId: atleticoMadrid,
    awayTeamId: sevilla,
    startTime: hours(-2),
    status: "LIVE",
    homeScore: 1,
    awayScore: 1,
    marketName: "Match Result",
    selections: [{ name: "Atletico Madrid" }, { name: "Draw" }, { name: "Sevilla" }],
  });
  console.log("✓ Demo event: Atletico Madrid vs Sevilla (LIVE, 1–1)");

  await createDemoEvent({
    competitionId: nba,
    homeTeamId: nuggets,
    awayTeamId: heat,
    startTime: hours(-0.5),
    status: "LIVE",
    homeScore: 58,
    awayScore: 61,
    marketName: "Match Result",
    selections: [{ name: "Nuggets" }, { name: "Heat" }],
  });
  console.log("✓ Demo event: Nuggets vs Heat (LIVE, 58–61) — second LIVE match, useful for testing /live and Realtime");

  await createDemoEvent({
    competitionId: atpTour,
    homeTeamId: djokovic,
    awayTeamId: alcaraz,
    startTime: hours(24),
    status: "PUBLISHED",
    marketName: "Match Winner",
    selections: [{ name: "Djokovic" }, { name: "Alcaraz" }],
  });
  console.log("✓ Demo event: Djokovic vs Alcaraz (PUBLISHED)");

  await createDemoEvent({
    competitionId: atpTour,
    homeTeamId: sinner,
    awayTeamId: medvedev,
    startTime: hours(-48),
    status: "FINISHED",
    homeScore: 3,
    awayScore: 1,
    marketName: "Match Winner",
    selections: [{ name: "Sinner" }, { name: "Medvedev" }],
  });
  console.log("✓ Demo event: Sinner vs Medvedev (FINISHED, 3–1)");

  await createDemoEvent({
    competitionId: premierLeague,
    homeTeamId: tottenham,
    awayTeamId: newcastle,
    startTime: hours(120),
    status: "DRAFT",
    marketName: "Match Result",
    selections: [{ name: "Tottenham" }, { name: "Draw" }, { name: "Newcastle" }],
  });
  console.log("✓ Demo event: Tottenham vs Newcastle (DRAFT)");

  if (process.argv.includes("--bulk")) {
    const teamIds = {
      arsenal, chelsea, liverpool, manCity, tottenham, newcastle,
      realMadrid, barcelona, atleticoMadrid, sevilla,
      lakers, celtics, warriors, bucks, nuggets, heat,
      djokovic, alcaraz, sinner, medvedev,
    };
    const teamNames = {
      arsenal: "Arsenal", chelsea: "Chelsea", liverpool: "Liverpool", manCity: "Manchester City",
      tottenham: "Tottenham", newcastle: "Newcastle",
      realMadrid: "Real Madrid", barcelona: "Barcelona", atleticoMadrid: "Atletico Madrid", sevilla: "Sevilla",
      lakers: "Lakers", celtics: "Celtics", warriors: "Warriors", bucks: "Bucks", nuggets: "Nuggets", heat: "Heat",
      djokovic: "Djokovic", alcaraz: "Alcaraz", sinner: "Sinner", medvedev: "Medvedev",
    };
    await seedBulkEvents({ premierLeague, laLiga, nba, atpTour }, teamIds, teamNames);
  }

  console.log("\n✓ Seed complete. Sign in at /admin/login and check /admin/events.\n");
}

/**
 * Optional (`npm run seed:games -- --bulk`): pads out PUBLISHED events
 * across the competitions above so admin list pages (Phase 5's new
 * pagination) have more than one page of real data to page through
 * without hand-creating dozens of events in the UI. Always creates new
 * rows rather than matching existing ones — safe to run more than once,
 * it just adds more.
 */
async function seedBulkEvents(
  competitions: { premierLeague: string; laLiga: string; nba: string; atpTour: string },
  teams: Record<string, string>,
  teamNames: Record<string, string>
) {
  const fixtures: { competitionId: string; home: string; away: string; marketName: string }[] = [
    { competitionId: competitions.premierLeague, home: "arsenal", away: "liverpool", marketName: "Match Result" },
    { competitionId: competitions.premierLeague, home: "manCity", away: "chelsea", marketName: "Match Result" },
    { competitionId: competitions.premierLeague, home: "newcastle", away: "arsenal", marketName: "Match Result" },
    { competitionId: competitions.laLiga, home: "barcelona", away: "sevilla", marketName: "Match Result" },
    { competitionId: competitions.laLiga, home: "realMadrid", away: "atleticoMadrid", marketName: "Match Result" },
    { competitionId: competitions.nba, home: "celtics", away: "bucks", marketName: "Match Result" },
    { competitionId: competitions.nba, home: "warriors", away: "lakers", marketName: "Match Result" },
    { competitionId: competitions.atpTour, home: "alcaraz", away: "sinner", marketName: "Match Winner" },
    { competitionId: competitions.atpTour, home: "medvedev", away: "djokovic", marketName: "Match Winner" },
  ];

  const now = Date.now();
  let created = 0;
  for (let i = 0; i < 30; i++) {
    const fixture = fixtures[i % fixtures.length]!;
    const startTime = new Date(now + (i + 4) * 6 * 60 * 60 * 1000);
    const homeName = teamNames[fixture.home] ?? "Home";
    const awayName = teamNames[fixture.away] ?? "Away";
    await createDemoEvent({
      competitionId: fixture.competitionId,
      homeTeamId: teams[fixture.home]!,
      awayTeamId: teams[fixture.away]!,
      startTime,
      status: "PUBLISHED",
      marketName: fixture.marketName,
      selections:
        fixture.marketName === "Match Winner"
          ? [{ name: homeName }, { name: awayName }]
          : [{ name: homeName }, { name: "Draw" }, { name: awayName }],
    });
    created += 1;
  }
  console.log(`✓ Bulk-seeded ${created} additional PUBLISHED events for pagination testing.`);
}

main();
