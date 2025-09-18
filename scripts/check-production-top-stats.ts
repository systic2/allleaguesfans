import { supabase } from '../src/lib/supabaseClient.ts';

async function checkProductionTopStats() {
  console.log('🔍 Checking production database for top_scorers and top_assists tables...');

  try {
    // Check top_scorers data
    const { data: scorers, error: scorersError, count: scorersCount } = await supabase
      .from('top_scorers')
      .select('*', { count: 'exact', head: true });

    if (scorersError) {
      console.error('❌ top_scorers error:', scorersError.message);
      console.error('   Code:', scorersError.code);
      console.error('   Details:', scorersError.details);
    } else {
      console.log('🥅 top_scorers count:', scorersCount || 0);
    }

    // Check top_assists data  
    const { data: assists, error: assistsError, count: assistsCount } = await supabase
      .from('top_assists')  
      .select('*', { count: 'exact', head: true });

    if (assistsError) {
      console.error('❌ top_assists error:', assistsError.message);
      console.error('   Code:', assistsError.code);
      console.error('   Details:', assistsError.details);
    } else {
      console.log('🎯 top_assists count:', assistsCount || 0);
    }

    // Sample data from top_scorers if exists
    if (!scorersError) {
      const { data: sampleScorers } = await supabase
        .from('top_scorers')
        .select('league_id, season_year, player_name, team_name, goals')
        .limit(3);
      
      console.log('📊 Sample top_scorers data:', sampleScorers);
    }

    // Sample data from top_assists if exists
    if (!assistsError) {
      const { data: sampleAssists } = await supabase
        .from('top_assists')
        .select('league_id, season_year, player_name, team_name, assists')
        .limit(3);
      
      console.log('📊 Sample top_assists data:', sampleAssists);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkProductionTopStats();