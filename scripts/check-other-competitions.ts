import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOtherCompetitions() {
  console.log("🔍 Checking for other Korean competitions and future fixtures...\n");

  // 1. Check all available leagues in database
  console.log("1. Available leagues in database:");
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("*")
    .order("id");

  if (leaguesError) {
    console.error("Leagues error:", leaguesError);
  } else if (leagues) {
    console.log("All leagues found:");
    leagues.forEach(league => {
      console.log(`- League ID ${league.id}: ${league.name} (Country: ${league.country || league.country_name || 'Unknown'})`);
    });
    
    // Filter Korean leagues
    const koreanLeagues = leagues.filter(league => 
      league.country === 'South Korea' || 
      league.country_name === 'South Korea' ||
      league.name?.includes('K League') ||
      league.name?.includes('Korean')
    );
    console.log("\nKorean leagues:");
    koreanLeagues.forEach(league => {
      console.log(`- League ID ${league.id}: ${league.name}`);
    });
  }

  // 2. Check for fixtures in different leagues (focus on league 292 and 293)
  console.log("\n2. Checking fixtures in leagues 292 and 293:");
  const targetLeagues = [292, 293];
  
  for (const leagueId of targetLeagues) {
    const { data: fixtures, error: fixturesError } = await supabase
      .from("fixtures")
      .select("id, date_utc, round, status_short")
      .eq("league_id", leagueId)
      .order("date_utc", { ascending: false })
      .limit(5);

    if (fixturesError) {
      console.error(`Fixtures error for league ${leagueId}:`, fixturesError);
    } else if (fixtures && fixtures.length > 0) {
      console.log(`\nLeague ${leagueId}:`);
      console.log(`Recent fixtures (latest 5):`);
      fixtures.forEach(fixture => {
        console.log(`- ${fixture.date_utc} | ${fixture.round} | ${fixture.status_short}`);
      });

      // Check for future dates
      const today = new Date().toISOString().split('T')[0];
      const { data: futureFixtures, error: futureError } = await supabase
        .from("fixtures")
        .select("date_utc, round, status_short")
        .eq("league_id", leagueId)
        .gte("date_utc", today)
        .order("date_utc");

      if (!futureError && futureFixtures && futureFixtures.length > 0) {
        console.log(`🚨 FUTURE FIXTURES FOUND in League ${leagueId}:`);
        futureFixtures.forEach(fixture => {
          console.log(`  - ${fixture.date_utc} | ${fixture.round} | ${fixture.status_short}`);
        });
      } else {
        console.log(`No future fixtures in League ${leagueId}`);
      }
    } else {
      console.log(`League ${leagueId}: No fixtures found`);
    }
  }

  // 3. Check different round types that might indicate playoffs
  console.log("\n3. Analyzing round types across all leagues:");
  const { data: roundTypes, error: roundError } = await supabase
    .from("fixtures")
    .select("round, league_id")
    .order("round");

  if (roundError) {
    console.error("Round types error:", roundError);
  } else if (roundTypes) {
    const uniqueRounds = [...new Set(roundTypes.map(r => r.round))];
    console.log("All round types found:");
    uniqueRounds.forEach(round => {
      const leagueIds = roundTypes
        .filter(r => r.round === round)
        .map(r => r.league_id);
      const uniqueLeagueIds = [...new Set(leagueIds)];
      console.log(`- "${round}" (leagues: ${uniqueLeagueIds.join(", ")})`);
    });

    // Look for playoff-like rounds
    const playoffRounds = uniqueRounds.filter(round => 
      round.toLowerCase().includes('playoff') ||
      round.toLowerCase().includes('final') ||
      round.toLowerCase().includes('semi') ||
      round.toLowerCase().includes('quarter') ||
      round.toLowerCase().includes('championship')
    );
    
    if (playoffRounds.length > 0) {
      console.log("\n🏆 Potential playoff/cup rounds found:");
      playoffRounds.forEach(round => console.log(`- ${round}`));
    } else {
      console.log("\nNo playoff/cup rounds detected in round names");
    }
  }

  // 4. Check for any TBD or NS status fixtures
  console.log("\n4. Checking for fixtures with TBD or NS status:");
  const { data: pendingFixtures, error: pendingError } = await supabase
    .from("fixtures")
    .select("date_utc, round, status_short, league_id")
    .in("status_short", ["TBD", "NS"])
    .order("date_utc");

  if (pendingError) {
    console.error("Pending fixtures error:", pendingError);
  } else if (pendingFixtures && pendingFixtures.length > 0) {
    console.log("🚨 PENDING FIXTURES FOUND:");
    pendingFixtures.forEach(fixture => {
      console.log(`- League ${fixture.league_id} | ${fixture.date_utc} | ${fixture.round} | ${fixture.status_short}`);
    });
  } else {
    console.log("No pending fixtures found (TBD/NS status)");
  }

  console.log("\n💡 Summary:");
  console.log("- K-League 1 (292) and K-League 2 (293) regular seasons are complete");
  console.log("- No upcoming fixtures found in current database");
  console.log("- For future fixtures, we would need:");
  console.log("  1. 2026 season data when available");
  console.log("  2. Cup competition data (FA Cup, League Cup, etc.)");
  console.log("  3. Playoff/Championship data if applicable");
  console.log("  4. International competition data (AFC Champions League, etc.)");
}

checkOtherCompetitions().catch(console.error);