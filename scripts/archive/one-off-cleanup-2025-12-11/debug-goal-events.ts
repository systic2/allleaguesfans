import { createClient } from '@supabase/supabase-js';

const HIGHLIGHTLY_API_KEY = '097fcd07-9a95-4b4d-8ff0-08db3a387d0a';

async function debugGoalEvents() {
  // Check a sample match with goals
  const matchId = '1141099025'; // Gangwon FC vs FC Anyang (1-1)

  console.log(`🔍 Fetching events for match ${matchId}...\n`);

  const response = await fetch(`https://sports.highlightly.net/football/events/${matchId}`, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  const events = await response.json();

  console.log(`Total events: ${events.length}\n`);

  const goalEvents = events.filter((e: any) => e.type === 'Goal');
  console.log(`Goal events: ${goalEvents.length}\n`);

  goalEvents.forEach((goal: any) => {
    console.log('Goal Event:');
    console.log(JSON.stringify(goal, null, 2));
    console.log('---\n');
  });

  // Check what we stored in database
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
  );

  console.log('\n📊 Checking player_statistics for these players...\n');

  for (const goal of goalEvents) {
    const { data } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('idPlayer', goal.playerId.toString())
      .eq('strSeason', '2025')
      .single();

    if (data) {
      console.log(`✅ ${goal.player}: ${data.goals} goals in database`);
    } else {
      console.log(`❌ ${goal.player}: NOT FOUND in database`);
    }
  }

  // Check total matches processed
  console.log('\n📈 Checking events_highlightly_enhanced...\n');

  const { count: totalMapped } = await supabase
    .from('events_highlightly_enhanced')
    .select('*', { count: 'exact', head: true })
    .eq('sync_status', 'synced');

  console.log(`Total mapped matches: ${totalMapped}`);

  const { data: finishedMatches } = await supabase
    .from('events_highlightly_enhanced')
    .select('highlightly_match_id, live_status')
    .eq('sync_status', 'synced')
    .eq('live_status', 'finished')
    .limit(10);

  console.log(`\nSample finished matches:`);
  finishedMatches?.forEach(m => console.log(`  - Match ${m.highlightly_match_id}: ${m.live_status}`));
}

debugGoalEvents();
