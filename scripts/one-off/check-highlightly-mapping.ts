import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  console.log('🔍 Highlightly 매핑 상태 확인\n');

  // 1. events_highlightly_enhanced 테이블 확인
  const { data: mappedData, error: mappedError } = await supabase
    .from('events_highlightly_enhanced')
    .select('idEvent, highlightly_match_id, sync_status')
    .not('highlightly_match_id', 'is', null);

  if (mappedError) {
    console.error('❌ events_highlightly_enhanced 테이블 조회 실패:', mappedError.message);
    return;
  }

  console.log(`✅ events_highlightly_enhanced 테이블:`);
  console.log(`   전체 매핑: ${mappedData?.length || 0}개\n`);

  // sync_status별 통계
  const syncedCount = mappedData?.filter(m => m.sync_status === 'synced').length || 0;
  const otherStatus = (mappedData?.length || 0) - syncedCount;

  console.log(`   sync_status = 'synced': ${syncedCount}개`);
  console.log(`   기타 상태: ${otherStatus}개\n`);

  // 2. events 테이블과 비교
  const { count: finishedCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .eq('strStatus', 'Match Finished');

  console.log(`📊 비교:`);
  console.log(`   완료된 경기 (events): ${finishedCount}개`);
  console.log(`   Highlightly 매핑: ${syncedCount}개`);
  console.log(`   매핑률: ${((syncedCount / (finishedCount || 1)) * 100).toFixed(1)}%\n`);

  // 3. 샘플 데이터 확인
  if (mappedData && mappedData.length > 0) {
    console.log('샘플 매핑 데이터 (최근 5개):');
    mappedData.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. Event ID: ${item.idEvent} → Highlightly: ${item.highlightly_match_id} (${item.sync_status})`);
    });
  }
}

main().catch(console.error);
