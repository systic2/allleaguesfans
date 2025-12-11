import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function searchEuller() {
  console.log('🔍 Euller/에울레르 검색 중...\n');
  
  // 다양한 철자로 검색
  const searches = [
    'euller',
    'euler', 
    '에울레르',
    'Euller',
    'Euler'
  ];
  
  for (const term of searches) {
    console.log(`\n📋 "${term}" 검색:`);
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('idLeague', '4822')
      .ilike('strPlayer', `%${term}%`)
      .order('assists', { ascending: false });

    if (error) {
      console.error('Error:', error);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ 찾음! ${data.length}명`);
      data.forEach(p => {
        console.log(`  - ${p.strPlayer} (${p.strTeam}): ${p.goals}골 ${p.assists}도움 ${p.appearances}경기`);
      });
    } else {
      console.log(`  ❌ 못 찾음`);
    }
  }
  
  // 안산 그리너스 소속 선수 전체 확인
  console.log('\n\n📋 Ansan Greeners 소속 선수 도움 순위:');
  const { data: ansanPlayers, error: ansanError } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', '4822')
    .ilike('strTeam', '%Ansan%')
    .gte('assists', 3)
    .order('assists', { ascending: false });
    
  if (!ansanError && ansanPlayers) {
    ansanPlayers.forEach(p => {
      console.log(`  ${p.strPlayer}: ${p.goals}골 ${p.assists}도움 ${p.appearances}경기`);
    });
  }
}

searchEuller();
