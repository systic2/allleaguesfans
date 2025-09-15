import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

interface EventRow {
  id: number;
  fixture_id: number;
  team_id: number;
  player_id: number;
  assist_player_id: number | null;
  elapsed_minutes: number;
  extra_minutes: number | null;
  event_type: string;
  event_detail: string | null;
  created_at: string;
}

async function cleanDuplicateEvents() {
  console.log("🚨 CRITICAL: Starting duplicate events cleanup...\n");

  // 1. Backup original data count
  const { count: originalCount, error: countError } = await supabase
    .from("events")
    .select("*", { count: 'exact', head: true });

  if (countError) {
    console.error("❌ Error getting original count:", countError);
    return;
  }

  console.log(`📊 Original events count: ${originalCount}`);

  // 2. Get all events with their details
  const { data: allEvents, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .order("id");

  if (fetchError) {
    console.error("❌ Error fetching events:", fetchError);
    return;
  }

  if (!allEvents) {
    console.log("❌ No events found");
    return;
  }

  console.log(`📋 Fetched ${allEvents.length} events for analysis`);

  // 3. Identify duplicates and keep only the earliest (lowest ID)
  console.log("\n🔍 Identifying duplicates...");
  
  const uniqueEvents = new Map<string, EventRow>();
  const duplicatesToDelete: number[] = [];

  allEvents.forEach((event: EventRow) => {
    // Create a unique key for each event (excluding ID and created_at)
    const uniqueKey = `${event.fixture_id}-${event.team_id}-${event.player_id}-${event.assist_player_id || 'null'}-${event.elapsed_minutes}-${event.extra_minutes || 'null'}-${event.event_type}-${event.event_detail || 'null'}`;
    
    if (uniqueEvents.has(uniqueKey)) {
      // This is a duplicate - mark the current one for deletion (keep the one with lower ID)
      const existing = uniqueEvents.get(uniqueKey)!;
      if (event.id > existing.id) {
        // Current event has higher ID, so it's the duplicate
        duplicatesToDelete.push(event.id);
      } else {
        // Current event has lower ID, so the existing one is the duplicate
        duplicatesToDelete.push(existing.id);
        uniqueEvents.set(uniqueKey, event);
      }
    } else {
      uniqueEvents.set(uniqueKey, event);
    }
  });

  console.log(`📊 Unique events: ${uniqueEvents.size}`);
  console.log(`🗑️ Duplicates to delete: ${duplicatesToDelete.length}`);
  console.log(`✅ Expected final count: ${uniqueEvents.size}`);

  if (duplicatesToDelete.length === 0) {
    console.log("✅ No duplicates found! Data is clean.");
    return;
  }

  // 4. Show some examples of what will be deleted
  console.log("\n📋 Sample duplicates to be deleted:");
  const sampleDuplicates = allEvents.filter(e => duplicatesToDelete.slice(0, 5).includes(e.id));
  sampleDuplicates.forEach(event => {
    console.log(`  ID ${event.id}: Fixture ${event.fixture_id}, Player ${event.player_id}, ${event.elapsed_minutes}', ${event.event_type}`);
  });

  // 5. Analyze impact on top scorers
  console.log("\n🏆 Impact analysis on top scorers:");
  
  const goalEvents = allEvents.filter(e => e.event_type === 'Goal');
  const goalDuplicates = duplicatesToDelete.filter(id => 
    goalEvents.some(e => e.id === id)
  );

  console.log(`🥅 Total goal events: ${goalEvents.length}`);
  console.log(`🗑️ Goal duplicates to delete: ${goalDuplicates.length}`);
  console.log(`✅ Clean goal events after cleanup: ${goalEvents.length - goalDuplicates.length}`);

  // Show impact on key players
  const keyPlayers = [34708, 119025, 41455]; // Jeon Jin-Woo, Compagno, Sabbag
  
  for (const playerId of keyPlayers) {
    const playerGoals = goalEvents.filter(e => e.player_id === playerId);
    const playerDuplicates = goalDuplicates.filter(id => 
      playerGoals.some(e => e.id === id)
    );
    
    const { data: player } = await supabase
      .from("players")
      .select("name")
      .eq("id", playerId)
      .single();

    const playerName = player?.name || `Player ${playerId}`;
    console.log(`  ${playerName}: ${playerGoals.length} → ${playerGoals.length - playerDuplicates.length} goals (-${playerDuplicates.length})`);
  }

  // 6. Confirm before deletion
  console.log("\n⚠️ READY TO DELETE DUPLICATES");
  console.log(`This will delete ${duplicatesToDelete.length} duplicate events.`);
  console.log("Proceeding with deletion in 3 seconds...");

  await new Promise(resolve => setTimeout(resolve, 3000));

  // 7. Delete duplicates in batches
  console.log("\n🗑️ Deleting duplicate events...");
  
  const batchSize = 100;
  let deletedCount = 0;
  
  for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
    const batch = duplicatesToDelete.slice(i, i + batchSize);
    
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .in("id", batch);

    if (deleteError) {
      console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, deleteError);
      break;
    }

    deletedCount += batch.length;
    console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} events (Total: ${deletedCount}/${duplicatesToDelete.length})`);
  }

  // 8. Verify cleanup
  console.log("\n🔍 Verifying cleanup...");
  
  const { count: finalCount, error: finalCountError } = await supabase
    .from("events")
    .select("*", { count: 'exact', head: true });

  if (finalCountError) {
    console.error("❌ Error getting final count:", finalCountError);
    return;
  }

  console.log(`📊 Final events count: ${finalCount}`);
  console.log(`✅ Successfully deleted: ${(originalCount || 0) - (finalCount || 0)} events`);
  console.log(`🎯 Expected: ${duplicatesToDelete.length}, Actual: ${(originalCount || 0) - (finalCount || 0)}`);

  // 9. Verify top scorers after cleanup
  console.log("\n🏆 Verifying top scorers after cleanup...");
  
  const { data: cleanedGoals } = await supabase
    .from("events")
    .select(`
      player_id,
      fixtures!inner(league_id, season_year)
    `)
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal");

  if (cleanedGoals) {
    const scorerCounts = cleanedGoals.reduce((acc, goal) => {
      acc[goal.player_id] = (acc[goal.player_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const topScorers = Object.entries(scorerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const { data: playerNames } = await supabase
      .from("players")
      .select("id, name")
      .in("id", topScorers.map(([id]) => parseInt(id)));

    const nameMap = (playerNames || []).reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<number, string>);

    console.log("🎯 Top 5 scorers after cleanup:");
    topScorers.forEach(([playerId, goals], index) => {
      const name = nameMap[parseInt(playerId)] || `Player ${playerId}`;
      console.log(`  ${index + 1}. ${name}: ${goals} goals`);
    });
  }

  console.log("
🎉 DUPLICATE CLEANUP COMPLETED!");
}

// Run the cleanup
cleanDuplicateEvents().catch(console.error);