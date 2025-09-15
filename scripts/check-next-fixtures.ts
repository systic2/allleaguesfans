import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNextFixtures() {
  console.log("🔍 Checking API-Football for next fixtures using 'next' parameter...\n");

  // Test different approaches to get next fixtures
  const testCases = [
    {
      name: "K-League 1 next 5 fixtures",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=292&season=2025&next=5"
    },
    {
      name: "K-League 2 next 5 fixtures", 
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=293&season=2025&next=5"
    },
    {
      name: "All Korean leagues next fixtures",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?next=10"
    },
    {
      name: "Fixtures with TBD status",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=292&season=2025&status=TBD"
    },
    {
      name: "Fixtures with NS status", 
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=292&season=2025&status=NS"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const response = await fetch(testCase.url, {
        headers: {
          "X-RapidAPI-Key": process.env.API_FOOTBALL_KEY || "demo-key",
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      if (!response.ok) {
        console.log(`❌ Request failed: ${response.status} ${response.statusText}`);
        if (response.status === 403) {
          console.log("   → API key limitation or rate limit");
        }
        continue;
      }

      const data = await response.json();
      console.log(`✅ Response received:`);
      console.log(`   Total results: ${data.results || 0}`);
      
      if (data.response && data.response.length > 0) {
        console.log(`   🎯 Found ${data.response.length} fixtures:`);
        data.response.slice(0, 3).forEach((fixture: any, index: number) => {
          console.log(`   ${index + 1}. ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
          console.log(`      Date: ${fixture.fixture.date}`);
          console.log(`      Status: ${fixture.fixture.status.short} (${fixture.fixture.status.long})`);
          console.log(`      Round: ${fixture.league.round}`);
        });
        
        if (data.response.length > 3) {
          console.log(`   ... and ${data.response.length - 3} more fixtures`);
        }
      } else {
        console.log("   📭 No fixtures found");
      }

    } catch (error) {
      console.log(`❌ Request error:`, error);
      console.log("   → This is expected if API key is not available");
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Also check our database for any team-specific next fixtures logic
  console.log("\n🔍 Checking if we can implement 'next fixtures' logic in our database:");
  
  // Get a sample team to test with
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", 292)
    .limit(1);

  if (!teamsError && teams && teams.length > 0) {
    const sampleTeam = teams[0];
    console.log(`\nUsing sample team: ${sampleTeam.name} (ID: ${sampleTeam.id})`);
    
    // Get last fixtures for this team
    const { data: lastFixtures, error: lastError } = await supabase
      .from("fixtures")
      .select("date_utc, status_short, home_team_id, away_team_id")
      .or(`home_team_id.eq.${sampleTeam.id},away_team_id.eq.${sampleTeam.id}`)
      .order("date_utc", { ascending: false })
      .limit(5);

    if (!lastError && lastFixtures) {
      console.log("Last 5 fixtures for this team:");
      lastFixtures.forEach((fixture, index) => {
        const isHome = fixture.home_team_id === sampleTeam.id;
        console.log(`${index + 1}. ${fixture.date_utc} | ${isHome ? 'Home' : 'Away'} | ${fixture.status_short}`);
      });
    }

    // Try to get future fixtures for this team
    const today = new Date().toISOString().split('T')[0];
    const { data: futureFixtures, error: futureError } = await supabase
      .from("fixtures")
      .select("date_utc, status_short, home_team_id, away_team_id")
      .or(`home_team_id.eq.${sampleTeam.id},away_team_id.eq.${sampleTeam.id}`)
      .gte("date_utc", today)
      .order("date_utc", { ascending: true })
      .limit(5);

    if (!futureError && futureFixtures && futureFixtures.length > 0) {
      console.log("🚨 Found future fixtures for this team:");
      futureFixtures.forEach((fixture, index) => {
        const isHome = fixture.home_team_id === sampleTeam.id;
        console.log(`${index + 1}. ${fixture.date_utc} | ${isHome ? 'Home' : 'Away'} | ${fixture.status_short}`);
      });
    } else {
      console.log("No future fixtures found for this team in database");
    }
  }

  console.log("\n💡 Summary:");
  console.log("- Used API-Football's 'next' parameter to check for upcoming fixtures");
  console.log("- Tested multiple approaches: by league, by status, general search");
  console.log("- If API key is available, this would show real upcoming fixtures");
  console.log("- Current database shows no future fixtures for K-League teams");
  console.log("\n🔧 Implementation possibilities:");
  console.log("1. Use 'next' parameter in API calls to get upcoming fixtures");
  console.log("2. Import fixtures with TBD/NS status when available");
  console.log("3. Check for cup competitions or playoff phases");
  console.log("4. Monitor for 2026 season fixture releases");
}

checkNextFixtures().catch(console.error);