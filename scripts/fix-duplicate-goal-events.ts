import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDuplicateGoalEvents() {
  console.log("🔧 Fixing duplicate goal events...\n");

  // 1. Get all goal events for K-League 1 2025
  const { data: allGoals, error: fetchError } = await supabase
    .from("events")
    .select(`
      id,
      fixture_id,
      player_id,
      team_id,
      elapsed_minutes,
      extra_minutes,
      event_type,
      event_detail,
      created_at,
      fixtures!inner(
        league_id,
        season_year,
        date_utc
      )
    `)
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal");

  if (fetchError || !allGoals) {
    console.error("❌ Error fetching goals:", fetchError);
    return;
  }

  console.log(`📊 Total goal events found: ${allGoals.length}`);

  // 2. Remove Own Goals first (they should not count towards player stats)
  const ownGoals = allGoals.filter(goal => 
    goal.event_detail?.toLowerCase().includes("own") ||
    goal.event_detail?.toLowerCase().includes("자책")
  );

  if (ownGoals.length > 0) {
    console.log(`\n🚨 Removing ${ownGoals.length} Own Goals:`);
    
    for (const ownGoal of ownGoals) {
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", ownGoal.id);

      if (deleteError) {
        console.error(`❌ Failed to delete Own Goal ${ownGoal.id}:`, deleteError);
      } else {
        console.log(`  ✅ Deleted Own Goal: Player ${ownGoal.player_id} in fixture ${ownGoal.fixture_id}`);
      }
    }
  }

  // 3. Find legitimate goals (exclude own goals from duplicate detection)
  const legitimateGoals = allGoals.filter(goal => 
    !goal.event_detail?.toLowerCase().includes("own") &&
    !goal.event_detail?.toLowerCase().includes("자책")
  );

  // 4. Identify duplicate goals using unique combination
  const goalMap = new Map<string, any[]>();
  
  for (const goal of legitimateGoals) {
    // Create unique key: fixture_id + player_id + elapsed_minutes + extra_minutes + event_detail
    const uniqueKey = `${goal.fixture_id}-${goal.player_id}-${goal.elapsed_minutes}-${goal.extra_minutes || 0}-${goal.event_detail}`;
    
    if (!goalMap.has(uniqueKey)) {
      goalMap.set(uniqueKey, []);
    }
    goalMap.get(uniqueKey)!.push(goal);
  }

  // 5. Find and remove duplicates (keep the earliest by created_at)
  let duplicatesFound = 0;
  let duplicatesRemoved = 0;

  console.log("\n🔍 Finding duplicate goals...");

  for (const [uniqueKey, goals] of goalMap.entries()) {
    if (goals.length > 1) {
      duplicatesFound += goals.length - 1;
      
      // Sort by created_at to keep the earliest
      const sortedGoals = goals.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const keepGoal = sortedGoals[0];
      const duplicatesToRemove = sortedGoals.slice(1);
      
      console.log(`\n🔄 Processing ${goals.length} identical goals:`);
      console.log(`  Key: ${uniqueKey}`);
      console.log(`  Keeping: ${keepGoal.id} (created: ${keepGoal.created_at})`);
      
      // Remove duplicates
      for (const duplicate of duplicatesToRemove) {
        const { error: deleteError } = await supabase
          .from("events")
          .delete()
          .eq("id", duplicate.id);

        if (deleteError) {
          console.error(`  ❌ Failed to delete duplicate ${duplicate.id}:`, deleteError);
        } else {
          console.log(`  ✅ Deleted duplicate: ${duplicate.id} (created: ${duplicate.created_at})`);
          duplicatesRemoved++;
        }
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Total goal events processed: ${allGoals.length}`);
  console.log(`  Own Goals removed: ${ownGoals.length}`);
  console.log(`  Duplicate goals found: ${duplicatesFound}`);
  console.log(`  Duplicate goals removed: ${duplicatesRemoved}`);
  console.log(`  Final goal events: ${allGoals.length - ownGoals.length - duplicatesRemoved}`);

  // 6. Verify results by checking top scorers again
  console.log("\n🏆 Verifying top scorers after cleanup:");
  
  const { data: cleanGoals } = await supabase
    .from("events")
    .select(`
      player_id,
      players!events_player_id_fkey(name),
      fixtures!inner(league_id, season_year)
    `)
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal")
    .not("event_detail", "ilike", "%own%")
    .not("event_detail", "ilike", "%자책%");

  if (cleanGoals) {
    const scorers = cleanGoals.reduce((acc, goal) => {
      const playerId = goal.player_id;
      const playerName = Array.isArray(goal.players) ? goal.players[0]?.name : goal.players?.name;
      
      if (!acc[playerId]) {
        acc[playerId] = {
          name: playerName || `Player ${playerId}`,
          goals: 0
        };
      }
      acc[playerId].goals++;
      return acc;
    }, {} as Record<number, { name: string; goals: number }>);

    const topScorers = Object.values(scorers)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    topScorers.forEach((scorer, index) => {
      console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals} goals`);
    });
  }

  console.log("\n✅ Duplicate goal cleanup completed!");
}

fixDuplicateGoalEvents().catch(console.error);