import { createClient } from "@supabase/supabase-js";
import fetch from 'node-fetch';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface APIFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

async function importUpcomingFixtures() {
  console.log("🔄 Starting upcoming fixtures import...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY not found in environment variables");
    console.log("Skipping upcoming fixtures import");
    return;
  }

  const seasonYear = Number(process.env.SEASON_YEAR) || 2025;
  const koreanLeagues = [292, 293]; // K-League 1, K-League 2

  let totalImported = 0;

  for (const leagueId of koreanLeagues) {
    console.log(`📋 Processing League ${leagueId}...`);

    try {
      // 1. Get upcoming fixtures using 'next' parameter
      console.log("  → Fetching next 20 fixtures...");
      const nextResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${seasonYear}&next=20`, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      if (nextResponse.ok) {
        const nextData = await nextResponse.json() as { response: APIFootballFixture[] };
        if (nextData.response && nextData.response.length > 0) {
          console.log(`  ✅ Found ${nextData.response.length} upcoming fixtures`);
          await processFixtures(nextData.response, leagueId, seasonYear);
          totalImported += nextData.response.length;
        } else {
          console.log("  📭 No upcoming fixtures found with 'next' parameter");
        }
      } else {
        console.log(`  ❌ Next fixtures request failed: ${nextResponse.status}`);
      }

      // 2. Get fixtures with TBD status
      console.log("  → Fetching TBD status fixtures...");
      const tbdResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${seasonYear}&status=TBD`, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      if (tbdResponse.ok) {
        const tbdData = await tbdResponse.json() as { response: APIFootballFixture[] };
        if (tbdData.response && tbdData.response.length > 0) {
          console.log(`  ✅ Found ${tbdData.response.length} TBD fixtures`);
          await processFixtures(tbdData.response, leagueId, seasonYear);
          totalImported += tbdData.response.length;
        } else {
          console.log("  📭 No TBD fixtures found");
        }
      } else {
        console.log(`  ❌ TBD fixtures request failed: ${tbdResponse.status}`);
      }

      // 3. Get fixtures with NS (Not Started) status
      console.log("  → Fetching NS status fixtures...");
      const nsResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${seasonYear}&status=NS`, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      if (nsResponse.ok) {
        const nsData = await nsResponse.json() as { response: APIFootballFixture[] };
        if (nsData.response && nsData.response.length > 0) {
          console.log(`  ✅ Found ${nsData.response.length} NS fixtures`);
          await processFixtures(nsData.response, leagueId, seasonYear);
          totalImported += nsData.response.length;
        } else {
          console.log("  📭 No NS fixtures found");
        }
      } else {
        console.log(`  ❌ NS fixtures request failed: ${nsResponse.status}`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error processing league ${leagueId}:`, error);
    }
  }

  console.log(`\n✅ Import completed! Total upcoming fixtures imported: ${totalImported}`);
}

async function processFixtures(fixtures: APIFootballFixture[], leagueId: number, seasonYear: number) {
  for (const fixture of fixtures) {
    try {
      // Check if fixture already exists
      const { data: existing } = await supabase
        .from("fixtures")
        .select("id")
        .eq("id", fixture.fixture.id)
        .maybeSingle();

      const fixtureData = {
        id: fixture.fixture.id,
        referee: fixture.fixture.referee,
        timezone: fixture.fixture.timezone,
        date_utc: new Date(fixture.fixture.date).toISOString(),
        timestamp: fixture.fixture.timestamp,
        status_long: fixture.fixture.status.long,
        status_short: fixture.fixture.status.short,
        elapsed: fixture.fixture.status.elapsed,
        round: fixture.league.round,
        season_year: seasonYear,
        league_id: leagueId,
        home_team_id: fixture.teams.home.id,
        away_team_id: fixture.teams.away.id,
        home_goals: fixture.goals.home,
        away_goals: fixture.goals.away,
        venue_id: fixture.fixture.venue.id,
      };

      if (existing) {
        // Update existing fixture
        const { error } = await supabase
          .from("fixtures")
          .update(fixtureData)
          .eq("id", fixture.fixture.id);

        if (error) {
          console.error(`Error updating fixture ${fixture.fixture.id}:`, error);
        } else {
          console.log(`  📝 Updated fixture: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
        }
      } else {
        // Insert new fixture
        const { error } = await supabase
          .from("fixtures")
          .insert(fixtureData);

        if (error) {
          console.error(`Error inserting fixture ${fixture.fixture.id}:`, error);
        } else {
          console.log(`  ➕ Added fixture: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
        }
      }

      // Ensure teams exist
      await ensureTeamExists(fixture.teams.home, leagueId, seasonYear);
      await ensureTeamExists(fixture.teams.away, leagueId, seasonYear);

    } catch (error) {
      console.error(`Error processing fixture ${fixture.fixture.id}:`, error);
    }
  }
}

async function ensureTeamExists(team: { id: number; name: string; logo: string }, leagueId: number, seasonYear: number) {
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("id", team.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("teams")
      .insert({
        id: team.id,
        name: team.name,
        logo_url: team.logo,
        league_id: leagueId,
        season_year: seasonYear,
        country_name: "South Korea", // 한국 리그이므로 고정
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error(`Error inserting team ${team.id}:`, error);
    }
  }
}

// Run the import
importUpcomingFixtures().catch(console.error);