import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDuplicateEvents() {
  console.log("🚨 CRITICAL: Starting duplicate events cleanup...");

  // 1. Get current count
  const { count: originalCount, error: countError } = await supabase
    .from("events")
    .select("*", { count: 'exact', head: true });

  if (countError) {
    console.error("❌ Error getting count:", countError);
    return;
  }

  console.log(`📊 Original events count: ${originalCount}`);

  // 2. Find and delete duplicates using SQL
  console.log("🔍 Identifying duplicates...");

  // Use a more direct approach - delete duplicates keeping only the one with the smallest ID
  const { data: duplicateAnalysis, error: duplicateError } = await supabase
    .rpc('sql', {
      query: `
        WITH duplicates AS (
          SELECT id, 
                 ROW_NUMBER() OVER (
                   PARTITION BY fixture_id, team_id, player_id, 
                               COALESCE(assist_player_id, 0), elapsed_minutes, 
                               COALESCE(extra_minutes, 0), event_type, 
                               COALESCE(event_detail, '')
                   ORDER BY id
                 ) as rn
          FROM events
        )
        SELECT COUNT(*) as duplicate_count
        FROM duplicates 
        WHERE rn > 1;
      `
    });

  if (duplicateError) {
    console.log("❌ SQL approach failed, using manual method...");
    
    // Fallback: Manual duplicate removal
    const { data: allEvents, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .order("id");

    if (fetchError || !allEvents) {
      console.error("❌ Error fetching events:", fetchError);
      return;
    }

    console.log(`📋 Processing ${allEvents.length} events...`);

    // Find duplicates manually
    const seen = new Set<string>();
    const duplicateIds: number[] = [];

    allEvents.forEach(event => {
      const key = `${event.fixture_id}-${event.team_id}-${event.player_id}-${event.assist_player_id || 'null'}-${event.elapsed_minutes}-${event.extra_minutes || 'null'}-${event.event_type}-${event.event_detail || 'null'}`;
      
      if (seen.has(key)) {
        duplicateIds.push(event.id);
      } else {
        seen.add(key);
      }
    });

    console.log(`🗑️ Found ${duplicateIds.length} duplicates to delete`);

    if (duplicateIds.length === 0) {
      console.log("✅ No duplicates found!");
      return;
    }

    // Delete duplicates in batches
    const batchSize = 50;
    let deleted = 0;

    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = duplicateIds.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error(`❌ Error deleting batch:`, deleteError);
        break;
      }

      deleted += batch.length;
      console.log(`✅ Deleted ${deleted}/${duplicateIds.length} duplicates`);
    }

    // Verify final count
    const { count: finalCount } = await supabase
      .from("events")
      .select("*", { count: 'exact', head: true });

    console.log(`📊 Final count: ${finalCount}`);
    console.log(`🎯 Deleted: ${(originalCount || 0) - (finalCount || 0)} events`);
    console.log("🎉 Cleanup completed!");
  }
}

// Run the cleanup
fixDuplicateEvents().catch(console.error);