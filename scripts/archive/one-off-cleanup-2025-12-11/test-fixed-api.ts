import { fetchKLeague1UpcomingFixtures, fetchKLeague2UpcomingFixtures } from '../src/lib/thesportsdb-api.ts';

async function testFixedAPI() {
  console.log('🧪 Testing fixed K League API functions...\n');
  
  console.log('📊 K League 1 Upcoming Fixtures:');
  const kLeague1 = await fetchKLeague1UpcomingFixtures();
  console.log(`Count: ${kLeague1.length}`);
  if (kLeague1.length > 0) {
    console.log('Sample fixtures:');
    kLeague1.slice(0, 3).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.home_team.name} vs ${f.away_team.name}`);
      console.log(`     Date: ${f.date_local}, Status: ${f.status}`);
    });
  }
  console.log('');
  
  console.log('📊 K League 2 Upcoming Fixtures:');
  const kLeague2 = await fetchKLeague2UpcomingFixtures();
  console.log(`Count: ${kLeague2.length}`);
  if (kLeague2.length > 0) {
    console.log('Sample fixtures:');
    kLeague2.slice(0, 3).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.home_team.name} vs ${f.away_team.name}`);
      console.log(`     Date: ${f.date_local}, Status: ${f.status}`);
    });
  }
  console.log('');
  
  console.log('✅ Test Results:');
  console.log(`Total K League 1+2 fixtures: ${kLeague1.length + kLeague2.length}`);
  console.log(`API functions working: ${kLeague1.length > 0 && kLeague2.length > 0 ? 'YES ✅' : 'NO ❌'}`);
}

testFixedAPI().catch(console.error);
