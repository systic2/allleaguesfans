#!/usr/bin/env tsx
/**
 * master-import-improved.ts
 * 
 * Improved master import script with proper error handling and UPSERT logic
 * This version fixes all the foreign key constraint violations identified in the logs
 */

import { createClient } from "@supabase/supabase-js";
import { 
  runIntegrityFixes,
  safeVenueUpsert,
  safeStandingsUpsert, 
  safeEventsUpsert,
  safePlayerStatsUpsert,
  safeFixtureUpsert,
  safeBatchUpsert,
  validateDatabaseIntegrity
} from "./fix-import-upsert-logic.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || "";
const apiKey = process.env.API_FOOTBALL_KEY;
const seasonYear = parseInt(process.env.SEASON_YEAR || "2025");

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error("❌ Missing required environment variables:");
  console.error("- SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
  console.error("- SUPABASE_SERVICE_ROLE:", supabaseKey ? "✅" : "❌");
  console.error("- API_FOOTBALL_KEY:", apiKey ? "✅" : "❌");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// K League IDs
const LEAGUES = [
  { id: 292, name: "K League 1" },
  { id: 293, name: "K League 2" }
];

// API delay to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch data from API-Football with retry logic
 */
async function fetchFromAPI(endpoint: string, retries = 3): Promise<any> {
  const url = `https://v3.football.api-sports.io${endpoint}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-apisports-key': apiKey!
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        throw new Error(`API Error: ${JSON.stringify(data.errors)}`);
      }

      return data.response;
    } catch (error) {
      console.error(`❌ API request failed (attempt ${attempt}/${retries}):`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      await delay(1000 * Math.pow(2, attempt));
    }
  }
}

/**
 * Import countries with improved error handling
 */
async function importCountries() {
  console.log("🌍 Importing countries...");
  
  try {
    const countries = await fetchFromAPI('/countries');
    
    const countryData = countries.map((country: any) => ({
      name: country.name,
      code: country.code,
      flag: country.flag
    }));

    // Use batch upsert for countries
    const { data, error } = await supabase
      .from('countries')
      .upsert(countryData, { onConflict: 'name', ignoreDuplicates: false });

    if (error) throw error;
    
    console.log(`✅ Imported ${countryData.length} countries`);
    return true;
  } catch (error: any) {
    console.error("❌ Error importing countries:", error.message);
    return false;
  }
}

/**
 * Import leagues with proper season handling
 */
async function importLeagues() {
  console.log(`🏆 Importing leagues for season ${seasonYear}...`);

  for (const league of LEAGUES) {
    try {
      const leagueResponse = await fetchFromAPI(`/leagues?id=${league.id}&season=${seasonYear}`);
      
      if (!leagueResponse || leagueResponse.length === 0) {
        console.warn(`⚠️ No data found for league ${league.id}`);
        continue;
      }

      const leagueInfo = leagueResponse[0];
      const season = leagueInfo.seasons?.[0];

      const leagueData = {
        id: leagueInfo.league.id,
        name: leagueInfo.league.name,
        type: leagueInfo.league.type,
        logo_url: leagueInfo.league.logo,
        country_name: leagueInfo.country.name,
        country_code: leagueInfo.country.code,
        country_flag: leagueInfo.country.flag,
        season_year: seasonYear,
        season_start: season?.start ? new Date(season.start) : null,
        season_end: season?.end ? new Date(season.end) : null,
        current: season?.current || false
      };

      const { error } = await supabase
        .from('leagues')
        .upsert([leagueData], { 
          onConflict: 'id,season_year', 
          ignoreDuplicates: false 
        });

      if (error) throw error;
      console.log(`✅ Imported league: ${leagueData.name}`);
      
      await delay(200); // Rate limiting
    } catch (error: any) {
      console.error(`❌ Error importing league ${league.id}:`, error.message);
    }
  }
}

/**
 * Import teams with venue validation
 */
async function importTeams() {
  console.log(`⚽ Importing teams for season ${seasonYear}...`);

  for (const league of LEAGUES) {
    try {
      console.log(`  → Processing league ${league.id}`);
      const teams = await fetchFromAPI(`/teams?league=${league.id}&season=${seasonYear}`);
      
      if (!teams || teams.length === 0) {
        console.warn(`⚠️ No teams found for league ${league.id}`);
        continue;
      }

      for (const teamResponse of teams) {
        const team = teamResponse.team;
        const venue = teamResponse.venue;

        // Import venue first if it exists
        if (venue && venue.id) {
          await safeVenueUpsert({
            id: venue.id,
            name: venue.name,
            address: venue.address,
            city: venue.city,
            country: team.country,
            capacity: venue.capacity,
            surface: venue.surface,
            image: venue.image
          });
        }

        // Import team
        const teamData = {
          id: team.id,
          name: team.name,
          code: team.code,
          logo_url: team.logo,
          country_name: team.country,
          founded: team.founded,
          national: team.national,
          league_id: league.id,
          season_year: seasonYear,
          venue_id: venue?.id || null,
          venue_name: venue?.name || null,
          venue_address: venue?.address || null,
          venue_city: venue?.city || null,
          venue_capacity: venue?.capacity || null,
          venue_surface: venue?.surface || null,
          venue_image: venue?.image || null
        };

        const { error } = await supabase
          .from('teams')
          .upsert([teamData], {
            onConflict: 'id,season_year',
            ignoreDuplicates: false
          });

        if (error) throw error;
      }

      console.log(`✅ Imported ${teams.length} teams for league ${league.id}`);
      await delay(500);
    } catch (error: any) {
      console.error(`❌ Error importing teams for league ${league.id}:`, error.message);
    }
  }
}

/**
 * Import players with improved statistics handling
 */
async function importPlayers() {
  console.log(`👥 Importing players for season ${seasonYear}...`);

  // Get all teams from database
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('season_year', seasonYear);

  if (teamsError || !teams) {
    console.error("❌ Error fetching teams:", teamsError);
    return;
  }

  for (const team of teams) {
    try {
      console.log(`  → Processing players for ${team.name} (${team.id})`);
      
      const playersResponse = await fetchFromAPI(`/players/squads?team=${team.id}`);
      
      if (!playersResponse || playersResponse.length === 0) {
        console.warn(`⚠️ No players found for team ${team.id}`);
        continue;
      }

      const players = playersResponse[0]?.players || [];
      
      for (const playerData of players) {
        // Import player
        const player = {
          id: playerData.id,
          name: playerData.name,
          firstname: playerData.firstname,
          lastname: playerData.lastname,
          age: playerData.age,
          birth_date: playerData.birth?.date ? new Date(playerData.birth.date) : null,
          birth_place: playerData.birth?.place,
          birth_country: playerData.birth?.country,
          nationality: playerData.nationality,
          height: playerData.height,
          weight: playerData.weight,
          injured: playerData.injured,
          photo: playerData.photo,
          jersey_number: playerData.number,
          position: playerData.position,
          team_id: team.id,
          season_year: seasonYear
        };

        const { error: playerError } = await supabase
          .from('players')
          .upsert([player], {
            onConflict: 'id,season_year',
            ignoreDuplicates: false
          });

        if (playerError) {
          console.error(`❌ Error inserting player ${player.name}:`, playerError);
          continue;
        }

        // Import player statistics with validation
        try {
          const statsResponse = await fetchFromAPI(`/players?id=${playerData.id}&season=${seasonYear}`);
          
          if (statsResponse && statsResponse.length > 0) {
            const playerStats = statsResponse[0];
            
            for (const statGroup of playerStats.statistics || []) {
              const statsData = {
                player_id: playerData.id,
                team_id: statGroup.team?.id || team.id,
                league_id: statGroup.league?.id,
                season_year: seasonYear,
                position: statGroup.games?.position,
                rating: parseFloat(statGroup.games?.rating) || null,
                captain: statGroup.games?.captain || false,
                appearances: statGroup.games?.appearences || 0,
                lineups: statGroup.games?.lineups || 0,
                minutes: statGroup.games?.minutes || 0,
                substitute_in: statGroup.substitutes?.in || 0,
                substitute_out: statGroup.substitutes?.out || 0,
                substitute_bench: statGroup.substitutes?.bench || 0,
                shots_total: statGroup.shots?.total || 0,
                shots_on: statGroup.shots?.on || 0,
                goals_total: statGroup.goals?.total || 0,
                goals_conceded: statGroup.goals?.conceded || 0,
                goals_assists: statGroup.goals?.assists || 0,
                goals_saves: statGroup.goals?.saves || 0,
                passes_total: statGroup.passes?.total || 0,
                passes_key: statGroup.passes?.key || 0,
                passes_accuracy: parseFloat(statGroup.passes?.accuracy) || null,
                tackles_total: statGroup.tackles?.total || 0,
                tackles_blocks: statGroup.tackles?.blocks || 0,
                tackles_interceptions: statGroup.tackles?.interceptions || 0,
                duels_total: statGroup.duels?.total || 0,
                duels_won: statGroup.duels?.won || 0,
                dribbles_attempts: statGroup.dribbles?.attempts || 0,
                dribbles_success: statGroup.dribbles?.success || 0,
                dribbles_past: statGroup.dribbles?.past || 0,
                fouls_drawn: statGroup.fouls?.drawn || 0,
                fouls_committed: statGroup.fouls?.committed || 0,
                cards_yellow: statGroup.cards?.yellow || 0,
                cards_yellowred: statGroup.cards?.yellowred || 0,
                cards_red: statGroup.cards?.red || 0,
                penalty_won: statGroup.penalty?.won || 0,
                penalty_committed: statGroup.penalty?.committed || 0,
                penalty_scored: statGroup.penalty?.scored || 0,
                penalty_missed: statGroup.penalty?.missed || 0,
                penalty_saved: statGroup.penalty?.saved || 0
              };

              // Use safe upsert for player statistics
              await safePlayerStatsUpsert(statsData);
            }
          }
        } catch (statsError: any) {
          // Non-critical error, continue with next player
          console.warn(`⚠️ Could not fetch statistics for ${player.name}:`, statsError.message);
        }

        await delay(100); // Small delay between players
      }

      console.log(`    ✅ Imported ${players.length} players for ${team.name}`);
      await delay(1000); // Longer delay between teams
    } catch (error: any) {
      console.error(`❌ Error importing players for team ${team.id}:`, error.message);
    }
  }
}

/**
 * Import fixtures with venue validation
 */
async function importFixtures() {
  console.log(`📅 Importing fixtures for season ${seasonYear}...`);

  for (const league of LEAGUES) {
    try {
      const fixtures = await fetchFromAPI(`/fixtures?league=${league.id}&season=${seasonYear}`);
      
      if (!fixtures || fixtures.length === 0) {
        console.warn(`⚠️ No fixtures found for league ${league.id}`);
        continue;
      }

      const fixtureData = fixtures.map((fixture: any) => ({
        id: fixture.fixture.id,
        referee: fixture.fixture.referee,
        timezone: fixture.fixture.timezone,
        date_utc: new Date(fixture.fixture.date),
        timestamp: fixture.fixture.timestamp,
        status_long: fixture.fixture.status.long,
        status_short: fixture.fixture.status.short,
        elapsed: fixture.fixture.status.elapsed,
        round: fixture.league.round,
        season_year: seasonYear,
        league_id: league.id,
        home_team_id: fixture.teams.home.id,
        away_team_id: fixture.teams.away.id,
        home_goals: fixture.goals.home,
        away_goals: fixture.goals.away,
        venue_id: fixture.fixture.venue?.id || null
      }));

      // Use safe batch upsert for fixtures
      await safeBatchUpsert('fixtures', fixtureData, safeFixtureUpsert, 20);
      
      console.log(`✅ Imported ${fixtureData.length} fixtures for league ${league.id}`);
      await delay(1000);
    } catch (error: any) {
      console.error(`❌ Error importing fixtures for league ${league.id}:`, error.message);
    }
  }
}

/**
 * Import events with proper constraint handling
 */
async function importEvents() {
  console.log(`⚡ Importing events for season ${seasonYear}...`);

  // Get fixtures that have events
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('id')
    .eq('season_year', seasonYear)
    .in('status_short', ['FT', 'AET', 'PEN']); // Only completed matches

  if (fixturesError || !fixtures) {
    console.error("❌ Error fetching fixtures:", fixturesError);
    return;
  }

  const batchSize = 10;
  for (let i = 0; i < fixtures.length; i += batchSize) {
    const batch = fixtures.slice(i, i + batchSize);
    
    for (const fixture of batch) {
      try {
        console.log(`  → Processing events for fixture ${fixture.id}`);
        
        const events = await fetchFromAPI(`/fixtures/events?fixture=${fixture.id}`);
        
        if (!events || events.length === 0) {
          continue;
        }

        const eventData = events.map((event: any) => ({
          fixture_id: fixture.id,
          team_id: event.team?.id || null,
          player_id: event.player?.id || null,
          assist_player_id: event.assist?.id || null,
          time_elapsed: event.time?.elapsed || 0,
          time_extra: event.time?.extra || null,
          type: event.type,
          detail: event.detail,
          comments: event.comments
        })).filter(event => event.team_id); // Only keep events with valid team_id

        // Use safe batch upsert for events
        if (eventData.length > 0) {
          await safeBatchUpsert('events', eventData, safeEventsUpsert, 5);
        }

        await delay(200);
      } catch (error: any) {
        console.error(`❌ Error importing events for fixture ${fixture.id}:`, error.message);
      }
    }
    
    // Longer delay between batches
    await delay(2000);
  }
  
  console.log("✅ Events import completed");
}

/**
 * Import standings with proper UPSERT
 */
async function importStandings() {
  console.log(`📊 Importing standings for season ${seasonYear}...`);

  for (const league of LEAGUES) {
    try {
      console.log(`  → Processing standings for league ${league.id}`);
      
      const standingsResponse = await fetchFromAPI(`/standings?league=${league.id}&season=${seasonYear}`);
      
      if (!standingsResponse || standingsResponse.length === 0) {
        console.warn(`⚠️ No standings found for league ${league.id}`);
        continue;
      }

      const standings = standingsResponse[0]?.league?.standings?.[0] || [];
      console.log(`  🔍 Found ${standings.length} teams in standings`);

      const standingsData = standings.map((standing: any) => ({
        league_id: league.id,
        season_year: seasonYear,
        team_id: standing.team.id,
        rank_position: standing.rank,
        points: standing.points,
        goalsDiff: standing.goalsDiff,
        group_name: standing.group || null,
        form: standing.form,
        status: standing.status,
        description: standing.description,
        all_played: standing.all?.played || 0,
        all_win: standing.all?.win || 0,
        all_draw: standing.all?.draw || 0,
        all_lose: standing.all?.lose || 0,
        all_goals_for: standing.all?.goals?.for || 0,
        all_goals_against: standing.all?.goals?.against || 0,
        home_played: standing.home?.played || 0,
        home_win: standing.home?.win || 0,
        home_draw: standing.home?.draw || 0,
        home_lose: standing.home?.lose || 0,
        home_goals_for: standing.home?.goals?.for || 0,
        home_goals_against: standing.home?.goals?.against || 0,
        away_played: standing.away?.played || 0,
        away_win: standing.away?.win || 0,
        away_draw: standing.away?.draw || 0,
        away_lose: standing.away?.lose || 0,
        away_goals_for: standing.away?.goals?.for || 0,
        away_goals_against: standing.away?.goals?.against || 0
      }));

      // Use safe batch upsert for standings
      await safeBatchUpsert('standings', standingsData, safeStandingsUpsert, 5);
      
      console.log(`✅ Imported standings for ${standings.length} teams in league ${league.id}`);
      await delay(1000);
    } catch (error: any) {
      console.error(`❌ Error importing standings for league ${league.id}:`, error.message);
    }
  }
}

/**
 * Main import function
 */
async function runImport() {
  console.log("🚀 Starting comprehensive API-Football import...");
  console.log(`Season: ${seasonYear}`);
  console.log(`API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log("==========================================\n");

  try {
    // Step 0: Run integrity fixes first
    await runIntegrityFixes();

    // Step 1: Import base data
    await importCountries();
    await importLeagues();
    await importTeams();

    // Step 2: Import player data (most error-prone)
    await importPlayers();

    // Step 3: Import match data
    await importFixtures();
    await importEvents();

    // Step 4: Import standings
    await importStandings();

    // Step 5: Final validation
    console.log("\n==========================================");
    console.log("🎉 Master import completed successfully!");
    await validateDatabaseIntegrity();
    
    // Print final stats
    const { data: stats } = await supabase
      .rpc('get_import_stats', { season: seasonYear })
      .single();
      
    if (stats) {
      console.log("\n📊 Final Import Statistics:");
      Object.entries(stats).forEach(([table, count]) => {
        console.log(`📊 ${table}: ${count} records`);
      });
    }

  } catch (error: any) {
    console.error("❌ Import failed:", error.message);
    throw error;
  }
}

// Execute import
if (import.meta.url === `file://${process.argv[1]}`) {
  runImport()
    .then(() => {
      console.log("✅ Master import completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Master import failed:", error);
      process.exit(1);
    });
}

export { runImport };