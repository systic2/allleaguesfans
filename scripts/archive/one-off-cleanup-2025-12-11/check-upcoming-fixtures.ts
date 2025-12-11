import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkUpcomingFixtures() {
  console.log('🔍 Checking upcoming fixtures in database...\n');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Check K League 1 upcoming fixtures
  const { data: kLeague1, error: error1 } = await supabase
    .from('events')
    .select('idEvent, strEvent, dateEvent, strStatus, idLeague, strHomeTeam, strAwayTeam')
    .eq('idLeague', '4689')
    .gte('dateEvent', today)
    .order('dateEvent', { ascending: true })
    .limit(10);
  
  console.log('📊 K League 1 upcoming fixtures:');
  console.log(`Count: ${kLeague1?.length || 0}`);
  if (error1) console.error('Error:', error1);
  if (kLeague1 && kLeague1.length > 0) {
    console.log('Sample fixtures:');
    kLeague1.slice(0, 3).forEach(f => {
      console.log(`  - ${f.dateEvent}: ${f.strHomeTeam} vs ${f.strAwayTeam} (${f.strStatus})`);
    });
  }
  console.log('');
  
  // Check K League 2 upcoming fixtures
  const { data: kLeague2, error: error2 } = await supabase
    .from('events')
    .select('idEvent, strEvent, dateEvent, strStatus, idLeague, strHomeTeam, strAwayTeam')
    .eq('idLeague', '4822')
    .gte('dateEvent', today)
    .order('dateEvent', { ascending: true })
    .limit(10);
  
  console.log('📊 K League 2 upcoming fixtures:');
  console.log(`Count: ${kLeague2?.length || 0}`);
  if (error2) console.error('Error:', error2);
  if (kLeague2 && kLeague2.length > 0) {
    console.log('Sample fixtures:');
    kLeague2.slice(0, 3).forEach(f => {
      console.log(`  - ${f.dateEvent}: ${f.strHomeTeam} vs ${f.strAwayTeam} (${f.strStatus})`);
    });
  }
  console.log('');
  
  // Check all fixtures (any league) from today onwards
  const { data: allUpcoming, error: error3 } = await supabase
    .from('events')
    .select('idEvent, dateEvent, strStatus, idLeague')
    .gte('dateEvent', today)
    .order('dateEvent', { ascending: true })
    .limit(20);
  
  console.log('📊 All upcoming fixtures (any league):');
  console.log(`Count: ${allUpcoming?.length || 0}`);
  if (error3) console.error('Error:', error3);
  console.log('');
  
  // Check status field distribution
  const { data: statusCount, error: error4 } = await supabase
    .from('events')
    .select('strStatus')
    .gte('dateEvent', today);
  
  console.log('📊 Status distribution for upcoming dates:');
  if (statusCount) {
    const distribution = statusCount.reduce((acc: Record<string, number>, row) => {
      const status = row.strStatus || 'null';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log(distribution);
  }
  if (error4) console.error('Error:', error4);
}

checkUpcomingFixtures().catch(console.error);
