// check-events-status.ts - Check actual strStatus values in events table
import { supa } from './lib/supabase.js';

async function checkEventsStatus() {
  console.log('🔍 Checking events status values...\n');

  try {
    // Get distinct status values
    const { data: statusData, error: statusError } = await supa
      .from('events')
      .select('strStatus')
      .limit(1000);

    if (statusError) {
      console.error('Error:', statusError);
      return;
    }

    // Count unique status values
    const statusCounts = statusData?.reduce((acc, event) => {
      const status = event.strStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log('📊 Status values found:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });

    // Get sample events with different statuses
    console.log('\n📋 Sample events:');

    const uniqueStatuses = Object.keys(statusCounts);
    for (const status of uniqueStatuses.slice(0, 3)) {
      const { data: sample } = await supa
        .from('events')
        .select('strHomeTeam, strAwayTeam, dateEvent, strStatus, intRound, intHomeScore, intAwayScore')
        .eq('strStatus', status)
        .limit(2);

      console.log(`\n   Status: "${status}"`);
      sample?.forEach(event => {
        console.log(`   - ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`     Date: ${event.dateEvent}, Round: ${event.intRound}`);
        console.log(`     Score: ${event.intHomeScore || '?'} - ${event.intAwayScore || '?'}`);
      });
    }

    // Check for NULL or empty status
    const { data: nullStatus, error: nullError } = await supa
      .from('events')
      .select('strHomeTeam, strAwayTeam, dateEvent, strStatus, intRound')
      .is('strStatus', null)
      .limit(3);

    if (!nullError && nullStatus && nullStatus.length > 0) {
      console.log('\n⚠️ Events with NULL status:');
      nullStatus.forEach(event => {
        console.log(`   - ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`     Date: ${event.dateEvent}, Round: ${event.intRound}`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkEventsStatus().catch(console.error);
