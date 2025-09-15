import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeGoalDataQuality() {
  console.log("🔍 Analyzing goal data quality issues...\n");

  // 1. Get all goal events for K League 1 2025
  console.log("1️⃣ Fetching all goal events...");
  
  const { data: allGoals, error } = await supabase
    .from("events")
    .select(`
      id,
      player_id,
      team_id,
      fixture_id,
      elapsed_minutes,
      extra_minutes,
      event_detail,
      fixtures!inner(league_id, season_year, date_utc, status_short)
    `)
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal")
    .order("fixture_id, player_id, elapsed_minutes");

  if (error) {
    console.error("❌ Error fetching goal events:", error);
    return;
  }

  console.log(`📊 Total goal events in DB: ${allGoals?.length || 0}`);

  if (!allGoals || allGoals.length === 0) {
    console.log("🚫 No goal events found");
    return;
  }

  // 2. Find potential duplicates (same player, same fixture, same time)
  console.log("\n2️⃣ Checking for duplicate goal events...");
  
  const duplicateMap = new Map<string, typeof allGoals>();
  const duplicates: typeof allGoals = [];

  allGoals.forEach(goal => {
    const key = `${goal.player_id}-${goal.fixture_id}-${goal.elapsed_minutes}-${goal.extra_minutes || 0}`;
    if (duplicateMap.has(key)) {
      const existing = duplicateMap.get(key)!;
      duplicates.push(...existing, goal);
      duplicateMap.set(key, [...existing, goal]);
    } else {
      duplicateMap.set(key, [goal]);
    }
  });

  if (duplicates.length > 0) {
    console.log(`🚨 Found ${duplicates.length} potential duplicate goals`);
    
    // Group duplicates by player
    const duplicatesByPlayer = duplicates.reduce((acc, goal) => {
      acc[goal.player_id] = (acc[goal.player_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log("Top players affected by duplicates:");
    Object.entries(duplicatesByPlayer)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([playerId, count]) => {
        console.log(`Player ${playerId}: ${count} duplicate goals`);
      });
  } else {
    console.log("✅ No obvious duplicate goals found");
  }

  // 3. Find Jeon Jin-Woo's player ID and analyze his goals
  console.log("\n3️⃣ Finding Jeon Jin-Woo and top scorers...");
  
  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .or("name.ilike.%Jeon Jin%,name.ilike.%전진우%,name.ilike.%Jinwoo%,name.ilike.%Compagno%,name.ilike.%Sabbag%");

  console.log("🔍 Found key players:", players?.map(p => `${p.id}: ${p.name}`));

  if (players && players.length > 0) {
    for (const player of players) {
      const playerGoals = allGoals.filter(goal => goal.player_id === player.id);
      if (playerGoals.length > 0) {
        console.log(`\n👤 ${player.name} (ID: ${player.id}) - ${playerGoals.length} goals:`);
        
        // Group by fixture to check for duplicates
        const fixtureGoals = playerGoals.reduce((acc, goal) => {
          if (!acc[goal.fixture_id]) {
            acc[goal.fixture_id] = [];
          }
          acc[goal.fixture_id].push(goal);
          return acc;
        }, {} as Record<number, typeof playerGoals>);

        Object.entries(fixtureGoals).forEach(([fixtureId, goals]) => {
          const firstGoal = goals[0];
          const date = firstGoal.fixtures?.date_utc?.split('T')[0];
          const status = firstGoal.fixtures?.status_short;
          
          if (goals.length === 1) {
            const goal = goals[0];
            console.log(`  ✅ Fixture ${fixtureId} | ${date} | ${status} | ${goal.elapsed_minutes}'${goal.extra_minutes ? `+${goal.extra_minutes}` : ''} | ${goal.event_detail || 'Goal'}`);
          } else {
            console.log(`  🚨 Fixture ${fixtureId} | ${date} | ${status} | ${goals.length} GOALS:`);
            goals.forEach((goal, idx) => {
              console.log(`     ${idx + 1}. ${goal.elapsed_minutes}'${goal.extra_minutes ? `+${goal.extra_minutes}` : ''} | ${goal.event_detail || 'Goal'} (ID: ${goal.id})`);
            });
          }
        });
      }
    }
  }

  // 4. Analyze goals by fixture status
  console.log("\n4️⃣ Analyzing goals by fixture status...");
  
  const goalsByStatus = allGoals.reduce((acc, goal) => {
    const status = goal.fixtures?.status_short || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("Goals by fixture status:");
  Object.entries(goalsByStatus)
    .sort(([,a], [,b]) => b - a)
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count} goals`);
    });

  // 5. Check for goals in non-completed fixtures
  const nonCompletedGoals = allGoals.filter(goal => 
    goal.fixtures?.status_short !== 'FT'
  );

  if (nonCompletedGoals.length > 0) {
    console.log(`\n🚨 Found ${nonCompletedGoals.length} goals in non-completed fixtures:`);
    nonCompletedGoals.slice(0, 10).forEach(goal => {
      const date = goal.fixtures?.date_utc?.split('T')[0];
      console.log(`  Fixture ${goal.fixture_id} | ${date} | Status: ${goal.fixtures?.status_short} | Player ${goal.player_id}`);
    });
  }

  // 6. Summary of top scorers from our analysis
  console.log("\n6️⃣ Top scorers from raw data analysis:");
  
  const scorerCounts = allGoals.reduce((acc, goal) => {
    acc[goal.player_id] = (acc[goal.player_id] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const topScorers = Object.entries(scorerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15);

  const { data: topScorerNames } = await supabase
    .from("players")
    .select("id, name")
    .in("id", topScorers.map(([id]) => parseInt(id)));

  const nameMap = (topScorerNames || []).reduce((acc, player) => {
    acc[player.id] = player.name;
    return acc;
  }, {} as Record<number, string>);

  console.log("\n🏆 DB Top Scorers vs K리그 Official:");
  console.log("Rank | Player Name              | DB Goals | Official Expected");
  console.log("-".repeat(70));
  topScorers.forEach(([playerId, goals], index) => {
    const name = nameMap[parseInt(playerId)] || `Player ${playerId}`;
    let officialGoals = '?';
    
    // Map known players to their official goals
    if (name.includes('Jeon Jin') || name.includes('전진우') || name.includes('Jinwoo')) {
      officialGoals = '14';
    } else if (name.includes('Sabbag')) {
      officialGoals = '13';
    } else if (name.includes('Compagno')) {
      officialGoals = '12';
    } else if (name.includes('Lee Ho') || name.includes('이호재')) {
      officialGoals = '12';
    } else if (name.includes('Joo Min') || name.includes('주민규')) {
      officialGoals = '11';
    }
    
    const diff = officialGoals !== '?' ? (goals - parseInt(officialGoals)) : 0;
    const indicator = diff > 0 ? ` (+${diff})` : '';
    
    console.log(`${(index + 1).toString().padStart(2)} | ${name.padEnd(25)} | ${goals.toString().padStart(8)} | ${officialGoals.padStart(16)}${indicator}`);
  });
}

analyzeGoalDataQuality().catch(console.error);