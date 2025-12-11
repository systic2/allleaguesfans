import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function verifyK2Stats() {
  console.log('🔍 K League 2 득점왕 기록 검증\n');

  const officialScorers = [
    { name: 'Mugosa', team: 'Incheon United', official: 20 },
    { name: 'Ruiz', team: 'Seongnam FC', official: 16 },
    { name: 'Valdivia', team: 'Jeonnam Dragons', official: 14 },
    { name: 'Ilyuchenko', team: 'Suwon Bluewings', official: 13 },
    { name: 'Bassani', team: 'Bucheon FC', official: 13 },
    { name: 'Fessin', team: 'Busan I Park', official: 12 },
    { name: 'Montano', team: 'Gyeongnam FC', official: 12 },
    { name: 'Serafim', team: 'Suwon Bluewings', official: 12 },
  ];

  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  for (const player of officialScorers) {
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .ilike('strPlayer', `%${player.name}%`)
      .eq('idLeague', '4822')
      .eq('strSeason', '2025');

    if (data && data.length > 0) {
      // 여러 레코드가 있는 경우 합산
      const totalGoals = data.reduce((sum, p) => sum + (p.goals || 0), 0);
      const playerData = data[0];
      const diff = player.official - totalGoals;
      const status = diff === 0 ? '✅' : '❌';
      const recordInfo = data.length > 1 ? ` (${data.length}개 레코드 합산)` : '';
      console.log(`| ${status} ${playerData.strPlayer} | ${playerData.strTeam} | ${player.official} | ${totalGoals}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${player.name} | ${player.team} | ${player.official} | - | 찾을 수 없음 |`);
    }
  }

  console.log('\n\n🔍 K League 2 도움왕 기록 검증\n');

  const officialAssisters = [
    { name: 'Euller', team: 'Seoul E-Land FC', official: 11 },
    { name: 'Gerso', team: 'Incheon United', official: 10 },
    { name: 'Valdivia', team: 'Jeonnam Dragons', official: 9 },
    { name: 'Alberti', team: 'Jeonnam Dragons', official: 8 },
    { name: 'Shin Jae-Won', team: 'Seongnam FC', official: 8 },
    { name: 'Villero', team: 'Busan I Park', official: 7 },
    { name: 'Lee Ki-Je', team: 'Suwon Bluewings', official: 7 },
    { name: 'Ronan', team: 'Jeonnam Dragons', official: 6 },
    { name: 'Han Kyo-Won', team: 'Asan Mugunghwa', official: 6 },
  ];

  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  for (const player of officialAssisters) {
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .ilike('strPlayer', `%${player.name}%`)
      .eq('idLeague', '4822')
      .eq('strSeason', '2025');

    if (data && data.length > 0) {
      // 여러 레코드가 있는 경우 합산
      const totalAssists = data.reduce((sum, p) => sum + (p.assists || 0), 0);
      const playerData = data[0];
      const diff = player.official - totalAssists;
      const status = diff === 0 ? '✅' : '❌';
      const recordInfo = data.length > 1 ? ` (${data.length}개 레코드 합산)` : '';
      console.log(`| ${status} ${playerData.strPlayer} | ${playerData.strTeam} | ${player.official} | ${totalAssists}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${player.name} | ${player.team} | ${player.official} | - | 찾을 수 없음 |`);
    }
  }
}

verifyK2Stats().catch(console.error);
