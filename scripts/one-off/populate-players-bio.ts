import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Try to find the Service Role Key (Admin)
let supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || 
                  process.env.SUPABASE_SERVICE_ROLE_KEY || 
                  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                  process.env.SERVICE_ROLE_KEY;

// Fallback to Anon Key (might fail for updates due to RLS)
if (!supabaseKey) {
  console.warn('⚠️  Service Role Key not found. Using Anon Key. Updates might fail.');
  supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
}

const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchPlayerDetailsFromTSDB(playerId: string) {
  try {
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupplayer.php?id=${playerId}`);
    const data = await response.json();
    return data.players ? data.players[0] : null;
  } catch (error) {
    console.error(`Error fetching TSDB details for player ${playerId}:`, error);
    return null;
  }
}

async function populatePlayersBio() {
  console.log('🚀 Starting Player Bio Population...');

  // 1. Get all players from DB
  // We process in chunks to avoid memory issues and long running script timeouts if running in some environments,
  // but for a one-off script, fetching all IDs first is usually fine for < few thousand players.
  const { data: players, error: fetchError } = await supabase
    .from('players')
    .select('idPlayer, strPlayer');

  if (fetchError) {
    console.error('Error fetching players:', fetchError);
    return;
  }

  console.log(`Found ${players.length} players to update.`);

  let updatedCount = 0;
  let missingCount = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    process.stdout.write(`[${i + 1}/${players.length}] Processing ${player.strPlayer} (${player.idPlayer})... `); 
    
    // 2. Fetch details from TheSportsDB
    const tsdbPlayer = await fetchPlayerDetailsFromTSDB(player.idPlayer);
    
    if (!tsdbPlayer) {
      console.log(`❌ No data found.`);
      missingCount++;
      continue;
    }

    // 3. Update players table
    const updates = {
      strNationality: tsdbPlayer.strNationality,
      strHeight: tsdbPlayer.strHeight,
      strWeight: tsdbPlayer.strWeight,
      dateBorn: tsdbPlayer.dateBorn,
      strThumb: tsdbPlayer.strThumb,
      strBirthLocation: tsdbPlayer.strBirthLocation
    };

    const { error: updateError } = await supabase
      .from('players')
      .update(updates)
      .eq('idPlayer', player.idPlayer);

    if (updateError) {
      console.log(`❌ Update failed: ${updateError.message}`);
    } else {
      console.log(`✅ Updated.`);
      updatedCount++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
  }

  console.log(`
🎉 Finished!`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - Missing/Failed: ${missingCount}`);
}

populatePlayersBio();
