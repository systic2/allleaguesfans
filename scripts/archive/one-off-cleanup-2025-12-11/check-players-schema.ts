import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log('🔍 Checking player_statistics schema...\n');

  // Check if player_statistics table exists
  const { data: tableData, error: tableError } = await supabase
    .from('player_statistics')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ player_statistics table does not exist or is not accessible');
    console.error('Error:', tableError.message);
    console.log('\n📝 You need to run: scripts/03-create-player-statistics-schema.sql in Supabase SQL Editor\n');
    return false;
  }

  console.log('✅ player_statistics table exists');

  // Check data count
  const { count, error: countError } = await supabase
    .from('player_statistics')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting records:', countError.message);
  } else {
    console.log(`📊 Total records in player_statistics: ${count || 0}`);
  }

  // Check top_scorers view
  const { data: scorersData, error: scorersError } = await supabase
    .from('top_scorers')
    .select('*')
    .limit(1);

  if (scorersError) {
    console.error('❌ top_scorers view does not exist');
    console.error('Error:', scorersError.message);
  } else {
    console.log('✅ top_scorers view exists');
  }

  // Check top_assisters view
  const { data: assistersData, error: assistersError } = await supabase
    .from('top_assisters')
    .select('*')
    .limit(1);

  if (assistersError) {
    console.error('❌ top_assisters view does not exist');
    console.error('Error:', assistersError.message);
  } else {
    console.log('✅ top_assisters view exists');
  }

  // Sample data check
  if (count && count > 0) {
    console.log('\n📋 Sample data:');
    const { data: sampleData } = await supabase
      .from('player_statistics')
      .select('*')
      .order('goals', { ascending: false })
      .limit(3);

    if (sampleData) {
      sampleData.forEach((player, idx) => {
        console.log(`${idx + 1}. ${player.strPlayer} (${player.strTeam}) - Goals: ${player.goals}, Assists: ${player.assists}`);
      });
    }
  } else {
    console.log('\n⚠️ No data in player_statistics table');
    console.log('📝 You need to run: SEASON_YEAR=2025 npx tsx scripts/sync-player-statistics.ts\n');
  }

  return true;
}

checkSchema().then((success) => {
  if (success) {
    console.log('\n✅ Schema check completed');
  }
  process.exit(success ? 0 : 1);
});
