import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkEvents() {
  console.log('📊 1단계: events 테이블 K League 1 경기 확인\n');

  const { data, error, count } = await supabase
    .from('events')
    .select('idEvent, strEvent, strHomeTeam, strAwayTeam, dateEvent, highlightly_match_id', { count: 'exact' })
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .order('dateEvent', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const withMatchId = data?.filter(e => e.highlightly_match_id) || [];
  const withoutMatchId = data?.filter(e => !e.highlightly_match_id) || [];

  console.log(`총 경기 수: ${count}개`);
  console.log(`\nhighlightly_match_id 있는 경기: ${withMatchId.length}개`);
  console.log(`highlightly_match_id 없는 경기: ${withoutMatchId.length}개`);

  console.log('\n📋 샘플 경기 10개 (highlightly_match_id 없는 것):');
  withoutMatchId.slice(0, 10).forEach(e => {
    console.log(`  ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
  });

  console.log('\n📋 샘플 경기 5개 (highlightly_match_id 있는 것):');
  withMatchId.slice(0, 5).forEach(e => {
    console.log(`  ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam} → ${e.highlightly_match_id}`);
  });
}

checkEvents().catch(console.error);
