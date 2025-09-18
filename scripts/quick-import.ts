import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeAPICall(endpoint: string): Promise<any> {
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY not found in environment variables");
  }

  const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
    headers: {
      "x-rapidapi-key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function quickImport() {
  const seasonYear = Number(process.env.SEASON_YEAR) || 2025;
  
  console.log("🚀 Quick Import - Korean Leagues Only");
  console.log(`Season: ${seasonYear}`);
  console.log(`API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log("==========================================\n");

  if (!apiKey) {
    console.error("❌ API_FOOTBALL_KEY not found");
    return;
  }

  try {
    // 1. Import Leagues
    console.log("🏆 Importing Korean leagues...");
    for (const leagueId of [292, 293]) {
      const data = await makeAPICall(`/leagues?id=${leagueId}&season=${seasonYear}`);
      
      if (data.response?.[0]) {
        const league = data.response[0];
        const currentSeason = league.seasons.find((s: any) => s.year === seasonYear);
        
        await supabase.from("leagues").upsert({
          id: league.league.id,
          name: league.league.name,
          type: league.league.type,
          logo_url: league.league.logo,
          country_name: league.country.name,
          season_year: seasonYear,
          season_start: currentSeason ? new Date(currentSeason.start) : null,
          season_end: currentSeason ? new Date(currentSeason.end) : null,
          current: currentSeason?.current || false
        });
        
        console.log(`  ✅ ${league.league.name}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 2. Import Teams
    console.log("\n⚽ Importing teams...");
    for (const leagueId of [292, 293]) {
      const data = await makeAPICall(`/teams?league=${leagueId}&season=${seasonYear}`);
      
      if (data.response) {
        for (const teamData of data.response) {
          await supabase.from("teams").upsert({
            id: teamData.team.id,
            name: teamData.team.name,
            code: teamData.team.code,
            logo_url: teamData.team.logo,
            country_name: teamData.team.country,
            founded: teamData.team.founded,
            league_id: leagueId,
            season_year: seasonYear,
            venue_name: teamData.venue.name,
            venue_city: teamData.venue.city,
            venue_capacity: teamData.venue.capacity
          });
        }
        console.log(`  ✅ League ${leagueId}: ${data.response.length} teams`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Import Players (Squad data only for jersey numbers)
    console.log("\n👥 Importing players...");
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .eq("season_year", seasonYear);

    if (teams) {
      for (const team of teams.slice(0, 5)) { // Limit to first 5 teams for quick import
        try {
          console.log(`  → ${team.name} (${team.id})`);
          
          const squadData = await makeAPICall(`/players/squads?team=${team.id}`);
          
          if (squadData.response && squadData.response.length > 0) {
            let imported = 0;
            for (const player of squadData.response) {
              if (player.id && player.name) {
                await supabase.from("players").upsert({
                  id: player.id,
                  name: player.name,
                  age: player.age,
                  photo: player.photo,
                  jersey_number: player.number,
                  position: player.position,
                  team_id: team.id,
                  season_year: seasonYear
                });
                imported++;
              }
            }
            console.log(`    ✅ ${imported} players imported`);
          } else {
            console.log(`    📭 No squad data available`);
          }
          
        } catch (error) {
          console.log(`    ⚠️ Error: ${error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 4. Import Recent Fixtures
    console.log("\n📅 Importing recent fixtures...");
    for (const leagueId of [292, 293]) {
      const data = await makeAPICall(`/fixtures?league=${leagueId}&season=${seasonYear}&last=10`);
      
      if (data.response) {
        for (const fixture of data.response) {
          await supabase.from("fixtures").upsert({
            id: fixture.fixture.id,
            date_utc: new Date(fixture.fixture.date),
            status_short: fixture.fixture.status.short,
            round: fixture.league.round,
            season_year: seasonYear,
            league_id: leagueId,
            home_team_id: fixture.teams.home.id,
            away_team_id: fixture.teams.away.id,
            home_goals: fixture.goals.home,
            away_goals: fixture.goals.away
          });
        }
        console.log(`  ✅ League ${leagueId}: ${data.response.length} fixtures`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("\n🎉 Quick import completed successfully!");
    
    // Print summary
    const summary = await Promise.all([
      supabase.from('leagues').select('*', { count: 'exact', head: true }),
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('fixtures').select('*', { count: 'exact', head: true })
    ]);

    console.log("📊 Database Summary:");
    console.log(`  Leagues: ${summary[0].count}`);
    console.log(`  Teams: ${summary[1].count}`);
    console.log(`  Players: ${summary[2].count}`);
    console.log(`  Fixtures: ${summary[3].count}`);

  } catch (error) {
    console.error("💥 Import failed:", error);
  }
}

quickImport().catch(console.error);