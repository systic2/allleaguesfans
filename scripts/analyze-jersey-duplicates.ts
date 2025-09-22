import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeJerseyDuplicates() {
  console.log('🔍 Analyzing jersey number duplicates across teams...\n');
  
  // Get all players with jersey numbers
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position')
    .not('jersey_number', 'is', null)
    .order('team_id, jersey_number');
    
  if (error) {
    console.log(`❌ Error fetching players: ${error.message}`);
    return;
  }
  
  if (!players || players.length === 0) {
    console.log('❌ No players with jersey numbers found');
    return;
  }
  
  console.log(`📊 Total players with jersey numbers: ${players.length}`);
  
  // Group by team_id and check for duplicates
  const teamGroups = players.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) {
      acc[teamId] = [];
    }
    acc[teamId].push(player);
    return acc;
  }, {});
  
  console.log(`👥 Number of teams: ${Object.keys(teamGroups).length}\n`);
  
  let totalDuplicates = 0;
  let teamsWithDuplicates = 0;
  
  // Check each team for duplicates
  for (const [teamId, teamPlayers] of Object.entries(teamGroups)) {
    const jerseyMap = new Map<number, any[]>();
    
    // Group players by jersey number
    (teamPlayers as any[]).forEach(player => {
      const jerseyNum = player.jersey_number;
      if (!jerseyMap.has(jerseyNum)) {
        jerseyMap.set(jerseyNum, []);
      }
      jerseyMap.get(jerseyNum)!.push(player);
    });
    
    // Find duplicates
    const duplicates = Array.from(jerseyMap.entries()).filter(([_, players]) => players.length > 1);
    
    if (duplicates.length > 0) {
      teamsWithDuplicates++;
      console.log(`🚨 Team ${teamId} has ${duplicates.length} duplicate jersey number(s):`);
      
      duplicates.forEach(([jerseyNum, duplicatePlayers]) => {
        console.log(`  Jersey #${jerseyNum}:`);
        duplicatePlayers.forEach((player, index) => {
          console.log(`    ${index + 1}. ${player.name} (ID: ${player.id}) - ${player.position || 'Unknown'}`);
          totalDuplicates++;
        });
      });
      console.log();
    }
  }
  
  // Summary
  console.log(`\n📈 SUMMARY:`);
  console.log(`  - Teams with duplicate jersey numbers: ${teamsWithDuplicates}`);
  console.log(`  - Total duplicate instances: ${totalDuplicates}`);
  
  if (totalDuplicates > 0) {
    console.log(`\n❌ CRITICAL ISSUE: Jersey number duplicates found!`);
    console.log(`\n🔧 Recommended actions:`);
    console.log(`  1. Implement unique constraint on (team_id, jersey_number)`);
    console.log(`  2. Fix existing duplicates by reassigning jersey numbers`);
    console.log(`  3. Update API logic to prevent future duplicates`);
  } else {
    console.log(`\n✅ No jersey number duplicates found - data integrity is good!`);
  }
  
  // Show jersey number distribution for sample teams
  console.log(`\n📋 Jersey number distribution for first 3 teams:`);
  const sampleTeams = Object.entries(teamGroups).slice(0, 3);
  
  sampleTeams.forEach(([teamId, teamPlayers]) => {
    const jerseyNumbers = (teamPlayers as any[]).map(p => p.jersey_number).sort((a, b) => a - b);
    console.log(`  Team ${teamId}: [${jerseyNumbers.join(', ')}]`);
  });
}

analyzeJerseyDuplicates().catch(console.error);