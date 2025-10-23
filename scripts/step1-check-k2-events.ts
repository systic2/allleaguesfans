import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkK2Events() {
  console.log('🔍 K League 2 경기 확인\n');

  // K League 2 경기 조회 (idLeague: 4822)
  const { data, error, count } = await supabase
    .from('events')
    .select('idEvent, strEvent, strHomeTeam, strAwayTeam, dateEvent, highlightly_match_id', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .order('dateEvent', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 K League 2 전체 경기: ${count}개\n`);

  const withMatchId = data?.filter(e => e.highlightly_match_id) || [];
  const withoutMatchId = data?.filter(e => !e.highlightly_match_id) || [];

  console.log(`✅ highlightly_match_id 있음: ${withMatchId.length}개`);
  console.log(`❌ highlightly_match_id 없음: ${withoutMatchId.length}개\n`);

  if (withoutMatchId.length > 0) {
    console.log('📋 매핑 필요한 경기 샘플 (최대 5개):');
    withoutMatchId.slice(0, 5).forEach(e => {
      console.log(`  - ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
    });
  }
}

checkK2Events().catch(console.error);
