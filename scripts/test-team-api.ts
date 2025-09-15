import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTeamAPI() {
  console.log("🔍 Testing team API functions...\n");

  // Test fetchTeamDetails query structure
  console.log("1. Testing team details query:");
  const { data: teamDetail, error: teamError } = await supabase
    .from("teams")
    .select(`
      id, name, code, country_name, founded, logo_url,
      venues (name, capacity, city)
    `)
    .eq("id", 2762)
    .maybeSingle();
  
  if (teamError) {
    console.error("Team detail error:", teamError);
    
    // Try without venues join
    console.log("\n1b. Testing team details without venues:");
    const { data: teamDetailNoVenues, error: teamErrorNoVenues } = await supabase
      .from("teams")
      .select(`
        id, name, code, country_name, founded, logo_url
      `)
      .eq("id", 2762)
      .maybeSingle();
    
    if (teamErrorNoVenues) {
      console.error("Team detail error (no venues):", teamErrorNoVenues);
    } else {
      console.log("Team detail data (no venues):", teamDetailNoVenues);
    }
  } else {
    console.log("Team detail data:", teamDetail);
  }

  // Test fetchPlayersByTeam query
  console.log("\n2. Testing players by team query:");
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, position, photo_url, team_id")
    .eq("team_id", 2762)
    .limit(5);
  
  if (playersError) {
    console.error("Players error:", playersError);
  } else {
    console.log("Players data:", players);
  }

  // Check if venues table exists
  console.log("\n3. Testing venues table:");
  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id, name, capacity, city")
    .limit(1);
  
  if (venuesError) {
    console.error("Venues error:", venuesError);
  } else {
    console.log("Venues data (sample):", venues);
  }
}

testTeamAPI().catch(console.error);