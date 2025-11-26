import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function searchYago() {
  console.log('🔍 Yago 검색 중...\n');

  // Yago로 시작하는 모든 선수 검색
  const { data } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', 'Yago%')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  if (data && data.length > 0) {
    console.log('찾은 선수들:');
    data.forEach(p => {
      console.log(`  ${p.strPlayer} | ${p.strTeam} | 골:${p.goals} 도움:${p.assists}`);
    });
  } else {
    console.log('❌ Yago를 찾을 수 없습니다.');
    console.log('\n🔍 "Cesar"로 검색 시도...\n');

    // Cesar로 검색
    const { data: cesarData } = await supabase
      .from('player_statistics')
      .select('*')
      .ilike('strPlayer', '%Cesar%')
      .eq('idLeague', '4689')
      .eq('strSeason', '2025');

    if (cesarData && cesarData.length > 0) {
      console.log('Cesar가 포함된 선수들:');
      cesarData.forEach(p => {
        console.log(`  ${p.strPlayer} | ${p.strTeam} | 골:${p.goals} 도움:${p.assists}`);
      });
    }
  }
}

searchYago().catch(console.error);
