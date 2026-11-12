// scripts/sync/lib/kleague-player-stats.ts
// K리그 1·2 선수 득점/도움 순위를 K리그 공식 사이트에서 가져와 player_statistics 에 반영한다.
//
// 출처: https://www.kleague.com/record/player.do 페이지가 호출하는 /record/rankSort.do (비공개 내부 엔드포인트, 리그·기록별 상위 30명).
// TheSportsDB 에는 K리그 경기 타임라인이 없어 이 경로를 쓴다. 응답 검증·변환은 src/lib/mappers 쪽 순수 함수가 맡는다.
import { supa } from './supabase.js';
import {
  mergeRankings, parseRankingResponse, planStaleDeletion, type KLeagueRecordType,
} from '../../../src/lib/mappers/kleague-player-stats-mappers.js';

const RANK_URL = 'https://www.kleague.com/record/rankSort.do';
const PLAYER_STATISTICS_TABLE = 'player_statistics';

// K리그 공식 리그 번호 → TheSportsDB 리그 ID
const KLEAGUE_LEAGUES = [
  { kleagueId: 1, idLeague: '4689', name: 'K League 1' },
  { kleagueId: 2, idLeague: '4822', name: 'K League 2' },
] as const;

async function fetchRanking(kleagueId: number, year: number, recordType: KLeagueRecordType) {
  const response = await fetch(RANK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      // 언어 헤더에 따라 선수·구단 이름이 한글/영문(대문자)으로 바뀌므로 한글로 고정
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    body: JSON.stringify({ year, leagueId: kleagueId, recordType }),
  });
  if (!response.ok) throw new Error(`rankSort ${recordType} L${kleagueId} ${year}: HTTP ${response.status}`);
  return parseRankingResponse(await response.json(), year, kleagueId, recordType);
}

/**
 * K리그 1·2 의 시즌 득점/도움 상위 선수를 player_statistics 에 upsert 하고,
 * 이번 순위에서 빠진 선수 행은 지운다(공식 순위와 같은 목록 유지).
 * 응답이 이상하면 해당 리그는 아무것도 쓰지 않고 실패로 처리한다.
 * Returns true if successful, false if any league failed.
 */
export async function syncKLeaguePlayerStats(season: string): Promise<boolean> {
  console.log(`\n🚀 Starting K League Player Stats Sync (Season ${season})...`);
  let ok = true;

  for (const league of KLEAGUE_LEAGUES) {
    try {
      const goals = await fetchRanking(league.kleagueId, Number(season), 'GOAL');
      const assists = await fetchRanking(league.kleagueId, Number(season), 'ASSIST');

      // 시즌 개막 전에는 두 목록이 모두 비어 있는 게 정상이다. 한쪽만 비면 응답 이상으로 본다.
      if (goals.length === 0 && assists.length === 0) {
        console.log(`🟡 No player rankings yet for ${league.name} ${season}. Skipping.`);
        continue;
      }
      if (goals.length === 0 || assists.length === 0) {
        throw new Error(`incomplete rankings (goals ${goals.length}, assists ${assists.length})`);
      }

      const rows = mergeRankings([goals, assists], league.idLeague, season);

      // 삭제 비율은 이번 upsert 전 기존 행 기준으로 계산해야 신규 선수 때문에 낮아지지 않는다.
      const { data: existing, error: selectError } = await supa
        .from(PLAYER_STATISTICS_TABLE)
        .select('idPlayer')
        .eq('idLeague', league.idLeague)
        .eq('strSeason', season);
      if (selectError) {
        console.error(`[DB] ❌ Failed to list player stats for ${league.name}:`, selectError);
        ok = false;
        continue;
      }

      const { error: upsertError } = await supa
        .from(PLAYER_STATISTICS_TABLE)
        .upsert(rows, { onConflict: 'idPlayer,idLeague,strSeason' });
      if (upsertError) {
        console.error(`[DB] ❌ Player stats upsert failed for ${league.name}:`, upsertError);
        ok = false;
        continue;
      }

      const { stale, skip } = planStaleDeletion(existing.map(r => String(r.idPlayer)), rows.map(r => r.idPlayer));
      if (skip) {
        console.warn(`[DB] ⚠️  Skipping stale cleanup for ${league.name}: ${stale.length}/${existing.length} rows missing from rankings.`);
      } else if (stale.length > 0) {
        const { error: deleteError } = await supa
          .from(PLAYER_STATISTICS_TABLE)
          .delete()
          .eq('idLeague', league.idLeague)
          .eq('strSeason', season)
          .in('idPlayer', stale);
        if (deleteError) {
          console.error(`[DB] ❌ Stale player stats cleanup failed for ${league.name}:`, deleteError);
          ok = false;
          continue;
        }
      }

      console.log(`[DB] ✅ ${league.name}: ${rows.length} players (goals top ${goals.length}, assists top ${assists.length}, removed ${skip ? 0 : stale.length}).`);
    } catch (error) {
      console.error(`❌ K League player stats failed for ${league.name}:`, error);
      ok = false;
    }
  }

  return ok;
}
