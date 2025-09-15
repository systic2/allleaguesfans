import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabase() {
  console.log("🔍 Debugging database structure and data...\n");

  // 1. Check teams table
  console.log("1. Checking teams table:");
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, code, logo_url")
    .limit(5);
  
  if (teamsError) {
    console.error("Teams error:", teamsError);
  } else {
    console.log("Teams data:", teams);
  }

  // 2. Check standings table
  console.log("\n2. Checking standings table:");
  const { data: standings, error: standingsError } = await supabase
    .from("standings")
    .select("team_id, rank, points, league_id, season_year")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .limit(5);
  
  if (standingsError) {
    console.error("Standings error:", standingsError);
  } else {
    console.log("Standings data:", standings);
  }

  // 3. Check the problematic join
  console.log("\n3. Testing standings join with teams:");
  const { data: standingsJoin, error: joinError } = await supabase
    .from("standings")
    .select(`
      team_id,
      rank,
      points,
      teams!inner(name, code, logo_url)
    `)
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .limit(3);
  
  if (joinError) {
    console.error("Join error:", joinError);
  } else {
    console.log("Join data:", JSON.stringify(standingsJoin, null, 2));
  }

  // 4. Check team detail query
  console.log("\n4. Testing team detail query:");
  const { data: teamDetail, error: teamError } = await supabase
    .from("teams")
    .select(`
      id, name, code, country_name, founded, logo_url
    `)
    .eq("id", 2762)
    .maybeSingle();
  
  if (teamError) {
    console.error("Team detail error:", teamError);
  } else {
    console.log("Team detail data:", teamDetail);
  }
}

debugDatabase().catch(console.error);