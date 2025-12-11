import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkSchema() {
  console.log('🔍 Checking events table schema...\n');

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data[0]) {
    const columns = Object.keys(data[0]).sort();
    console.log('📋 Available columns:');
    columns.forEach(col => console.log(`  - ${col}`));

    console.log('\n🎯 Target column check:');
    console.log(`  highlightly_match_id exists: ${columns.includes('highlightly_match_id') ? '✅ YES' : '❌ NO'}`);

    if (!columns.includes('highlightly_match_id')) {
      console.log('\n⚠️  Column does not exist. Need to run:');
      console.log('   ALTER TABLE events ADD COLUMN highlightly_match_id TEXT;');
      console.log('   CREATE INDEX idx_events_highlightly_match_id ON events(highlightly_match_id);');
    }
  } else {
    console.log('No events found');
  }
}

checkSchema().catch(console.error);
