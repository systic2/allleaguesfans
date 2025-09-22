import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Football jersey number conventions
const POSITION_JERSEY_RANGES = {
  'Goalkeeper': [1, 12, 13, 21, 23, 30, 31, 32, 41, 50], // Traditional keeper numbers
  'Defender': [2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 22, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49], 
  'Midfielder': [6, 7, 8, 10, 11, 14, 16, 18, 20, 22, 24, 25, 26, 27, 28, 29, 34, 35, 42, 43, 44, 45, 46, 47, 48, 49, 52, 55, 56, 60, 66, 67, 68, 69, 70, 77, 80, 88],
  'Attacker': [7, 8, 9, 10, 11, 17, 19, 20, 21, 27, 29, 40, 41, 42, 43, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 70, 71, 72, 73, 74, 75, 76, 77, 79, 88, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
};

// Generate available jersey numbers for a position
function getAvailableJerseys(position: string, usedNumbers: Set<number>): number[] {
  const positionKey = position as keyof typeof POSITION_JERSEY_RANGES;
  const preferredNumbers = POSITION_JERSEY_RANGES[positionKey] || POSITION_JERSEY_RANGES['Midfielder'];
  
  // First try preferred numbers for the position
  const availablePreferred = preferredNumbers.filter(num => !usedNumbers.has(num));
  if (availablePreferred.length > 0) {
    return availablePreferred;
  }
  
  // If no preferred numbers available, use any number 1-99
  const allNumbers = Array.from({ length: 99 }, (_, i) => i + 1);
  return allNumbers.filter(num => !usedNumbers.has(num));
}

async function fixJerseyDuplicates() {
  console.log('🔧 Starting jersey number duplicate fix...\n');
  
  // Get all players grouped by team
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position')
    .order('team_id, jersey_number, id'); // Consistent ordering for deterministic results
    
  if (error) {
    console.error(`❌ Error fetching players: ${error.message}`);
    return;
  }
  
  if (!players || players.length === 0) {
    console.error('❌ No players found');
    return;
  }
  
  // Group players by team
  const teamGroups = players.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) {
      acc[teamId] = [];
    }
    acc[teamId].push(player);
    return acc;
  }, {});
  
  console.log(`👥 Processing ${Object.keys(teamGroups).length} teams...\n`);
  
  let totalUpdates = 0;
  let teamsFixed = 0;
  
  // Process each team
  for (const [teamId, teamPlayers] of Object.entries(teamGroups)) {
    const players = teamPlayers as any[];
    const usedNumbers = new Set<number>();
    const updates: Array<{ playerId: number, oldJersey: number | null, newJersey: number, playerName: string }> = [];
    
    // Track jersey assignments for this team
    for (const player of players) {
      const currentJersey = player.jersey_number;
      
      if (currentJersey === null) {
        // Assign jersey to players without numbers
        const position = player.position || 'Midfielder';
        const availableJerseys = getAvailableJerseys(position, usedNumbers);
        
        if (availableJerseys.length > 0) {
          const newJersey = availableJerseys[0];
          usedNumbers.add(newJersey);
          updates.push({
            playerId: player.id,
            oldJersey: null,
            newJersey,
            playerName: player.name
          });
        }
      } else if (usedNumbers.has(currentJersey)) {
        // Handle duplicate jersey numbers
        const position = player.position || 'Midfielder';
        const availableJerseys = getAvailableJerseys(position, usedNumbers);
        
        if (availableJerseys.length > 0) {
          const newJersey = availableJerseys[0];
          usedNumbers.add(newJersey);
          updates.push({
            playerId: player.id,
            oldJersey: currentJersey,
            newJersey,
            playerName: player.name
          });
        } else {
          console.warn(`⚠️ No available jersey numbers for player ${player.name} in team ${teamId}`);
        }
      } else {
        // Keep existing valid jersey number
        usedNumbers.add(currentJersey);
      }
    }
    
    // Apply updates for this team
    if (updates.length > 0) {
      console.log(`🔄 Fixing Team ${teamId} (${updates.length} updates):`);
      
      for (const update of updates) {
        try {
          const { error: updateError } = await supabase
            .from('players')
            .update({ jersey_number: update.newJersey })
            .eq('id', update.playerId);
            
          if (updateError) {
            console.error(`  ❌ Failed to update ${update.playerName}: ${updateError.message}`);
          } else {
            console.log(`  ✅ ${update.playerName}: ${update.oldJersey || 'null'} → #${update.newJersey}`);
            totalUpdates++;
          }
        } catch (err) {
          console.error(`  ❌ Error updating ${update.playerName}: ${err}`);
        }
      }
      
      teamsFixed++;
      console.log();
    }
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`  - Teams fixed: ${teamsFixed}`);
  console.log(`  - Total jersey updates: ${totalUpdates}`);
  console.log(`  - Operation completed successfully!`);
  
  // Verify the fix
  console.log(`\n🔍 Verifying fix...`);
  await verifyNoDuplicates();
}

async function verifyNoDuplicates() {
  const { data: players, error } = await supabase
    .from('players')
    .select('team_id, jersey_number')
    .not('jersey_number', 'is', null);
    
  if (error) {
    console.error(`❌ Verification error: ${error.message}`);
    return;
  }
  
  // Group by team and check for duplicates
  const teamGroups = players!.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) {
      acc[teamId] = [];
    }
    acc[teamId].push(player.jersey_number);
    return acc;
  }, {});
  
  let duplicatesFound = 0;
  
  for (const [teamId, jerseyNumbers] of Object.entries(teamGroups)) {
    const numbers = jerseyNumbers as number[];
    const uniqueNumbers = new Set(numbers);
    
    if (numbers.length !== uniqueNumbers.size) {
      console.error(`❌ Team ${teamId} still has duplicates!`);
      duplicatesFound++;
    }
  }
  
  if (duplicatesFound === 0) {
    console.log(`✅ Verification passed: No duplicate jersey numbers found!`);
  } else {
    console.error(`❌ Verification failed: ${duplicatesFound} teams still have duplicates`);
  }
}

fixJerseyDuplicates().catch(console.error);