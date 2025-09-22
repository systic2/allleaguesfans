import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Football jersey number conventions by position
const POSITION_JERSEY_RANGES = {
  'Goalkeeper': [1, 12, 13, 21, 23, 30, 31, 32, 41, 50],
  'Defender': [2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 22, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49], 
  'Midfielder': [6, 7, 8, 10, 11, 14, 16, 18, 20, 22, 24, 25, 26, 27, 28, 29, 34, 35, 42, 43, 44, 45, 46, 47, 48, 49, 52, 55, 56, 60, 66, 67, 68, 69, 70, 77, 80, 88],
  'Attacker': [7, 8, 9, 10, 11, 17, 19, 20, 21, 27, 29, 40, 41, 42, 43, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 70, 71, 72, 73, 74, 75, 76, 77, 79, 88, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
};

function getPreferredJerseys(position: string): number[] {
  const positionKey = position as keyof typeof POSITION_JERSEY_RANGES;
  return POSITION_JERSEY_RANGES[positionKey] || POSITION_JERSEY_RANGES['Midfielder'];
}

async function completeJerseyFix() {
  console.log('🔧 Starting complete jersey number duplicate resolution...\n');

  // Get all players ordered by team and ID for consistent processing
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position')
    .order('team_id, id'); // Order by ID for deterministic results

  if (error) {
    console.error('❌ Error fetching players:', error.message);
    return;
  }

  if (!players || players.length === 0) {
    console.error('❌ No players found');
    return;
  }

  console.log(`📊 Processing ${players.length} players across teams...\n`);

  // Group players by team
  const teamGroups = players.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) acc[teamId] = [];
    acc[teamId].push(player);
    return acc;
  }, {});

  let totalUpdates = 0;
  let teamsProcessed = 0;

  for (const [teamId, teamPlayers] of Object.entries(teamGroups)) {
    const players = teamPlayers as any[];
    console.log(`\n🏈 Processing Team ${teamId} (${players.length} players)`);

    // Track all jersey assignments for this team
    const finalJerseyAssignments = new Map<number, number>(); // playerId -> jerseyNumber
    const usedJerseys = new Set<number>();

    // First pass: collect all existing valid unique jerseys
    const jerseyMap = new Map<number, any[]>();
    players.forEach(player => {
      if (player.jersey_number !== null) {
        if (!jerseyMap.has(player.jersey_number)) {
          jerseyMap.set(player.jersey_number, []);
        }
        jerseyMap.get(player.jersey_number)!.push(player);
      }
    });

    // Assign jerseys systematically
    for (const player of players) {
      const playerId = player.id;
      const currentJersey = player.jersey_number;
      const position = player.position || 'Midfielder';

      if (currentJersey !== null) {
        const playersWithSameJersey = jerseyMap.get(currentJersey) || [];
        
        if (playersWithSameJersey.length === 1) {
          // This player is the only one with this jersey number - keep it
          finalJerseyAssignments.set(playerId, currentJersey);
          usedJerseys.add(currentJersey);
        } else {
          // Multiple players have this jersey - assign new one to all but the first (by ID)
          const firstPlayer = playersWithSameJersey.sort((a, b) => a.id - b.id)[0];
          
          if (player.id === firstPlayer.id) {
            // This is the first player (by ID) - keep the jersey
            finalJerseyAssignments.set(playerId, currentJersey);
            usedJerseys.add(currentJersey);
          } else {
            // This player needs a new jersey
            const newJersey = findAvailableJersey(position, usedJerseys);
            if (newJersey) {
              finalJerseyAssignments.set(playerId, newJersey);
              usedJerseys.add(newJersey);
            } else {
              // No available jersey - will be set to null
              console.log(`  ⚠️ No available jersey for ${player.name} - setting to NULL`);
            }
          }
        }
      } else {
        // Player has no jersey - assign one
        const newJersey = findAvailableJersey(position, usedJerseys);
        if (newJersey) {
          finalJerseyAssignments.set(playerId, newJersey);
          usedJerseys.add(newJersey);
        }
      }
    }

    // Apply all updates for this team
    let teamUpdates = 0;
    for (const player of players) {
      const currentJersey = player.jersey_number;
      const newJersey = finalJerseyAssignments.get(player.id) || null;

      if (currentJersey !== newJersey) {
        try {
          const { error: updateError } = await supabase
            .from('players')
            .update({ jersey_number: newJersey })
            .eq('id', player.id);

          if (updateError) {
            console.error(`  ❌ Failed to update ${player.name}: ${updateError.message}`);
          } else {
            console.log(`  ✅ ${player.name}: ${currentJersey || 'NULL'} → #${newJersey || 'NULL'}`);
            teamUpdates++;
            totalUpdates++;
          }
        } catch (err) {
          console.error(`  ❌ Error updating ${player.name}: ${err}`);
        }
      }
    }

    if (teamUpdates > 0) {
      console.log(`  📊 Team ${teamId}: ${teamUpdates} updates applied`);
    } else {
      console.log(`  ✅ Team ${teamId}: No updates needed`);
    }

    teamsProcessed++;
  }

  console.log(`\n📊 FINAL SUMMARY:`);
  console.log(`  - Teams processed: ${teamsProcessed}`);
  console.log(`  - Total jersey updates: ${totalUpdates}`);
  console.log(`  - Operation completed successfully!`);

  // Final verification
  console.log(`\n🔍 Running final verification...`);
  await verifyNoDuplicates();
}

function findAvailableJersey(position: string, usedJerseys: Set<number>): number | null {
  // Try preferred numbers for the position first
  const preferredNumbers = getPreferredJerseys(position);
  for (const num of preferredNumbers) {
    if (!usedJerseys.has(num) && num >= 1 && num <= 99) {
      return num;
    }
  }

  // If no preferred numbers available, try any number 1-99
  for (let num = 1; num <= 99; num++) {
    if (!usedJerseys.has(num)) {
      return num;
    }
  }

  return null; // No available numbers
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
    if (!acc[teamId]) acc[teamId] = [];
    acc[teamId].push(player.jersey_number);
    return acc;
  }, {});

  let duplicatesFound = 0;
  let totalDuplicateInstances = 0;

  for (const [teamId, jerseyNumbers] of Object.entries(teamGroups)) {
    const numbers = jerseyNumbers as number[];
    const uniqueNumbers = new Set(numbers);

    if (numbers.length !== uniqueNumbers.size) {
      console.error(`❌ Team ${teamId} still has duplicates!`);
      duplicatesFound++;
      
      // Count duplicate instances
      const jerseyCount = new Map<number, number>();
      numbers.forEach(num => {
        jerseyCount.set(num, (jerseyCount.get(num) || 0) + 1);
      });
      
      jerseyCount.forEach((count, jersey) => {
        if (count > 1) {
          totalDuplicateInstances += count;
        }
      });
    }
  }

  if (duplicatesFound === 0) {
    console.log(`✅ SUCCESS: No duplicate jersey numbers found! All teams have unique jersey assignments.`);
    return true;
  } else {
    console.error(`❌ VERIFICATION FAILED: ${duplicatesFound} teams still have duplicates (${totalDuplicateInstances} total duplicate instances)`);
    return false;
  }
}

completeJerseyFix().catch(console.error);