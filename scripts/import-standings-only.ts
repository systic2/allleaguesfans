import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface APIFootballStanding {
  rank: number;
  team: {
    id: number;
    name: string;
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
    goals: { for: number; against: number };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

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

async function importStandingsOnly() {
  const seasonYear = Number(process.env.SEASON_YEAR) || 2025;
  
  console.log("📊 Importing ONLY standings data...");
  console.log(`Season: ${seasonYear}`);
  console.log(`API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log("==========================================\n");

  if (!apiKey) {
    console.error("❌ API_FOOTBALL_KEY not found");
    return;
  }

  try {
    const koreanLeagues = [292, 293];
    
    for (const leagueId of koreanLeagues) {
      console.log(`📈 Processing standings for league ${leagueId}`);
      
      const data = await makeAPICall(`/standings?league=${leagueId}&season=${seasonYear}`);
      
      if (!data.response || data.response.length === 0) {
        console.log(`📭 No standings for league ${leagueId}`);
        continue;
      }

      const standings = data.response[0].league.standings[0] as APIFootballStanding[];
      console.log(`🔍 Found ${standings.length} teams in standings`);
      
      for (const standing of standings) {
        const { error } = await supabase
          .from("standings")
          .upsert({
            league_id: leagueId,
            season_year: seasonYear,
            team_id: standing.team.id,
            rank_position: standing.rank,
            points: standing.points,
            goalsDiff: standing.goalsDiff,
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

        if (error) {
          console.error(`❌ Error inserting standing for ${standing.team.name}:`, error);
        } else {
          console.log(`  ✅ ${standing.rank}. ${standing.team.name} (${standing.points}pts)`);
        }
      }

      console.log(`✅ Imported standings for ${standings.length} teams in league ${leagueId}\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Verify results
    const { count } = await supabase.from('standings').select('*', { count: 'exact', head: true });
    console.log(`\n🎉 Import completed! Total standings records: ${count}`);
    
  } catch (error) {
    console.error("💥 Import failed:", error);
  }
}

importStandingsOnly().catch(console.error);