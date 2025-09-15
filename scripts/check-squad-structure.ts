import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSquadStructure() {
  console.log("🔍 Checking squad/team relationship tables...\n");

  // Check squad_memberships table
  console.log("1. Checking squad_memberships table:");
  const { data: squad, error: squadError } = await supabase
    .from("squad_memberships")
    .select("*")
    .eq("team_id", 2762)
    .limit(3);
  
  if (squadError) {
    console.error("Squad memberships error:", squadError);
  } else {
    console.log("Squad memberships data:");
    if (squad && squad.length > 0) {
      console.log("Columns:", Object.keys(squad[0]));
      console.log("Sample:", squad);
    } else {
      console.log("No squad memberships found");
    }
  }

  // Check if there's a team_players table
  console.log("\n2. Checking team_players table:");
  const { data: teamPlayers, error: teamPlayersError } = await supabase
    .from("team_players")
    .select("*")
    .limit(1);
  
  if (teamPlayersError) {
    console.error("Team players error:", teamPlayersError);
  } else {
    console.log("Team players data:");
    if (teamPlayers && teamPlayers.length > 0) {
      console.log("Columns:", Object.keys(teamPlayers[0]));
      console.log("Sample:", teamPlayers);
    } else {
      console.log("No team players found");
    }
  }

  // Try to find players by joining with squad_memberships
  console.log("\n3. Testing join query:");
  const { data: playersWithPosition, error: joinError } = await supabase
    .from("squad_memberships")
    .select(`
      player_id,
      position,
      players (id, name, photo_url)
    `)
    .eq("team_id", 2762)
    .limit(5);
  
  if (joinError) {
    console.error("Join error:", joinError);
  } else {
    console.log("Players with position:", playersWithPosition);
  }
}

checkSquadStructure().catch(console.error);