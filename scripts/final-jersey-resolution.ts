import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalJerseyResolution() {
  console.log('🔧 FINAL JERSEY RESOLUTION - Absolute duplicate elimination...\n');

  // Get all players
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position')
    .order('team_id, id');

  if (error) {
    console.error('❌ Error fetching players:', error.message);
    return;
  }

  if (!players || players.length === 0) {
    console.error('❌ No players found');
    return;
  }

  console.log(`📊 Processing ${players.length} players across all teams...\n`);

  // Group players by team
  const teamGroups = players.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) acc[teamId] = [];
    acc[teamId].push(player);
    return acc;
  }, {});

  const teamIds = Object.keys(teamGroups).sort();
  console.log(`🏈 Found ${teamIds.length} teams: ${teamIds.join(', ')}\n`);

  let totalUpdates = 0;

  for (const teamId of teamIds) {
    const teamPlayers = teamGroups[teamId];
    console.log(`\n🏈 Processing Team ${teamId} (${teamPlayers.length} players)`);

    // Clear ALL jersey numbers for this team first, then reassign systematically
    console.log(`  🧹 Clearing all jersey numbers for Team ${teamId}...`);
    
    const { error: clearError } = await supabase
      .from('players')
      .update({ jersey_number: null })
      .eq('team_id', teamId);

    if (clearError) {
      console.error(`  ❌ Error clearing jerseys for Team ${teamId}: ${clearError.message}`);
      continue;
    }

    // Now assign jerseys systematically
    const usedJerseys = new Set<number>();
    let teamUpdates = 0;

    // Sort players by priority: Goalkeepers first, then by ID for consistency
    const sortedPlayers = teamPlayers.sort((a: any, b: any) => {
      const aIsGK = (a.position || '').toLowerCase().includes('goalkeeper') || 
                   (a.position || '').toLowerCase() === 'gk' ||
                   (a.position || '').toLowerCase() === 'g';
      const bIsGK = (b.position || '').toLowerCase().includes('goalkeeper') || 
                   (b.position || '').toLowerCase() === 'gk' ||
                   (b.position || '').toLowerCase() === 'g';
      
      if (aIsGK && !bIsGK) return -1;
      if (!aIsGK && bIsGK) return 1;
      return a.id - b.id; // Consistent ordering by ID
    });

    for (const player of sortedPlayers) {
      const position = player.position || 'Midfielder';
      const jersey = getNextAvailableJersey(position, usedJerseys);

      if (jersey) {
        const { error: updateError } = await supabase
          .from('players')
          .update({ jersey_number: jersey })
          .eq('id', player.id);

        if (updateError) {
          console.error(`  ❌ Failed to update ${player.name}: ${updateError.message}`);
        } else {
          console.log(`  ✅ ${player.name} (${position}): #${jersey}`);
          usedJerseys.add(jersey);
          teamUpdates++;
          totalUpdates++;
        }
      } else {
        console.log(`  ⚠️ ${player.name}: No available jersey - kept as NULL`);
      }
    }

    console.log(`  📊 Team ${teamId}: ${teamUpdates} jersey assignments`);
  }

  console.log(`\n📊 FINAL SUMMARY:`);
  console.log(`  - Teams processed: ${teamIds.length}`);
  console.log(`  - Total jersey assignments: ${totalUpdates}`);
  console.log(`  - Operation completed successfully!`);

  // Final verification
  console.log(`\n🔍 Running final verification...`);
  const success = await verifyNoDuplicates();
  
  if (success) {
    console.log(`\n🎉 SUCCESS! All jersey number duplicates have been resolved!`);
  } else {
    console.log(`\n❌ Issues remain - may need manual review.`);
  }
}

function getNextAvailableJersey(position: string, usedJerseys: Set<number>): number | null {
  // Position-based preferred numbers
  const preferences = {
    'Goalkeeper': [1, 12, 13, 21, 23, 30, 31, 32, 41, 50],
    'Defender': [2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 22, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49],
    'Midfielder': [6, 7, 8, 10, 11, 14, 16, 18, 20, 22, 24, 25, 26, 27, 28, 29, 34, 35, 42, 43, 44, 45, 46, 47, 48, 49, 52, 55, 56, 60, 66, 67, 68, 69, 70, 77, 80, 88],
    'Attacker': [7, 8, 9, 10, 11, 17, 19, 20, 21, 27, 29, 40, 41, 42, 43, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 70, 71, 72, 73, 74, 75, 76, 77, 79, 88, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
  };

  // Determine position category
  const pos = position.toLowerCase();
  let preferredNumbers: number[] = [];

  if (pos.includes('goalkeeper') || pos === 'gk' || pos === 'g') {
    preferredNumbers = preferences['Goalkeeper'];
  } else if (pos.includes('defender') || pos === 'd' || pos.includes('back') || pos === 'cb' || pos === 'lb' || pos === 'rb') {
    preferredNumbers = preferences['Defender'];
  } else if (pos.includes('midfielder') || pos === 'm' || pos === 'cm' || pos === 'dm' || pos === 'am' || pos === 'lm' || pos === 'rm') {
    preferredNumbers = preferences['Midfielder'];
  } else if (pos.includes('attacker') || pos.includes('forward') || pos === 'f' || pos === 'st' || pos === 'cf' || pos === 'lw' || pos === 'rw') {
    preferredNumbers = preferences['Attacker'];
  } else {
    // Default to midfielder for unknown positions
    preferredNumbers = preferences['Midfielder'];
  }

  // Try preferred numbers first
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

async function verifyNoDuplicates(): Promise<boolean> {
  const { data: players, error } = await supabase
    .from('players')
    .select('team_id, jersey_number')
    .not('jersey_number', 'is', null);

  if (error) {
    console.error(`❌ Verification error: ${error.message}`);
    return false;
  }

  // Group by team and check for duplicates
  const teamGroups = players!.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) acc[teamId] = [];
    acc[teamId].push(player.jersey_number);
    return acc;
  }, {});

  let duplicatesFound = 0;
  let totalPlayers = 0;
  let totalWithJerseys = 0;

  for (const [teamId, jerseyNumbers] of Object.entries(teamGroups)) {
    const numbers = jerseyNumbers as number[];
    const uniqueNumbers = new Set(numbers);
    totalPlayers += numbers.length;
    totalWithJerseys += numbers.length;

    if (numbers.length !== uniqueNumbers.size) {
      console.error(`❌ Team ${teamId} has duplicates: ${numbers.length} jerseys, ${uniqueNumbers.size} unique`);
      duplicatesFound++;
      
      // Show which numbers are duplicated
      const counts = new Map<number, number>();
      numbers.forEach(num => counts.set(num, (counts.get(num) || 0) + 1));
      const duplicatedNumbers = Array.from(counts.entries()).filter(([_, count]) => count > 1);
      console.error(`  Duplicated jerseys: ${duplicatedNumbers.map(([num, count]) => `#${num}(${count}x)`).join(', ')}`);
    } else {
      console.log(`✅ Team ${teamId}: ${numbers.length} unique jerseys`);
    }
  }

  console.log(`\n📊 Verification Summary:`);
  console.log(`  - Total players with jerseys: ${totalWithJerseys}`);
  console.log(`  - Teams with duplicates: ${duplicatesFound}`);
  console.log(`  - Teams verified: ${Object.keys(teamGroups).length}`);

  return duplicatesFound === 0;
}

finalJerseyResolution().catch(console.error);