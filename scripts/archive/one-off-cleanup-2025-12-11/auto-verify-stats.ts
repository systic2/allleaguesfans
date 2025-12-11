import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

interface KLeagueOfficialRecord {
  name: string;
  teamName: string;
  qty: number;
  [key: string]: any;
}

/**
 * K League 공식 API에서 기록 가져오기
 */
async function fetchKLeagueOfficialStats(
  leagueId: 1 | 2,
  year: number,
  recordType: 'goal' | 'assist'
): Promise<KLeagueOfficialRecord[]> {
  const url = 'https://www.kleague.com/api/playerRecord.do';

  const formData = new URLSearchParams({
    leagueId: leagueId.toString(),
    year: year.toString(),
    recordType: recordType
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (data.resultCode === '200' && data.data) {
      const leagueKey = leagueId === 1 ? 'league1' : 'league2';
      const recordData = data.data[recordType]?.[leagueKey];

      if (Array.isArray(recordData)) {
        return recordData;
      }
    }

    return [];
  } catch (error) {
    console.error('❌ API 호출 실패:', error);
    return [];
  }
}

/**
 * 우리 데이터베이스에서 선수 통계 가져오기
 */
async function getOurPlayerStats(leagueId: string, playerName: string) {
  const { data, error } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', `%${playerName}%`)
    .eq('idLeague', leagueId)
    .eq('strSeason', '2025');

  if (error) {
    console.error('데이터베이스 오류:', error);
    return [];
  }

  return data || [];
}

/**
 * K League 1 통계 검증
 */
async function verifyKLeague1Stats() {
  console.log('\n🏆 K League 1 득점왕 검증\n');
  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  const officialScorers = await fetchKLeagueOfficialStats(1, 2025, 'goal');

  for (const official of officialScorers.slice(0, 10)) {
    const ourData = await getOurPlayerStats('4328', official.name);
    const totalGoals = ourData.reduce((sum, p) => sum + (p.goals || 0), 0);
    const diff = official.qty - totalGoals;
    const status = diff === 0 ? '✅' : '❌';
    const recordInfo = ourData.length > 1 ? ` (${ourData.length}개 레코드 합산)` : '';

    if (ourData.length > 0) {
      console.log(`| ${status} ${official.name} | ${official.teamName} | ${official.qty} | ${totalGoals}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${official.name} | ${official.teamName} | ${official.qty} | - | 찾을 수 없음 |`);
    }
  }

  console.log('\n\n🏆 K League 1 도움왕 검증\n');
  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  const officialAssisters = await fetchKLeagueOfficialStats(1, 2025, 'assist');

  for (const official of officialAssisters.slice(0, 10)) {
    const ourData = await getOurPlayerStats('4328', official.name);
    const totalAssists = ourData.reduce((sum, p) => sum + (p.assists || 0), 0);
    const diff = official.qty - totalAssists;
    const status = diff === 0 ? '✅' : '❌';
    const recordInfo = ourData.length > 1 ? ` (${ourData.length}개 레코드 합산)` : '';

    if (ourData.length > 0) {
      console.log(`| ${status} ${official.name} | ${official.teamName} | ${official.qty} | ${totalAssists}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${official.name} | ${official.teamName} | ${official.qty} | - | 찾을 수 없음 |`);
    }
  }
}

/**
 * K League 2 통계 검증
 */
async function verifyKLeague2Stats() {
  console.log('\n\n🏆 K League 2 득점왕 검증\n');
  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  const officialScorers = await fetchKLeagueOfficialStats(2, 2025, 'goal');

  for (const official of officialScorers.slice(0, 10)) {
    const ourData = await getOurPlayerStats('4822', official.name);
    const totalGoals = ourData.reduce((sum, p) => sum + (p.goals || 0), 0);
    const diff = official.qty - totalGoals;
    const status = diff === 0 ? '✅' : '❌';
    const recordInfo = ourData.length > 1 ? ` (${ourData.length}개 레코드 합산)` : '';

    if (ourData.length > 0) {
      console.log(`| ${status} ${official.name} | ${official.teamName} | ${official.qty} | ${totalGoals}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${official.name} | ${official.teamName} | ${official.qty} | - | 찾을 수 없음 |`);
    }
  }

  console.log('\n\n🏆 K League 2 도움왕 검증\n');
  console.log('| 선수 | 팀 | K League 공식 | 우리 데이터 | 차이 |');
  console.log('|------|------|--------------|------------|------|');

  const officialAssisters = await fetchKLeagueOfficialStats(2, 2025, 'assist');

  for (const official of officialAssisters.slice(0, 10)) {
    const ourData = await getOurPlayerStats('4822', official.name);
    const totalAssists = ourData.reduce((sum, p) => sum + (p.assists || 0), 0);
    const diff = official.qty - totalAssists;
    const status = diff === 0 ? '✅' : '❌';
    const recordInfo = ourData.length > 1 ? ` (${ourData.length}개 레코드 합산)` : '';

    if (ourData.length > 0) {
      console.log(`| ${status} ${official.name} | ${official.teamName} | ${official.qty} | ${totalAssists}${recordInfo} | ${diff > 0 ? '+' : ''}${diff} |`);
    } else {
      console.log(`| ❌ ${official.name} | ${official.teamName} | ${official.qty} | - | 찾을 수 없음 |`);
    }
  }
}

async function main() {
  console.log('🔍 K League 공식 통계 자동 검증 시작\n');
  console.log('='.repeat(80));

  await verifyKLeague1Stats();
  await verifyKLeague2Stats();

  console.log('\n\n✅ 검증 완료!');
}

main().catch(console.error);
