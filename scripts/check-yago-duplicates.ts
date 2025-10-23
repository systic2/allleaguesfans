import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkYagoDuplicates() {
  console.log('🔍 Yago Cesar 중복 레코드 확인\n');

  const { data } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idPlayer', '5767335')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  console.log(`총 레코드 수: ${data?.length}개\n`);

  if (data && data.length > 0) {
    data.forEach((p, i) => {
      console.log(`${i + 1}. ${p.strPlayer} (ID: ${p.idPlayer})`);
      console.log(`   팀: ${p.strTeam}`);
      console.log(`   골: ${p.goals}개`);
      console.log(`   도움: ${p.assists}개`);
      console.log(`   출장: ${p.appearances}경기\n`);
    });

    if (data.length > 1) {
      console.log('⚠️  중복 레코드가 발견되었습니다!');
      const totalAssists = data.reduce((sum, p) => sum + p.assists, 0);
      console.log(`총 도움 합계: ${totalAssists}개`);
    }
  } else {
    console.log('❌ Yago Cesar를 찾을 수 없습니다.');
  }
}

checkYagoDuplicates().catch(console.error);
