import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function testNextRoundFilter() {
  console.log('🧪 Testing next round filter logic...\n');

  const today = new Date().toISOString().split('T')[0];

  // K League 1
  console.log('📊 K League 1 (4689):');
  const { data: kl1Data } = await supabase
    .from('events')
    .select('intRound, strHomeTeam, strAwayTeam, dateEvent, strStatus')
    .eq('idLeague', '4689')
    .eq('strStatus', 'Not Started')
    .gte('dateEvent', today)
    .order('intRound', { ascending: true })
    .order('dateEvent', { ascending: true });

  if (kl1Data && kl1Data.length > 0) {
    const nextRound = kl1Data[0].intRound;
    const nextRoundFixtures = kl1Data.filter(f => f.intRound === nextRound);
    
    console.log(`   Next round: ${nextRound}`);
    console.log(`   Fixtures count: ${nextRoundFixtures.length}`);
    nextRoundFixtures.forEach(f => {
      console.log(`   - ${f.dateEvent}: ${f.strHomeTeam} vs ${f.strAwayTeam}`);
    });
  } else {
    console.log('   No upcoming fixtures');
  }

  console.log('');

  // K League 2
  console.log('📊 K League 2 (4822):');
  const { data: kl2Data } = await supabase
    .from('events')
    .select('intRound, strHomeTeam, strAwayTeam, dateEvent, strStatus')
    .eq('idLeague', '4822')
    .eq('strStatus', 'Not Started')
    .gte('dateEvent', today)
    .order('intRound', { ascending: true })
    .order('dateEvent', { ascending: true });

  if (kl2Data && kl2Data.length > 0) {
    const nextRound = kl2Data[0].intRound;
    const nextRoundFixtures = kl2Data.filter(f => f.intRound === nextRound);
    
    console.log(`   Next round: ${nextRound}`);
    console.log(`   Fixtures count: ${nextRoundFixtures.length}`);
    nextRoundFixtures.forEach(f => {
      console.log(`   - ${f.dateEvent}: ${f.strHomeTeam} vs ${f.strAwayTeam}`);
    });
  } else {
    console.log('   No upcoming fixtures');
  }

  console.log('');
  console.log('✅ Expected results:');
  console.log('   K League 1: Round 33 (6 fixtures)');
  console.log('   K League 2: Round 35 (7 fixtures) - NOT Round 36, 37, 38, 39');
}

testNextRoundFilter().catch(console.error);
