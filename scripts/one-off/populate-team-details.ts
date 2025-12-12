
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Need service role for updates
const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.production (need SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchTeamDetailsFromTSDB(teamId: string) {
  try {
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupteam.php?id=${teamId}`);
    const data = await response.json();
    return data.teams ? data.teams[0] : null;
  } catch (error) {
    console.error(`Error fetching TSDB details for team ${teamId}:`, error);
    return null;
  }
}

async function populateTeamDetails() {
  console.log('🚀 Starting Team Details Population...');

  // 1. Get all teams from teams_v2
  const { data: teams, error: fetchError } = await supabase
    .from('teams_v2')
    .select('id, name');

  if (fetchError) {
    console.error('Error fetching teams:', fetchError);
    return;
  }

  console.log(`Found ${teams.length} teams to update.`);

  let updatedCount = 0;

  for (const team of teams) {
    console.log(`Processing ${team.name} (${team.id})...`);
    
    // 2. Fetch details from TheSportsDB
    const tsdbTeam = await fetchTeamDetailsFromTSDB(team.id);
    
    if (!tsdbTeam) {
      console.warn(`⚠️ No data found in TheSportsDB for team ${team.id}`);
      continue;
    }

    // 3. Update teams_v2
    const updates = {
      strStadium: tsdbTeam.strStadium,
      intFormedYear: tsdbTeam.intFormedYear
    };

    const { error: updateError } = await supabase
      .from('teams_v2')
      .update(updates)
      .eq('id', team.id);

    if (updateError) {
      console.error(`❌ Failed to update ${team.name}:`, updateError);
    } else {
      console.log(`✅ Updated ${team.name}: Stadium=${updates.strStadium}, Founded=${updates.intFormedYear}`);
      updatedCount++;
    }
    
    // Be nice to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n🎉 Finished! Updated ${updatedCount}/${teams.length} teams.`);
}

populateTeamDetails();
