// check-round-distribution.ts - Check round distribution in events table
import { supa } from './lib/supabase.js';

async function checkRoundDistribution() {
  console.log('🔍 Checking round distribution in events table...\n');

  try {
    // K League 1 (ID: 4689)
    console.log('📊 K League 1 (4689):');
    const { data: kl1Data } = await supa
      .from('events')
      .select('intRound, strStatus, dateEvent')
      .eq('idLeague', '4689')
      .eq('strSeason', '2025');

    if (kl1Data) {
      // Group by round
      const roundGroups = kl1Data.reduce((acc, event) => {
        const round = event.intRound;
        if (!acc[round]) {
          acc[round] = { finished: 0, notStarted: 0, dates: [] };
        }
        if (event.strStatus === 'Match Finished') {
          acc[round].finished++;
        } else if (event.strStatus === 'Not Started') {
          acc[round].notStarted++;
        }
        acc[round].dates.push(event.dateEvent);
        return acc;
      }, {} as Record<string, { finished: number; notStarted: number; dates: string[] }>);

      Object.keys(roundGroups)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(round => {
          const group = roundGroups[round];
          const minDate = group.dates.sort()[0];
          const maxDate = group.dates.sort().reverse()[0];
          console.log(`   Round ${round}: ${group.finished} finished, ${group.notStarted} not started (${minDate})`);
        });
    }

    // K League 2 (ID: 4822)
    console.log('\n📊 K League 2 (4822):');
    const { data: kl2Data } = await supa
      .from('events')
      .select('intRound, strStatus, dateEvent')
      .eq('idLeague', '4822')
      .eq('strSeason', '2025');

    if (kl2Data) {
      // Group by round
      const roundGroups = kl2Data.reduce((acc, event) => {
        const round = event.intRound;
        if (!acc[round]) {
          acc[round] = { finished: 0, notStarted: 0, dates: [] };
        }
        if (event.strStatus === 'Match Finished') {
          acc[round].finished++;
        } else if (event.strStatus === 'Not Started') {
          acc[round].notStarted++;
        }
        acc[round].dates.push(event.dateEvent);
        return acc;
      }, {} as Record<string, { finished: number; notStarted: number; dates: string[] }>);

      Object.keys(roundGroups)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(round => {
          const group = roundGroups[round];
          const minDate = group.dates.sort()[0];
          console.log(`   Round ${round}: ${group.finished} finished, ${group.notStarted} not started (${minDate})`);
        });
    }

    // Summary
    console.log('\n📅 Current date:', new Date().toISOString().split('T')[0]);
    console.log('\n💡 Expected behavior:');
    console.log('   - Recent matches: Highest round with "Match Finished"');
    console.log('   - Upcoming matches: Lowest round with "Not Started"');

  } catch (err) {
    console.error('Error:', err);
  }
}

checkRoundDistribution().catch(console.error);
