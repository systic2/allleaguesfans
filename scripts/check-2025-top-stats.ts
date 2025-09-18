import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check2025TopStats() {
  console.log('🔍 Checking 2025 K League top stats...');

  // Check K League 1 (292) 2025 season scorers
  const { data: kl1Scorers } = await supabase
    .from('top_scorers')
    .select('player_name, team_name, goals, rank_position')
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .order('rank_position', { ascending: true })
    .limit(10);

  console.log('\n🏆 K League 1 (2025) 득점왕 TOP 10:');
  kl1Scorers?.forEach((scorer, i) => {
    console.log(`${i + 1}. ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골`);
  });

  // Check K League 1 (292) 2025 season assists
  const { data: kl1Assists } = await supabase
    .from('top_assists')
    .select('player_name, team_name, assists, rank_position')
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .order('rank_position', { ascending: true })
    .limit(10);

  console.log('\n🎯 K League 1 (2025) 도움왕 TOP 10:');
  kl1Assists?.forEach((assist, i) => {
    console.log(`${i + 1}. ${assist.player_name} (${assist.team_name}) - ${assist.assists}도움`);
  });

  // Check for empty player names
  const { count: emptyScorers } = await supabase
    .from('top_scorers')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .eq('player_name', '');

  const { count: emptyAssists } = await supabase
    .from('top_assists')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .eq('player_name', '');

  console.log(`\n📊 빈 선수 이름 확인:`);
  console.log(`   득점왕 테이블 빈 이름: ${emptyScorers || 0}개`);
  console.log(`   도움왕 테이블 빈 이름: ${emptyAssists || 0}개`);
}

check2025TopStats();