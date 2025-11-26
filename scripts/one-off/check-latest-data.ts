// check-latest-data.ts
import { supa } from './lib/supabase.js';

async function checkLatestData() {
  console.log('🔍 Checking latest data in database...\n');

  // Check standings data
  const { data: standings, error: standingsError } = await supa
    .from('standings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('📊 최근 Standings 데이터:');
  if (standingsError) {
    console.error('Error:', standingsError);
  } else if (standings && standings.length > 0) {
    console.log(`Total recent records: ${standings.length}`);
    standings.forEach((s, i) => {
      console.log(`\n${i + 1}. Team: ${s.strTeam}`);
      console.log(`   League: ${s.strLeague}`);
      console.log(`   Season: ${s.strSeason}`);
      console.log(`   Created: ${s.created_at}`);
      console.log(`   Updated: ${s.dateUpdated || 'N/A'}`);
    });
  } else {
    console.log('❌ No standings data found');
  }

  // Check fixtures data
  const { data: fixtures, error: fixturesError } = await supa
    .from('fixtures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n\n⚽ 최근 Fixtures 데이터:');
  if (fixturesError) {
    console.error('Error:', fixturesError);
  } else if (fixtures && fixtures.length > 0) {
    console.log(`Total recent records: ${fixtures.length}`);
    fixtures.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.home_team} vs ${f.away_team}`);
      console.log(`   Date: ${f.date}`);
      console.log(`   Created: ${f.created_at}`);
    });
  } else {
    console.log('❌ No fixtures data found');
  }

  // Check teams data
  const { data: teams, error: teamsError } = await supa
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n\n👥 최근 Teams 데이터:');
  if (teamsError) {
    console.error('Error:', teamsError);
  } else if (teams && teams.length > 0) {
    console.log(`Total recent records: ${teams.length}`);
    teams.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name}`);
      console.log(`   League: ${t.league_name}`);
      console.log(`   Created: ${t.created_at}`);
    });
  } else {
    console.log('❌ No teams data found');
  }
}

checkLatestData().catch(console.error);
