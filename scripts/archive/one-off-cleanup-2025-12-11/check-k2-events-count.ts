import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  // K League 2 finished matches
  const { data: k2Events, count: k2Count } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Match Finished');

  console.log(`\n📊 K League 2 (리그 ID: 4822) 2025시즌:`);
  console.log(`   완료된 경기: ${k2Count}개`);

  // Show latest round
  const rounds = k2Events?.map(e => parseInt(e.intRound || '0')).filter(r => r > 0);
  const maxRound = rounds && rounds.length > 0 ? Math.max(...rounds) : 0;
  console.log(`   최대 라운드: ${maxRound}`);

  // K League 2 teams count
  const { data: k2Teams, count: teamCount } = await supabase
    .from('teams')
    .select('strTeam', { count: 'exact' })
    .eq('idLeague', '4822');

  console.log(`   팀 수: ${teamCount}개`);
  console.log(`\n💡 예상 경기 수: ${teamCount} 팀 × ${maxRound} 라운드 ÷ 2 = ${(teamCount || 0) * maxRound / 2}경기`);

  // Check how many matched with Highlightly
  const { data: matched, count: matchedCount } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .not('highlightly_match_id', 'is', null);

  console.log(`\n🔗 Highlightly 매칭:`);
  console.log(`   매칭된 경기: ${matchedCount}개 / ${k2Count}개`);
  console.log(`   매칭률: ${((matchedCount || 0) / (k2Count || 1) * 100).toFixed(1)}%`);
}

main();
