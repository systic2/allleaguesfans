import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function verifyAssisters() {
  console.log('🔍 도움왕 기록 검증\n');

  const officialAssisters = [
    { name: 'Cesinha', team: 'Daegu FC', official: 11 },
    { name: 'Lee Dong-Gyeong', team: 'Gimcheon Sangmu FC', official: 11 },
    { name: 'Anderson', team: 'Suwon City FC', official: 8 },
    { name: 'Jin-su Kim', team: 'FC Seoul', official: 7 },
    { name: 'Yago', team: 'FC Anyang', official: 6 },
    { name: 'Lee Seung-Won', team: 'Gimcheon Sangmu FC', official: 6 },
  ];

  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  for (const player of officialAssisters) {
    // 팀 이름도 포함해서 검색 (Yago처럼 동명이인이 있을 수 있음)
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .ilike('strPlayer', `%${player.name}%`)
      .ilike('strTeam', `%${player.team.split(' ')[0]}%`); // 팀 이름의 첫 단어로 필터링

    if (data && data.length > 0) {
      // 여러 명이 나오면 팀이 정확히 일치하는 선수 선택
      const exactMatch = data.find(p => p.strTeam.includes(player.team.split(' ')[0]));
      const playerData = exactMatch || data[0];

      const diff = player.official - playerData.assists;
      const status = diff === 0 ? '✅' : '❌';
      console.log(`| ${status} ${playerData.strPlayer} | ${playerData.strTeam} | ${player.official} | ${playerData.assists} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${player.name} | ${player.team} | ${player.official} | - | 찾을 수 없음 |`);
    }
  }

  console.log('\n');
}

verifyAssisters().catch(console.error);
