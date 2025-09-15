import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayersColumns() {
  console.log("🔍 Checking players table structure...\n");

  // Get a sample player to see available columns
  const { data: sample, error } = await supabase
    .from("players")
    .select("*")
    .limit(1);
  
  if (error) {
    console.error("Error:", error);
  } else if (sample && sample.length > 0) {
    console.log("Available columns in players table:");
    console.log(Object.keys(sample[0]));
    console.log("\nSample player data:");
    console.log(sample[0]);
  } else {
    console.log("No players found in the table");
  }
}

checkPlayersColumns().catch(console.error);