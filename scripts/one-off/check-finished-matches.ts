import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  console.log('🔍 K League 1 (2025) 완료된 경기 분석\n');

  // 최근 완료된 경기 10개 (라운드 순서대로)
  const { data: finishedMatches, error } = await supabase
    .from('events')
    .select('idEvent, strEvent, intRound, dateEvent, strHomeTeam, strAwayTeam, intHomeScore, intAwayScore')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Match Finished')
    .order('intRound', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ 최근 완료된 경기 10개:\n');
  finishedMatches?.forEach((match, idx) => {
    console.log(`${idx + 1}. [${match.intRound}R] ${match.strHomeTeam} ${match.intHomeScore} - ${match.intAwayScore} ${match.strAwayTeam}`);
    console.log(`   Event ID: ${match.idEvent}`);
    console.log(`   경기 날짜: ${match.dateEvent}\n`);
  });

  // 통계
  const { count: totalMatches } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  const { count: finishedCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Match Finished');

  const { count: notStartedCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Not Started');

  console.log('\n📊 경기 상태 통계:');
  console.log(`  전체 경기: ${totalMatches}개`);
  console.log(`  완료된 경기: ${finishedCount}개`);
  console.log(`  예정된 경기: ${notStartedCount}개`);
  console.log(`  기타 상태: ${(totalMatches || 0) - (finishedCount || 0) - (notStartedCount || 0)}개`);
}

main().catch(console.error);
