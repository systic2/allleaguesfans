import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

interface KLeaguePlayerRecord {
  playerName: string;
  teamName: string;
  goal: number;
  assist: number;
  [key: string]: any;
}

interface KLeagueApiResponse {
  result: 'success' | 'error';
  data?: KLeaguePlayerRecord[];
  message?: string;
}

/**
 * K League 공식 API에서 선수 기록 가져오기
 *
 * @param leagueId 1 = K League 1, 2 = K League 2
 * @param year 시즌 연도 (예: 2025)
 * @param recordType 'goal' | 'assist' | 'offensePoint' 등
 */
async function fetchKLeaguePlayerRecords(
  leagueId: 1 | 2,
  year: number,
  recordType: string = 'goal'
): Promise<KLeaguePlayerRecord[]> {
  const url = 'https://www.kleague.com/api/playerRecord.do';

  const formData = new URLSearchParams({
    leagueId: leagueId.toString(),
    year: year.toString(),
    recordType: recordType
  });

  console.log(`\n🔍 K League ${leagueId} ${year} ${recordType} 기록 가져오는 중...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // K League API 응답 구조: { resultCode, resultMsg, data: { goal: { league1: [...], league2: [...] } } }
    if (data.resultCode === '200' && data.data) {
      const leagueKey = leagueId === 1 ? 'league1' : 'league2';
      const recordData = data.data[recordType]?.[leagueKey];

      if (Array.isArray(recordData)) {
        console.log(`✅ ${recordData.length}명의 선수 기록을 가져왔습니다.`);
        return recordData.map((player: any) => ({
          playerName: player.name,
          teamName: player.teamName,
          goal: player.qty || 0,
          assist: player.qty || 0,
          ...player
        }));
      }
    }

    console.error('❌ API 응답 오류:', data.resultMsg);
    return [];
  } catch (error) {
    console.error('❌ API 호출 실패:', error);
    return [];
  }
}

/**
 * 득점왕 TOP 10 가져오기
 */
async function getTopScorers(leagueId: 1 | 2, year: number = 2025) {
  console.log(`\n⚽ K League ${leagueId} ${year} 득점왕 TOP 10`);
  console.log('='.repeat(80));

  const scorers = await fetchKLeaguePlayerRecords(leagueId, year, 'goal');

  // 득점 순으로 정렬하고 TOP 10만 가져오기
  const top10 = scorers
    .sort((a, b) => b.goal - a.goal)
    .slice(0, 10);

  console.log('\n| 순위 | 선수명 | 팀 | 득점 |');
  console.log('|------|--------|------|------|');

  top10.forEach((player, index) => {
    console.log(`| ${index + 1} | ${player.playerName} | ${player.teamName} | ${player.goal} |`);
  });

  return top10;
}

/**
 * 도움왕 TOP 10 가져오기
 */
async function getTopAssisters(leagueId: 1 | 2, year: number = 2025) {
  console.log(`\n🎯 K League ${leagueId} ${year} 도움왕 TOP 10`);
  console.log('='.repeat(80));

  const assisters = await fetchKLeaguePlayerRecords(leagueId, year, 'assist');

  // 도움 순으로 정렬하고 TOP 10만 가져오기
  const top10 = assisters
    .sort((a, b) => b.assist - a.assist)
    .slice(0, 10);

  console.log('\n| 순위 | 선수명 | 팀 | 도움 |');
  console.log('|------|--------|------|------|');

  top10.forEach((player, index) => {
    console.log(`| ${index + 1} | ${player.playerName} | ${player.teamName} | ${player.assist} |`);
  });

  return top10;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🏆 K League 공식 통계 가져오기\n');

  // K League 1
  await getTopScorers(1, 2025);
  await getTopAssisters(1, 2025);

  // K League 2
  await getTopScorers(2, 2025);
  await getTopAssisters(2, 2025);

  console.log('\n✅ 모든 통계 가져오기 완료!');
}

main().catch(console.error);
