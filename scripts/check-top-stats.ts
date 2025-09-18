import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  process.env.VITE_SUPABASE_ANON_KEY || 'test-anon'
);

async function checkImportedData() {
  console.log('🔍 임포트된 데이터 확인...\n');
  
  // Check top scorers
  const { data: scorers, error: scorersError } = await supabase
    .from('top_scorers')
    .select('*')
    .eq('league_id', 292)
    .order('rank_position')
    .limit(3);
    
  if (!scorersError && scorers?.length > 0) {
    console.log('🏆 K League 1 득점왕 Top 3:');
    scorers.forEach((player, index) => {
      console.log(`  ${index + 1}. ${player.player_name} (${player.team_name}) - ${player.goals}골`);
    });
  } else {
    console.log('❌ 득점왕 데이터 오류:', scorersError);
  }
  
  console.log();
  
  // Check top assists
  const { data: assists, error: assistsError } = await supabase
    .from('top_assists')
    .select('*')
    .eq('league_id', 292)
    .order('rank_position')
    .limit(3);
    
  if (!assistsError && assists?.length > 0) {
    console.log('🎯 K League 1 도움왕 Top 3:');
    assists.forEach((player, index) => {
      console.log(`  ${index + 1}. ${player.player_name} (${player.team_name}) - ${player.assists}도움`);
    });
  } else {
    console.log('❌ 도움왕 데이터 오류:', assistsError);
  }
  
  // Count total records
  const { count: scorersCount } = await supabase
    .from('top_scorers')
    .select('*', { count: 'exact', head: true });
    
  const { count: assistsCount } = await supabase
    .from('top_assists')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 총 데이터: 득점왕 ${scorersCount}명, 도움왕 ${assistsCount}명`);
}

checkImportedData().catch(console.error);