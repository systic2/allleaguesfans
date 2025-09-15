import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEventsSchema() {
  console.log("🔍 Checking events table schema...\n");

  // Get a sample event to see the available columns
  const { data: sampleEvents, error } = await supabase
    .from("events")
    .select("*")
    .limit(3);

  if (error) {
    console.error("❌ Error fetching sample events:", error);
    return;
  }

  if (sampleEvents && sampleEvents.length > 0) {
    console.log("📋 Available columns in events table:");
    const columns = Object.keys(sampleEvents[0]);
    columns.forEach(col => console.log(`  - ${col}`));

    console.log("\n📊 Sample events:");
    sampleEvents.forEach((event, index) => {
      console.log(`\nEvent ${index + 1}:`);
      Object.entries(event).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
  }

  // Also check goal events specifically
  const { data: goalEvents, error: goalError } = await supabase
    .from("events")
    .select("*")
    .eq("event_type", "Goal")
    .limit(2);

  if (goalError) {
    console.error("❌ Error fetching goal events:", goalError);
    return;
  }

  if (goalEvents && goalEvents.length > 0) {
    console.log("\n🥅 Sample goal events:");
    goalEvents.forEach((event, index) => {
      console.log(`\nGoal Event ${index + 1}:`);
      Object.entries(event).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
  }
}

checkEventsSchema().catch(console.error);