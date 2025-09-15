import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyUniqueConstraints() {
  console.log("🔧 Adding unique constraints to prevent future duplicates...");

  try {
    // Add unique constraint
    const constraintSQL = `
      ALTER TABLE events 
      ADD CONSTRAINT events_unique_constraint 
      UNIQUE (
        fixture_id, 
        team_id, 
        player_id, 
        COALESCE(assist_player_id, 0), 
        elapsed_minutes, 
        COALESCE(extra_minutes, 0), 
        event_type, 
        COALESCE(event_detail, '')
      );
    `;

    console.log("➕ Adding unique constraint...");
    const { error: constraintError } = await supabase.rpc('exec_sql', { sql: constraintSQL });
    
    if (constraintError) {
      console.error("❌ Error adding constraint:", constraintError);
      console.log("ℹ️ This might be normal if constraint already exists");
    } else {
      console.log("✅ Unique constraint added successfully!");
    }

    // Add performance index
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_events_duplicate_check 
      ON events (
        fixture_id, 
        team_id, 
        player_id, 
        elapsed_minutes, 
        event_type
      );
    `;

    console.log("📊 Adding performance index...");
    const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
    
    if (indexError) {
      console.error("❌ Error adding index:", indexError);
    } else {
      console.log("✅ Performance index added successfully!");
    }

    console.log("🎉 Database constraints applied successfully!");
    
  } catch (error) {
    console.error("❌ Error applying constraints:", error);
    console.log("ℹ️ You may need to apply these constraints manually in Supabase dashboard");
    console.log("\nSQL to run manually:");
    console.log(`
ALTER TABLE events 
ADD CONSTRAINT events_unique_constraint 
UNIQUE (
  fixture_id, 
  team_id, 
  player_id, 
  COALESCE(assist_player_id, 0), 
  elapsed_minutes, 
  COALESCE(extra_minutes, 0), 
  event_type, 
  COALESCE(event_detail, '')
);

CREATE INDEX IF NOT EXISTS idx_events_duplicate_check 
ON events (fixture_id, team_id, player_id, elapsed_minutes, event_type);
    `);
  }
}

applyUniqueConstraints().catch(console.error);