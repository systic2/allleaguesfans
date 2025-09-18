import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

// K리그 공식 사이트 득점왕 데이터 (2025.09.15 기준)
const OFFICIAL_TOP_SCORERS = {
  "전진우": 14,
  "Jeon Jin-Woo": 14,
  "Jinwoo JEON": 14,
  
  "P. Sabbag": 13,
  "Pablo David SABBAG DACCARETT": 13,
  
  "A. Compagno": 12,
  "ANDREA COMPAGNO": 12,
  
  "이호재": 12,
  "Lee Ho-Jae": 12,
  "Hojae LEE": 12,
  
  "주민규": 11,
  "Joo Min-Kyu": 11,
  "Minkyu JOO": 11
};

async function deepGoalAnalysis() {
  console.log("🔍 Deep analysis: Why our data doesn't match official K-League...\n");

  // 1. Get all goal events with detailed information
  const { data: allGoals, error } = await supabase
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
        date_utc,
        status_short,
        round
      ),
      players!events_player_id_fkey(name, nationality),
      teams(name)
    `)
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal")
    .order("player_id")
    .order("fixtures(date_utc)");

  if (error) {
    console.error("❌ Error fetching goals:", error);
    return;
  }

  if (!allGoals) {
    console.log("❌ No goals found");
    return;
  }

  console.log(`📊 Total goals in DB: ${allGoals.length}`);

  // 2. Analyze by goal type/detail
  console.log("\n🎯 Goals by type/detail:");
  const goalsByDetail = allGoals.reduce((acc, goal) => {
    const detail = goal.event_detail || "Unknown";
    acc[detail] = (acc[detail] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(goalsByDetail)
    .sort(([,a], [,b]) => b - a)
    .forEach(([detail, count]) => {
      console.log(`  ${detail}: ${count} goals`);
    });

  // 3. Check for invalid goals (own goals, etc.)
  console.log("\n🚨 Checking for invalid goal types:");
  const suspiciousGoals = allGoals.filter(goal => 
    goal.event_detail?.toLowerCase().includes("own") ||
    goal.event_detail?.toLowerCase().includes("자책") ||
    goal.event_detail === "Missed Penalty"
  );

  if (suspiciousGoals.length > 0) {
    console.log(`Found ${suspiciousGoals.length} suspicious goals:`);
    suspiciousGoals.forEach(goal => {
      const playerName = Array.isArray(goal.players) ? goal.players[0]?.name : goal.players?.name;
      const teamName = Array.isArray(goal.teams) ? goal.teams[0]?.name : goal.teams?.name;
      console.log(`  - ${playerName} (${teamName}): ${goal.event_detail} in fixture ${goal.fixture_id}`);
    });
  } else {
    console.log("✅ No obvious invalid goals found");
  }

  // 4. Analyze top scorers vs official data
  console.log("\n🏆 Detailed comparison with K-League official data:");
  
  const dbScorers = allGoals.reduce((acc, goal) => {
    const playerId = goal.player_id;
    const playerName = Array.isArray(goal.players) ? goal.players[0]?.name : goal.players?.name;
    
    if (!acc[playerId]) {
      acc[playerId] = {
        name: playerName || `Player ${playerId}`,
        goals: [],
        total: 0
      };
    }
    
    acc[playerId].goals.push({
      date: goal.fixtures?.date_utc,
      detail: goal.event_detail,
      minute: goal.elapsed_minutes,
      fixture: goal.fixture_id
    });
    acc[playerId].total++;
    
    return acc;
  }, {} as Record<number, any>);

  const topDBScorers = Object.entries(dbScorers)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 10);

  console.log("\n📋 DB vs Official comparison:");
  console.log("Player Name               | DB Goals | Official | Difference | Analysis");
  console.log("-".repeat(80));

  for (const [playerId, scorer] of topDBScorers) {
    const playerName = scorer.name;
    const dbGoals = scorer.total;
    
    // Find official goals for this player
    let officialGoals = 0;
    for (const [officialName, goals] of Object.entries(OFFICIAL_TOP_SCORERS)) {
      if (playerName.includes(officialName) || officialName.includes(playerName)) {
        officialGoals = goals;
        break;
      }
    }

    const difference = dbGoals - officialGoals;
    const status = difference === 0 ? "✅ MATCH" : 
                  difference > 0 ? `❌ +${difference} excess` : 
                  `❌ -${Math.abs(difference)} missing`;

    console.log(`${playerName.padEnd(25)} | ${dbGoals.toString().padStart(8)} | ${officialGoals.toString().padStart(8)} | ${difference.toString().padStart(10)} | ${status}`);

    // Show detailed goals for players with discrepancies
    if (difference !== 0 && officialGoals > 0) {
      console.log(`\n🔍 Detailed goals for ${playerName}:`);
      scorer.goals
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((goal: any, index: number) => {
          const date = goal.date?.split('T')[0];
          console.log(`  ${index + 1}. ${date} | ${goal.minute}' | ${goal.detail} | Fixture ${goal.fixture}`);
        });
      console.log("");
    }
  }

  // 5. Check fixture completion status
  console.log("\n📅 Checking fixture completion status:");
  const fixtureStats = allGoals.reduce((acc, goal) => {
    const status = goal.fixtures?.status_short || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(fixtureStats).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} goals`);
  });

  // 6. Timeline analysis
  console.log("\n📊 Goals by month (to check if we're missing recent data):");
  const goalsByMonth = allGoals.reduce((acc, goal) => {
    const month = goal.fixtures?.date_utc?.substring(0, 7) || 'Unknown';
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(goalsByMonth)
    .sort()
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count} goals`);
    });

  // 7. Check most recent fixture date
  const mostRecentFixture = allGoals
    .map(goal => goal.fixtures?.date_utc)
    .filter(Boolean)
    .sort()
    .pop();

  console.log(`\n📅 Most recent fixture with goals: ${mostRecentFixture?.split('T')[0]}`);
  console.log(`📅 Today's date: ${new Date().toISOString().split('T')[0]}`);

  const daysDifference = mostRecentFixture ? 
    Math.floor((new Date().getTime() - new Date(mostRecentFixture).getTime()) / (1000 * 60 * 60 * 24)) : 
    'Unknown';

  console.log(`⏰ Data freshness: ${daysDifference} days behind`);

  console.log("\n💡 Recommendations:");
  if (daysDifference && typeof daysDifference === 'number' && daysDifference > 7) {
    console.log("  1. 🔄 Data is outdated - need to import recent fixtures");
  }
  if (suspiciousGoals.length > 0) {
    console.log("  2. 🚨 Remove invalid goal types (own goals, missed penalties)");
  }
  console.log("  3. 🔍 Verify API-Football data source accuracy");
  console.log("  4. ⏰ Check if K-League official site updates in real-time vs our batch imports");
}

deepGoalAnalysis().catch(console.error);