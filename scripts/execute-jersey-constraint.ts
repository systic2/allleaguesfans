import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeJerseyConstraint() {
  console.log('🔧 Executing jersey number constraint script...\n');

  try {
    // Read the SQL script
    const sqlScript = readFileSync('/Users/systic/Desktop/allleaguesfans/scripts/add-jersey-constraint.sql', 'utf8');
    
    // Split into individual statements and execute them one by one
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Execute each statement individually
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}: ${error.message}`);
          // Try to continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}: ${err}`);
      }
    }

    console.log('\n🎯 Attempting to add constraints manually...');

    // Try to add the unique constraint directly
    try {
      const { error: constraintError } = await supabase.rpc('exec_sql', {
        sql_query: `
          ALTER TABLE players 
          ADD CONSTRAINT unique_jersey_per_team 
          UNIQUE (team_id, jersey_number);
        `
      });

      if (constraintError) {
        console.error('❌ Constraint addition failed:', constraintError.message);
        
        // If constraint fails, manually fix remaining duplicates
        console.log('\n🔧 Manually fixing remaining duplicates...');
        await fixRemainingDuplicates();
      } else {
        console.log('✅ Unique constraint added successfully!');
      }
    } catch (err) {
      console.error('❌ Constraint addition exception:', err);
      await fixRemainingDuplicates();
    }

  } catch (err) {
    console.error('❌ Error reading SQL script:', err);
  }
}

async function fixRemainingDuplicates() {
  console.log('🔍 Finding and fixing remaining duplicates...');

  // Get all players with duplicates
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position')
    .not('jersey_number', 'is', null)
    .order('team_id, jersey_number, id');

  if (error) {
    console.error('❌ Error fetching players:', error.message);
    return;
  }

  // Group by team and find duplicates
  const teamGroups = players!.reduce((acc: any, player) => {
    const teamId = player.team_id;
    if (!acc[teamId]) acc[teamId] = [];
    acc[teamId].push(player);
    return acc;
  }, {});

  let fixedCount = 0;

  for (const [teamId, teamPlayers] of Object.entries(teamGroups)) {
    const players = teamPlayers as any[];
    const jerseyMap = new Map<number, any[]>();

    // Group by jersey number
    players.forEach(player => {
      const jersey = player.jersey_number;
      if (!jerseyMap.has(jersey)) jerseyMap.set(jersey, []);
      jerseyMap.get(jersey)!.push(player);
    });

    // Find duplicates
    const duplicates = Array.from(jerseyMap.entries()).filter(([_, players]) => players.length > 1);

    if (duplicates.length > 0) {
      console.log(`🔧 Team ${teamId}: Fixing ${duplicates.length} duplicate jersey numbers`);

      for (const [jerseyNum, duplicatePlayers] of duplicates) {
        // Keep the first player with this jersey, reassign others
        for (let i = 1; i < duplicatePlayers.length; i++) {
          const player = duplicatePlayers[i];
          
          // Find next available jersey number
          let newJersey = 1;
          const usedJerseys = new Set(players.map(p => p.jersey_number));
          
          while (usedJerseys.has(newJersey) && newJersey <= 99) {
            newJersey++;
          }

          if (newJersey <= 99) {
            const { error: updateError } = await supabase
              .from('players')
              .update({ jersey_number: newJersey })
              .eq('id', player.id);

            if (!updateError) {
              console.log(`  ✅ ${player.name}: #${jerseyNum} → #${newJersey}`);
              usedJerseys.add(newJersey);
              fixedCount++;
            } else {
              console.error(`  ❌ Failed to update ${player.name}: ${updateError.message}`);
            }
          } else {
            // Set to null if no available number
            const { error: updateError } = await supabase
              .from('players')
              .update({ jersey_number: null })
              .eq('id', player.id);

            if (!updateError) {
              console.log(`  ⚠️ ${player.name}: #${jerseyNum} → NULL (no available numbers)`);
              fixedCount++;
            }
          }
        }
      }
    }
  }

  console.log(`\n📊 Manual fix completed: ${fixedCount} players updated`);
}

executeJerseyConstraint().catch(console.error);