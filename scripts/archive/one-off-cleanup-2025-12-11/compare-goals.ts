import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  // Get standings total goals
  const { data: standings } = await supabase
    .from('standings')
    .select('intGoalsScored')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  const totalGoalsInStandings = standings?.reduce((sum, team) => sum + (team.intGoalsScored || 0), 0) || 0;
  console.log('✅ Total goals in standings table:', totalGoalsInStandings);

  // Get player stats total goals
  const { data: stats } = await supabase
    .from('player_statistics')
    .select('goals')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  const totalGoalsInPlayerStats = stats?.reduce((sum, p) => sum + (p.goals || 0), 0) || 0;
  console.log('✅ Total goals in player_statistics:', totalGoalsInPlayerStats);

  const diff = totalGoalsInPlayerStats - totalGoalsInStandings;
  console.log(`\n📊 Difference: ${diff} goals`);

  if (Math.abs(diff) < 10) {
    console.log('✅ Data looks accurate!');
  } else {
    console.log(`⚠️  Large discrepancy detected`);
  }
}

main();
