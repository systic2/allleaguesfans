import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTopScorers() {
  console.log("🔍 Checking top scorers in our database...\n");

  // Check K League 1 (292) top scorers for 2025 season
  const { data: goalEvents, error } = await supabase
    .from("events")
    .select(`
      player_id,
      team_id,
      fixtures!inner(league_id, season_year),
      players!events_player_id_fkey(name),
      teams(name)
    `)
    .eq("fixtures.league_id", 292) // K League 1
    .eq("fixtures.season_year", 2025)
    .eq("event_type", "Goal");

  if (error) {
    console.error("❌ Error fetching goal events:", error);
    
    // Try simpler query without joins
    console.log("🔄 Trying simpler query...");
    const { data: simpleEvents, error: simpleError } = await supabase
      .from("events")
      .select(`
        player_id,
        team_id,
        event_type,
        fixtures!inner(league_id, season_year)
      `)
      .eq("fixtures.league_id", 292)
      .eq("fixtures.season_year", 2025)
      .eq("event_type", "Goal");

    if (simpleError) {
      console.error("❌ Simple query also failed:", simpleError);
      return;
    }

    console.log(`📊 Found ${simpleEvents?.length || 0} goal events with simple query`);
    
    if (simpleEvents && simpleEvents.length > 0) {
      // Get player names separately
      const playerIds = [...new Set(simpleEvents.map(e => e.player_id))];
      const { data: players } = await supabase
        .from("players")
        .select("id, name")
        .in("id", playerIds);

      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", [...new Set(simpleEvents.map(e => e.team_id))]);

      const playerMap = (players || []).reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<number, string>);

      const teamMap = (teams || []).reduce((acc, t) => {
        acc[t.id] = t.name;
        return acc;
      }, {} as Record<number, string>);

      // Count goals per player
      const goalCounts = simpleEvents.reduce((acc, event) => {
        const playerId = event.player_id;
        if (!acc[playerId]) {
          acc[playerId] = {
            player_id: playerId,
            player_name: playerMap[playerId] || `Player ${playerId}`,
            team_name: teamMap[event.team_id] || "Unknown",
            goals: 0
          };
        }
        acc[playerId].goals++;
        return acc;
      }, {} as Record<number, any>);

      const topScorers = Object.values(goalCounts)
        .sort((a: any, b: any) => b.goals - a.goals)
        .slice(0, 15);

      console.log("\n🏆 Top Scorers in our database (K League 1 2025):");
      console.log("Rank | Player Name | Team | Goals");
      console.log("-".repeat(60));
      
      topScorers.forEach((scorer: any, index) => {
        console.log(`${(index + 1).toString().padStart(2)} | ${scorer.player_name.padEnd(25)} | ${scorer.team_name.padEnd(15)} | ${scorer.goals}`);
      });
    }
    
    return;
  }

  console.log(`📊 Total goal events found: ${goalEvents?.length || 0}`);

  if (!goalEvents || goalEvents.length === 0) {
    console.log("🚫 No goal events found in database");
    return;
  }

  // Count goals per player
  const goalCounts = goalEvents.reduce((acc, event) => {
    const playerId = event.player_id;
    const playerName = Array.isArray(event.players) ? event.players[0]?.name : event.players?.name;
    const teamName = Array.isArray(event.teams) ? event.teams[0]?.name : event.teams?.name;
    
    if (!acc[playerId]) {
      acc[playerId] = {
        player_id: playerId,
        player_name: playerName || `Player ${playerId}`,
        team_name: teamName || "Unknown",
        goals: 0
      };
    }
    acc[playerId].goals++;
    return acc;
  }, {} as Record<number, any>);

  const topScorers = Object.values(goalCounts)
    .sort((a: any, b: any) => b.goals - a.goals)
    .slice(0, 15);

  console.log("\n🏆 Top Scorers in our database (K League 1 2025):");
  console.log("Rank | Player Name | Team | Goals");
  console.log("-".repeat(60));
  
  topScorers.forEach((scorer: any, index) => {
    console.log(`${(index + 1).toString().padStart(2)} | ${scorer.player_name.padEnd(25)} | ${scorer.team_name.padEnd(15)} | ${scorer.goals}`);
  });

  // Let's also check what fixtures we have for 2025
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, date_utc, status_short, season_year")
    .eq("league_id", 292)
    .eq("season_year", 2025)
    .order("date_utc", { ascending: false })
    .limit(5);

  console.log("\n📅 Recent K League 1 2025 fixtures:");
  fixtures?.forEach(fixture => {
    console.log(`- ${fixture.date_utc.split('T')[0]} | Status: ${fixture.status_short}`);
  });

  // Check if we have events for the current season
  const { data: eventCount } = await supabase
    .from("events")
    .select("count", { count: 'exact' })
    .eq("fixtures.league_id", 292)
    .eq("fixtures.season_year", 2025);

  console.log(`\n📊 Total events for K League 1 2025: ${eventCount || 'unknown'}`);
}

checkTopScorers().catch(console.error);