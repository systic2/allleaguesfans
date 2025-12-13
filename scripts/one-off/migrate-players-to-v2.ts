
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePlayers() {
  console.log('🚀 Starting migration from players to players_v2...');

  // 1. Fetch all players from legacy table
  const { data: players, error: fetchError } = await supabase
    .from('players')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching players:', fetchError);
    return;
  }

  console.log(`Found ${players.length} players in legacy table.`);

  // 2. Fetch valid team IDs from teams_v2 to ensure referential integrity
  const { data: teams, error: teamError } = await supabase
    .from('teams_v2')
    .select('id');

  if (teamError) {
    console.error('❌ Error fetching teams_v2:', teamError);
    return;
  }

  const validTeamIds = new Set(teams.map(t => t.id));
  const validPlayers = players.filter(p => validTeamIds.has(p.idTeam));

  console.log(`Filtering players... ${validPlayers.length} players have valid teams in teams_v2.`);
  console.log(`Skipped ${players.length - validPlayers.length} players (teams not in v2).`);

  if (validPlayers.length === 0) {
    console.log('⚠️ No players to migrate.');
    return;
  }

  // 3. Insert into players_v2
  // Process in chunks to avoid request size limits
  const CHUNK_SIZE = 100;
  let insertedCount = 0;

  for (let i = 0; i < validPlayers.length; i += CHUNK_SIZE) {
    const chunk = validPlayers.slice(i, i + CHUNK_SIZE).map(p => ({
      idPlayer: p.idPlayer,
      idTeam: p.idTeam,
      strTeam: p.strTeam,
      strPlayer: p.strPlayer,
      strPosition: p.strPosition,
      strNumber: p.strNumber,
      strNationality: p.strNationality,
      strHeight: p.strHeight,
      strWeight: p.strWeight,
      dateBorn: p.dateBorn,
      strThumb: p.strThumb,
      strBirthLocation: p.strBirthLocation,
      created_at: p.created_at
    }));

    const { error: insertError } = await supabase
      .from('players_v2')
      .upsert(chunk, { onConflict: 'idPlayer' });

    if (insertError) {
      console.error(`❌ Error inserting chunk ${i/CHUNK_SIZE}:`, insertError);
    } else {
      insertedCount += chunk.length;
      process.stdout.write('.');
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   - Total Migrated: ${insertedCount}`);
}

migratePlayers();
