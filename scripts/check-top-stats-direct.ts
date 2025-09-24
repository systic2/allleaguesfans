import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('   VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL);
  console.log('   SUPABASE_URL:', !!process.env.SUPABASE_URL);
  console.log('   SUPABASE_SERVICE_ROLE:', !!process.env.SUPABASE_SERVICE_ROLE);
  console.log('   VITE_SUPABASE_ANON_KEY:', !!process.env.VITE_SUPABASE_ANON_KEY);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductionTopStats() {
  console.log('🔍 Checking production database for top_scorers and top_assists tables...');
  console.log('🔗 Using URL:', supabaseUrl?.substring(0, 30) + '...');

  try {
    // Check top_scorers data
    console.log('\n📊 Checking top_scorers table...');
    const { data: _scorers, error: scorersError, count: scorersCount } = await supabase
      .from('top_scorers')
      .select('*', { count: 'exact', head: true });

    if (scorersError) {
      console.error('❌ top_scorers error:', scorersError.message);
      console.error('   Code:', scorersError.code);
      console.error('   Details:', scorersError.details);
    } else {
      console.log('✅ top_scorers count:', scorersCount || 0);
    }

    // Check top_assists data  
    console.log('\n📊 Checking top_assists table...');
    const { data: _assists, error: assistsError, count: assistsCount } = await supabase
      .from('top_assists')  
      .select('*', { count: 'exact', head: true });

    if (assistsError) {
      console.error('❌ top_assists error:', assistsError.message);
      console.error('   Code:', assistsError.code);
      console.error('   Details:', assistsError.details);
    } else {
      console.log('✅ top_assists count:', assistsCount || 0);
    }

    // Sample data from top_scorers if exists
    if (!scorersError && scorersCount && scorersCount > 0) {
      console.log('\n🔍 Sample top_scorers data...');
      const { data: sampleScorers } = await supabase
        .from('top_scorers')
        .select('league_id, season_year, player_name, team_name, goals, rank_position')
        .limit(5);
      
      console.log('📊 Top 5 scorers:', sampleScorers);
    }

    // Sample data from top_assists if exists
    if (!assistsError && assistsCount && assistsCount > 0) {
      console.log('\n🔍 Sample top_assists data...');
      const { data: sampleAssists } = await supabase
        .from('top_assists')
        .select('league_id, season_year, player_name, team_name, assists, rank_position')
        .limit(5);
      
      console.log('📊 Top 5 assists:', sampleAssists);
    }

    // Check for specific league data (K League 1 = 292, K League 2 = 293)
    console.log('\n🔍 Checking for K League data specifically...');
    
    const { data: _kLeagueScorers, count: kLeagueScorerCount } = await supabase
      .from('top_scorers')
      .select('*', { count: 'exact', head: true })
      .in('league_id', [292, 293])
      .eq('season_year', 2025);

    console.log('🏆 K League top_scorers (2025):', kLeagueScorerCount || 0);

    const { data: _kLeagueAssists, count: kLeagueAssistCount } = await supabase
      .from('top_assists')
      .select('*', { count: 'exact', head: true })
      .in('league_id', [292, 293])
      .eq('season_year', 2025);

    console.log('🎯 K League top_assists (2025):', kLeagueAssistCount || 0);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkProductionTopStats();