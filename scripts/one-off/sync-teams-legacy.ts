
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

async function syncLegacyTeams() {
  console.log('🚀 Syncing teams from teams_v2 to legacy teams table...');

  // 1. Get all teams from teams_v2
  const { data: teamsV2, error: fetchError } = await supabase
    .from('teams_v2')
    .select('*');

  if (fetchError) {
    console.error('Error fetching teams_v2:', fetchError);
    return;
  }

  console.log(`Found ${teamsV2.length} teams in teams_v2.`);

  // 2. Prepare payload for teams table
  // Mapping: id -> idTeam, name -> strTeam, badgeUrl -> strBadge
  // Note: teams table might require other fields, but let's try minimal insert first.
  const legacyTeams = teamsV2.map(t => ({
    idTeam: t.id,
    strTeam: t.name,
    strBadge: t.badgeUrl,
    // Add other fields if necessary, e.g., idLeague if we can infer it or just leave null
    // If strTeamShort is required, map it or use null
  }));

  // 3. Upsert into teams table
  const { error: upsertError } = await supabase
    .from('teams')
    .upsert(legacyTeams, { onConflict: 'idTeam' });

  if (upsertError) {
    console.error('❌ Error syncing legacy teams:', upsertError);
  } else {
    console.log(`✅ Successfully synced ${legacyTeams.length} teams to legacy table.`);
  }
}

syncLegacyTeams();
