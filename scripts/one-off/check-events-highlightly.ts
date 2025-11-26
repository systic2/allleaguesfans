import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkHighlightlyData() {
  console.log('🔍 Checking events_highlightly_enhanced table...\n');

  // Check total count
  const { count, error: countError } = await supabase
    .from('events_highlightly_enhanced')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error:', countError.message);
    return;
  }

  console.log(`📊 Total records: ${count || 0}\n`);

  if (!count || count === 0) {
    console.log('⚠️  No data in events_highlightly_enhanced table');
    return;
  }

  // Check sample data
  const { data, error } = await supabase
    .from('events_highlightly_enhanced')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error fetching sample data:', error.message);
    return;
  }

  console.log('📋 Sample records:\n');
  data?.forEach((record, idx) => {
    console.log(`${idx + 1}. Event ${record.idEvent}:`);
    console.log(`   League: ${record.idLeague}`);
    console.log(`   Highlightly Match ID: ${record.highlightly_match_id || 'N/A'}`);
    console.log(`   Events: ${JSON.stringify(record.highlightly_events || {}).substring(0, 100)}...`);
    console.log('');
  });

  // Check if events field has actual event data
  const { data: withEvents, error: eventsError } = await supabase
    .from('events_highlightly_enhanced')
    .select('idEvent, highlightly_events')
    .not('highlightly_events', 'is', null)
    .limit(1);

  if (eventsError) {
    console.error('❌ Error checking events:', eventsError.message);
  } else if (withEvents && withEvents.length > 0) {
    console.log('✅ Found records with highlightly_events data');
    console.log('\nSample event data:');
    console.log(JSON.stringify(withEvents[0].highlightly_events, null, 2).substring(0, 500));
  } else {
    console.log('⚠️  No records with highlightly_events data found');
    console.log('The table has match mappings but no actual event data');
  }
}

checkHighlightlyData();
