import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAPIFootballUpcoming() {
  console.log("🔍 Checking API-Football for upcoming K-League fixtures...\n");

  // Try to fetch upcoming fixtures from API-Football for K-League
  try {
    const response = await fetch("https://v3.football.api-sports.io/fixtures?league=292&season=2025&status=NS", {
      headers: {
        "x-rapidapi-key": process.env.API_FOOTBALL_KEY || "demo-key"
      }
    });

    if (!response.ok) {
      console.log("❌ API-Football request failed:", response.status, response.statusText);
      console.log("This might be due to API key limitations or rate limits.\n");
    } else {
      const data = await response.json();
      console.log("✅ API-Football upcoming fixtures response:");
      console.log("Total upcoming fixtures:", data.results || 0);
      
      if (data.response && data.response.length > 0) {
        console.log("\n📅 Sample upcoming fixtures:");
        data.response.slice(0, 5).forEach((fixture: any, index: number) => {
          console.log(`${index + 1}. Round ${fixture.league.round}: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
          console.log(`   Date: ${fixture.fixture.date} | Status: ${fixture.fixture.status.short}`);
        });
      } else {
        console.log("No upcoming fixtures found in API-Football for 2025 season");
      }
    }
  } catch (error) {
    console.log("❌ API-Football request error:", error);
    console.log("This is expected if we don't have a valid API key.\n");
  }

  // Check what seasons are available in our database
  console.log("2. Checking available seasons in our database:");
  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("*")
    .order("year", { ascending: false });

  if (seasonsError) {
    console.error("Seasons error:", seasonsError);
  } else if (seasons) {
    console.log("Available seasons:");
    seasons.forEach(season => {
      console.log(`- ${season.year}: ${season.start_date} to ${season.end_date} (current: ${season.is_current})`);
    });
  }

  // Check if there are any fixtures with future dates
  console.log("\n3. Checking for any future-dated fixtures:");
  const today = new Date().toISOString().split('T')[0];
  
  const { data: futureFixtures, error: futureError } = await supabase
    .from("fixtures")
    .select("date_utc, round, status_short, league_id, season_year")
    .gte("date_utc", today)
    .eq("league_id", 292)
    .order("date_utc", { ascending: true })
    .limit(10);

  if (futureError) {
    console.error("Future fixtures error:", futureError);
  } else if (futureFixtures && futureFixtures.length > 0) {
    console.log("Found future fixtures:");
    futureFixtures.forEach(fixture => {
      console.log(`- ${fixture.date_utc} | Round: ${fixture.round} | Status: ${fixture.status_short}`);
    });
  } else {
    console.log("No future fixtures found in database");
  }

  // Check latest fixture to understand season status
  console.log("\n4. Latest completed fixture:");
  const { data: latestFixture, error: latestError } = await supabase
    .from("fixtures")
    .select("date_utc, round, status_short, league_id, season_year")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .order("date_utc", { ascending: false })
    .limit(1);

  if (latestError) {
    console.error("Latest fixture error:", latestError);
  } else if (latestFixture && latestFixture.length > 0) {
    console.log(`Latest fixture: ${latestFixture[0].date_utc} | Round: ${latestFixture[0].round}`);
    
    const lastDate = new Date(latestFixture[0].date_utc);
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Days since last fixture: ${daysSince}`);
  }

  console.log("\n💡 Summary:");
  console.log("- K-League 1 2025 regular season appears to be completed (29 rounds)");
  console.log("- To get upcoming fixtures, we would need to:");
  console.log("  1. Check if there are playoff matches (different league/cup IDs)");
  console.log("  2. Import 2026 season fixtures when they become available");
  console.log("  3. Check for cup competitions or international matches");
}

checkAPIFootballUpcoming().catch(console.error);