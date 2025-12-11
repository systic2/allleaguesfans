// check-events-table.ts
import { supa } from './lib/supabase.js';

async function checkEventsTable() {
  console.log('🔍 Checking events table...\n');

  try {
    // Try to query events table
    const { data, error, count } = await supa
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Events table does not exist or is not accessible');
      console.log('Error:', error.message);
      console.log('\n💡 Solution: Apply events schema first:');
      console.log('   psql -f scripts/pure-thesportsdb-events-schema.sql');
      return false;
    }

    console.log('✅ Events table exists');
    console.log(`   Total records: ${count || 0}`);

    // Get sample data if exists
    const { data: sample, error: sampleError } = await supa
      .from('events')
      .select('*')
      .order('dateEvent', { ascending: false })
      .limit(3);

    if (!sampleError && sample && sample.length > 0) {
      console.log('\n📋 Recent events:');
      sample.forEach((event, i) => {
        console.log(`\n${i + 1}. ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`   Date: ${event.dateEvent}`);
        console.log(`   League: ${event.strLeague}`);
        console.log(`   Score: ${event.intHomeScore || '?'} - ${event.intAwayScore || '?'}`);
      });
    } else {
      console.log('   No event data found (table is empty)');
    }

    return true;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

checkEventsTable().catch(console.error);
