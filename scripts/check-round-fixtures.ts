import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoundFixtures() {
  console.log("🔍 Analyzing round information in fixtures data...\n");

  // 1. Check available rounds in K League 1 (league_id: 292)
  console.log("1. Available rounds in K League 1 (2025):");
  const { data: rounds, error: roundsError } = await supabase
    .from("fixtures")
    .select("round")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .order("round");

  if (roundsError) {
    console.error("Rounds error:", roundsError);
  } else if (rounds) {
    const uniqueRounds = [...new Set(rounds.map(f => f.round))].sort();
    console.log("Unique rounds:", uniqueRounds);
    console.log("Total rounds found:", uniqueRounds.length);
  }

  // 2. Check fixtures by status to understand completed vs upcoming
  console.log("\n2. Fixtures by status:");
  const { data: statusData, error: statusError } = await supabase
    .from("fixtures")
    .select("status_short, round, date_utc, home_goals, away_goals")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .order("date_utc", { ascending: true });

  if (statusError) {
    console.error("Status error:", statusError);
  } else if (statusData) {
    const statusCounts: Record<string, number> = {};
    const completedRounds = new Set<string>();
    const upcomingRounds = new Set<string>();

    statusData.forEach(fixture => {
      statusCounts[fixture.status_short] = (statusCounts[fixture.status_short] || 0) + 1;
      
      // If goals are recorded, it's completed
      if (fixture.home_goals !== null && fixture.away_goals !== null) {
        completedRounds.add(fixture.round);
      } else {
        upcomingRounds.add(fixture.round);
      }
    });

    console.log("Status distribution:", statusCounts);
    console.log("Completed rounds:", Array.from(completedRounds).sort());
    console.log("Upcoming rounds:", Array.from(upcomingRounds).sort());
  }

  // 3. Get sample of upcoming fixtures
  console.log("\n3. Sample upcoming fixtures:");
  const { data: upcomingFixtures, error: upcomingError } = await supabase
    .from("fixtures")
    .select(`
      round, date_utc, status_short, 
      home_team:teams!fixtures_home_team_id_fkey(name),
      away_team:teams!fixtures_away_team_id_fkey(name)
    `)
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .is("home_goals", null)  // No goals recorded = upcoming
    .order("date_utc", { ascending: true })
    .limit(10);

  if (upcomingError) {
    console.error("Upcoming fixtures error:", upcomingError);
  } else if (upcomingFixtures) {
    upcomingFixtures.forEach(fixture => {
      const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team;
      const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team;
      
      console.log(`Round ${fixture.round}: ${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'} (${fixture.date_utc}) - ${fixture.status_short}`);
    });
  }

  // 4. Check what the current/next round might be
  console.log("\n4. Round progression analysis:");
  const { data: roundProgress, error: progressError } = await supabase
    .from("fixtures")
    .select("round, status_short, home_goals")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .order("round");

  if (progressError) {
    console.error("Progress error:", progressError);
  } else if (roundProgress) {
    const roundStatus: Record<string, {completed: number, total: number}> = {};
    
    roundProgress.forEach(fixture => {
      if (!roundStatus[fixture.round]) {
        roundStatus[fixture.round] = {completed: 0, total: 0};
      }
      roundStatus[fixture.round].total++;
      if (fixture.home_goals !== null) {
        roundStatus[fixture.round].completed++;
      }
    });

    console.log("Round completion status:");
    Object.keys(roundStatus).sort().forEach(round => {
      const status = roundStatus[round];
      const completionRate = Math.round((status.completed / status.total) * 100);
      console.log(`Round ${round}: ${status.completed}/${status.total} completed (${completionRate}%)`);
    });
  }
}

checkRoundFixtures().catch(console.error);