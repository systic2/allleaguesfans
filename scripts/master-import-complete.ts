import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// API-Football interfaces
interface APIFootballLeague {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}

interface APIFootballTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    address: string;
    city: string;
    capacity: number;
    surface: string;
    image: string;
  };
}

interface APIFootballPlayer {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  birth: {
    date: string;
    place: string;
    country: string;
  };
  nationality: string;
  height: string;
  weight: string;
  injured: boolean;
  photo: string;
}

interface APIFootballSquadPlayer {
  id: number;
  name: string;
  age: number;
  number: number;
  position: string;
  photo: string;
}

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

interface APIFootballEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

interface APIFootballStanding {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  update: string;
}

async function makeAPICall(endpoint: string, retries = 3): Promise<any> {
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY not found in environment variables");
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
        headers: {
          "x-rapidapi-key": apiKey
        }
      });

      if (response.status === 429) {
        console.log(`Rate limited, waiting ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API call attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function importCountries() {
  console.log("🌍 Importing countries...");
  
  try {
    const data = await makeAPICall("/countries");
    if (!data.response || data.response.length === 0) {
      console.log("No countries data available");
      return;
    }

    for (const country of data.response) {
      const { error } = await supabase
        .from("countries")
        .upsert({
          name: country.name,
          code: country.code,
          flag: country.flag
        });

      if (error && error.code !== '23505') {
        console.error(`Error inserting country ${country.name}:`, error);
      }
    }

    console.log(`✅ Imported ${data.response.length} countries`);
  } catch (error) {
    console.error("❌ Error importing countries:", error);
  }
}

async function importLeagues(seasonYear: number) {
  console.log(`🏆 Importing leagues for season ${seasonYear}...`);
  
  try {
    // Import Korean leagues (K-League 1 and K-League 2)
    const koreanLeagues = [292, 293];
    
    for (const leagueId of koreanLeagues) {
      const data = await makeAPICall(`/leagues?id=${leagueId}&season=${seasonYear}`);
      
      if (!data.response || data.response.length === 0) {
        console.log(`No data for league ${leagueId}`);
        continue;
      }

      const leagueData = data.response[0] as APIFootballLeague;
      const currentSeason = leagueData.seasons.find(s => s.year === seasonYear);

      // Insert country first
      const { data: countryData } = await supabase
        .from("countries")
        .upsert({
          name: leagueData.country.name,
          code: leagueData.country.code,
          flag: leagueData.country.flag
        })
        .select("id")
        .single();

      // Insert league
      const { error } = await supabase
        .from("leagues")
        .upsert({
          id: leagueData.league.id,
          name: leagueData.league.name,
          type: leagueData.league.type,
          logo_url: leagueData.league.logo,
          country_id: countryData?.id,
          country_name: leagueData.country.name,
          country_code: leagueData.country.code,
          country_flag: leagueData.country.flag,
          season_year: seasonYear,
          season_start: currentSeason ? new Date(currentSeason.start) : null,
          season_end: currentSeason ? new Date(currentSeason.end) : null,
          current: currentSeason?.current || false
        });

      if (error && error.code !== '23505') {
        console.error(`Error inserting league ${leagueId}:`, error);
      } else {
        console.log(`✅ Imported league: ${leagueData.league.name}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("❌ Error importing leagues:", error);
  }
}

async function importTeams(seasonYear: number) {
  console.log(`⚽ Importing teams for season ${seasonYear}...`);
  
  try {
    const koreanLeagues = [292, 293];
    
    for (const leagueId of koreanLeagues) {
      console.log(`  → Processing league ${leagueId}`);
      
      const data = await makeAPICall(`/teams?league=${leagueId}&season=${seasonYear}`);
      
      if (!data.response || data.response.length === 0) {
        console.log(`  📭 No teams for league ${leagueId}`);
        continue;
      }

      for (const teamData of data.response as APIFootballTeam[]) {
        // Insert venue first
        let venueId = null;
        if (teamData.venue.id) {
          const { data: venueResult, error: venueError } = await supabase
            .from("venues")
            .upsert({
              id: teamData.venue.id,
              name: teamData.venue.name,
              address: teamData.venue.address,
              city: teamData.venue.city,
              capacity: teamData.venue.capacity,
              surface: teamData.venue.surface,
              image: teamData.venue.image
            }, { onConflict: "id" })
            .select("id")
            .single();

          if (!venueError) {
            venueId = venueResult.id;
          }
        }

        // Insert team
        const { error } = await supabase
          .from("teams")
          .upsert({
            id: teamData.team.id,
            name: teamData.team.name,
            code: teamData.team.code,
            logo_url: teamData.team.logo,
            country_name: teamData.team.country,
            founded: teamData.team.founded,
            national: teamData.team.national,
            league_id: leagueId,
            season_year: seasonYear,
            venue_id: venueId,
            venue_name: teamData.venue.name,
            venue_address: teamData.venue.address,
            venue_city: teamData.venue.city,
            venue_capacity: teamData.venue.capacity,
            venue_surface: teamData.venue.surface,
            venue_image: teamData.venue.image
          });

        if (error && error.code !== '23505') {
          console.error(`Error inserting team ${teamData.team.name}:`, error);
        }
      }

      console.log(`✅ Imported ${data.response.length} teams for league ${leagueId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("❌ Error importing teams:", error);
  }
}

async function importPlayers(seasonYear: number) {
  console.log(`👥 Importing players for season ${seasonYear}...`);
  
  try {
    // Get all teams first
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("season_year", seasonYear);

    if (teamsError || !teams) {
      console.error("Error fetching teams:", teamsError);
      return;
    }

    for (const team of teams) {
      console.log(`  → Processing players for ${team.name} (${team.id})`);
      
      try {
        // Get squad data (includes jersey numbers and positions)
        const squadData = await makeAPICall(`/players/squads?team=${team.id}`);
        
        if (squadData.response && squadData.response.length > 0 && squadData.response[0].players) {
          for (const squadPlayer of squadData.response[0].players) {
            // Skip players without valid ID
            if (!squadPlayer.id || !squadPlayer.name) {
              console.log(`    ⚠️ Skipping invalid player data for ${team.name}`);
              continue;
            }
            // Insert player basic info
            const { error: playerError } = await supabase
              .from("players")
              .upsert({
                id: squadPlayer.id,
                name: squadPlayer.name,
                age: squadPlayer.age,
                photo: squadPlayer.photo,
                jersey_number: squadPlayer.number,
                position: squadPlayer.position,
                team_id: team.id,
                season_year: seasonYear
              });

            if (playerError && playerError.code !== '23505') {
              console.error(`Error inserting player ${squadPlayer.name}:`, playerError);
            }

            // Insert squad relationship
            const { error: squadError } = await supabase
              .from("squads")
              .upsert({
                team_id: team.id,
                player_id: squadPlayer.id,
                season_year: seasonYear,
                position: squadPlayer.position,
                jersey_number: squadPlayer.number
              });

            if (squadError && squadError.code !== '23505') {
              console.error(`Error inserting squad relationship for ${squadPlayer.name}:`, squadError);
            }
          }
          
          console.log(`    ✅ Imported ${squadData.response[0].players.length} players for ${team.name}`);
        } else {
          console.log(`    📭 No squad data for ${team.name}`);
        }

        // Get detailed player statistics
        try {
          const playersData = await makeAPICall(`/players?team=${team.id}&season=${seasonYear}`);
          
          if (playersData.response && playersData.response.length > 0) {
            for (const playerData of playersData.response) {
              const player = playerData.player as APIFootballPlayer;
              const statistics = playerData.statistics?.[0];
              
              // Skip players without valid ID
              if (!player.id || !player.name) {
                console.log(`    ⚠️ Skipping invalid detailed player data for ${team.name}`);
                continue;
              }

              // Update player with detailed info
              const { error: updateError } = await supabase
                .from("players")
                .upsert({
                  id: player.id,
                  name: player.name,
                  firstname: player.firstname,
                  lastname: player.lastname,
                  age: player.age,
                  birth_date: player.birth?.date ? new Date(player.birth.date) : null,
                  birth_place: player.birth?.place,
                  birth_country: player.birth?.country,
                  nationality: player.nationality,
                  height: player.height,
                  weight: player.weight,
                  injured: player.injured,
                  photo: player.photo,
                  team_id: team.id,
                  season_year: seasonYear
                });

              if (updateError && updateError.code !== '23505') {
                console.error(`Error updating player ${player.name}:`, updateError);
              }

              // Insert player statistics if available
              if (statistics) {
                const { error: statsError } = await supabase
                  .from("player_statistics")
                  .upsert({
                    player_id: player.id,
                    team_id: team.id,
                    league_id: statistics.league?.id,
                    season_year: seasonYear,
                    position: statistics.games?.position,
                    appearances: statistics.games?.appearences || 0,
                    lineups: statistics.games?.lineups || 0,
                    minutes: statistics.games?.minutes || 0,
                    rating: statistics.games?.rating ? parseFloat(statistics.games.rating) : null,
                    captain: statistics.games?.captain || false,
                    substitute_in: statistics.substitutes?.in || 0,
                    substitute_out: statistics.substitutes?.out || 0,
                    substitute_bench: statistics.substitutes?.bench || 0,
                    shots_total: statistics.shots?.total || 0,
                    shots_on: statistics.shots?.on || 0,
                    goals_total: statistics.goals?.total || 0,
                    goals_conceded: statistics.goals?.conceded || 0,
                    goals_assists: statistics.goals?.assists || 0,
                    goals_saves: statistics.goals?.saves || 0,
                    passes_total: statistics.passes?.total || 0,
                    passes_key: statistics.passes?.key || 0,
                    passes_accuracy: statistics.passes?.accuracy ? parseFloat(statistics.passes.accuracy) : null,
                    tackles_total: statistics.tackles?.total || 0,
                    tackles_blocks: statistics.tackles?.blocks || 0,
                    tackles_interceptions: statistics.tackles?.interceptions || 0,
                    duels_total: statistics.duels?.total || 0,
                    duels_won: statistics.duels?.won || 0,
                    dribbles_attempts: statistics.dribbles?.attempts || 0,
                    dribbles_success: statistics.dribbles?.success || 0,
                    dribbles_past: statistics.dribbles?.past || 0,
                    fouls_drawn: statistics.fouls?.drawn || 0,
                    fouls_committed: statistics.fouls?.committed || 0,
                    cards_yellow: statistics.cards?.yellow || 0,
                    cards_yellowred: statistics.cards?.yellowred || 0,
                    cards_red: statistics.cards?.red || 0,
                    penalty_won: statistics.penalty?.won || 0,
                    penalty_committed: statistics.penalty?.commited || 0,
                    penalty_scored: statistics.penalty?.scored || 0,
                    penalty_missed: statistics.penalty?.missed || 0,
                    penalty_saved: statistics.penalty?.saved || 0
                  });

                if (statsError && statsError.code !== '23505') {
                  console.error(`Error inserting statistics for ${player.name}:`, statsError);
                }
              }
            }
          }
        } catch (detailError) {
          console.log(`    ⚠️ Could not get detailed stats for ${team.name}:`, detailError);
        }

      } catch (error) {
        console.error(`Error processing team ${team.name}:`, error);
      }

      // Rate limiting between teams
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error("❌ Error importing players:", error);
  }
}

async function importFixtures(seasonYear: number) {
  console.log(`📅 Importing fixtures for season ${seasonYear}...`);
  
  try {
    const koreanLeagues = [292, 293];
    
    for (const leagueId of koreanLeagues) {
      console.log(`  → Processing fixtures for league ${leagueId}`);
      
      const data = await makeAPICall(`/fixtures?league=${leagueId}&season=${seasonYear}`);
      
      if (!data.response || data.response.length === 0) {
        console.log(`  📭 No fixtures for league ${leagueId}`);
        continue;
      }

      for (const fixture of data.response as APIFootballFixture[]) {
        const { error } = await supabase
          .from("fixtures")
          .upsert({
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
            league_id: leagueId,
            home_team_id: fixture.teams.home.id,
            away_team_id: fixture.teams.away.id,
            home_goals: fixture.goals.home,
            away_goals: fixture.goals.away,
            venue_id: fixture.fixture.venue.id
          });

        if (error && error.code !== '23505') {
          console.error(`Error inserting fixture ${fixture.fixture.id}:`, error);
        }
      }

      console.log(`✅ Imported ${data.response.length} fixtures for league ${leagueId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("❌ Error importing fixtures:", error);
  }
}

async function importEvents(seasonYear: number) {
  console.log(`⚡ Importing events for season ${seasonYear}...`);
  
  try {
    // Get finished fixtures
    const { data: fixtures, error: fixturesError } = await supabase
      .from("fixtures")
      .select("id, home_team_id, away_team_id")
      .eq("season_year", seasonYear)
      .eq("status_short", "FT")
      .limit(50); // Limit to avoid rate limits

    if (fixturesError || !fixtures || fixtures.length === 0) {
      console.log("No finished fixtures found");
      return;
    }

    for (const fixture of fixtures) {
      console.log(`  → Processing events for fixture ${fixture.id}`);
      
      try {
        const data = await makeAPICall(`/fixtures/events?fixture=${fixture.id}`);
        
        if (data.response && data.response.length > 0) {
          for (const event of data.response as APIFootballEvent[]) {
            const { error } = await supabase
              .from("events")
              .upsert({
                fixture_id: fixture.id,
                team_id: event.team.id,
                player_id: event.player?.id,
                assist_player_id: event.assist?.id,
                time_elapsed: event.time.elapsed,
                time_extra: event.time.extra,
                type: event.type,
                detail: event.detail,
                comments: event.comments
              }, { onConflict: "fixture_id,team_id,player_id,time_elapsed,type" });

            if (error && error.code !== '23505') {
              console.error(`Error inserting event:`, error);
            }
          }
          
          console.log(`    ✅ Imported ${data.response.length} events`);
        }
      } catch (error) {
        console.log(`    ⚠️ Could not get events for fixture ${fixture.id}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("❌ Error importing events:", error);
  }
}

async function importStandings(seasonYear: number) {
  console.log(`📊 Importing standings for season ${seasonYear}...`);
  
  try {
    const koreanLeagues = [292, 293];
    
    for (const leagueId of koreanLeagues) {
      console.log(`  → Processing standings for league ${leagueId}`);
      
      const data = await makeAPICall(`/standings?league=${leagueId}&season=${seasonYear}`);
      
      if (!data.response || data.response.length === 0) {
        console.log(`  📭 No standings for league ${leagueId}`);
        continue;
      }

      const standings = data.response[0].league.standings[0] as APIFootballStanding[];
      console.log(`  🔍 Found ${standings.length} teams in standings`);
      
      for (const standing of standings) {
        const { error } = await supabase
          .from("standings")
          .upsert({
            league_id: leagueId,
            season_year: seasonYear,
            team_id: standing.team.id,
            rank_position: standing.rank,
            points: standing.points,
            goals_diff: standing.goalsDiff, // Fixed: goalsDiff → goals_diff
            group_name: standing.group,
            form: standing.form,
            status: standing.status,
            description: standing.description,
            all_played: standing.all.played,
            all_win: standing.all.win,
            all_draw: standing.all.draw,
            all_lose: standing.all.lose,
            all_goals_for: standing.all.goals.for,
            all_goals_against: standing.all.goals.against,
            home_played: standing.home.played,
            home_win: standing.home.win,
            home_draw: standing.home.draw,
            home_lose: standing.home.lose,
            home_goals_for: standing.home.goals.for,
            home_goals_against: standing.home.goals.against,
            away_played: standing.away.played,
            away_win: standing.away.win,
            away_draw: standing.away.draw,
            away_lose: standing.away.lose,
            away_goals_for: standing.away.goals.for,
            away_goals_against: standing.away.goals.against
          });

        // Show ALL errors, don't hide them
        if (error) {
          console.error(`❌ Error inserting standing for ${standing.team.name}:`, error);
        } else {
          console.log(`  ✅ ${standing.rank}. ${standing.team.name} (${standing.points}pts)`);
        }
      }

      console.log(`✅ Imported standings for ${standings.length} teams in league ${leagueId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("❌ Error importing standings:", error);
  }
}

async function masterImport() {
  const seasonYear = Number(process.env.SEASON_YEAR) || 2025;
  
  console.log("🚀 Starting comprehensive API-Football import...");
  console.log(`Season: ${seasonYear}`);
  console.log(`API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log("==========================================\n");

  if (!apiKey) {
    console.error("❌ API_FOOTBALL_KEY not found in environment variables");
    return;
  }

  try {
    // Import in proper order due to foreign key constraints
    await importCountries();
    await importLeagues(seasonYear);
    await importTeams(seasonYear);
    await importPlayers(seasonYear);
    await importFixtures(seasonYear);
    await importEvents(seasonYear);
    await importStandings(seasonYear);

    console.log("\n==========================================");
    console.log("🎉 Master import completed successfully!");
    console.log("All API-Football data has been imported to the database.");
    
    // Print summary
    const tables = ['countries', 'leagues', 'teams', 'players', 'fixtures', 'events', 'standings'];
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        console.log(`📊 ${table}: ${count} records`);
      } catch (error) {
        console.log(`📊 ${table}: count unavailable`);
      }
    }

  } catch (error) {
    console.error("💥 Master import failed:", error);
    process.exit(1);
  }
}

// Run the master import
masterImport().catch(console.error);