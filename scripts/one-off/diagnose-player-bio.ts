import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;
const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 Diagnosing Player Bio Fetch issues...');

  // 1. Get a sample of players who likely failed (e.g., have no nationality)
  const { data: players, error } = await supabase
    .from('players')
    .select('idPlayer, strPlayer')
    .is('strNationality', null) // Filter for those not updated
    .limit(5);

  if (error || !players || players.length === 0) {
    console.log('Could not find players to diagnose or all updated?');
    return;
  }

  console.log(`Checking ${players.length} failed players...`);

  for (const player of players) {
    console.log(`
------------------------------------------------`);
    console.log(`Player: ${player.strPlayer} (ID: ${player.idPlayer})`);
    
    const url = `https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupplayer.php?id=${player.idPlayer}`;
    console.log(`Request URL: ${url}`);

    try {
      const res = await fetch(url);
      console.log(`Status: ${res.status} ${res.statusText}`);
      
      const json = await res.json();
      console.log('Response Data:', JSON.stringify(json, null, 2).substring(0, 500) + '...'); // Truncate for readability
      
      if (!json.players) {
        console.log('❌ Analysis: "players" field is null. ID might be invalid or data does not exist on TSDB.');
      } else {
        console.log('✅ Analysis: Data exists! Maybe the script failed due to rate limiting?');
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    }
  }
}

diagnose();
