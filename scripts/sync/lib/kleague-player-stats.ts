// scripts/sync/lib/kleague-player-stats.ts
// K리그 1·2 선수 득점/도움 순위를 K리그 공식 사이트에서 가져와 player_statistics 에 반영한다.
//
// 출처: https://www.kleague.com/record/player.do 페이지가 호출하는 /record/rankSort.do (비공개 내부 엔드포인트, 리그·기록별 상위 30명).
// TheSportsDB 에는 K리그 경기 타임라인이 없어 이 경로를 쓴다. 응답 검증·변환은 src/lib/mappers 쪽 순수 함수가 맡는다.
import { supa } from './supabase.js';
import {
  KLEAGUE_TEAM_TO_THESPORTSDB, matchKLeaguePlayers, mergeRankings, parseKLeagueBirthDate, parseRankingResponse,
  planBirthDateFetch, planLinkChanges, planStaleDeletion,
  type KLeagueBirthDateCacheRow, type KLeaguePlayerLink, type KLeagueRankRow, type KLeagueRecordType, type RosterPlayer,
} from '../../../src/lib/mappers/kleague-player-stats-mappers.js';

const RANK_URL = 'https://www.kleague.com/record/rankSort.do';
const PLAYER_DETAIL_URL = 'https://www.kleague.com/record/playerDetail.do';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// 생년월일 페이지: 요청 간격, 요청당 제한 시간, 한 번 실행에서 쓰는 최대 시간, 연속 실패 시 중단
const DETAIL_DELAY_MS = 500;
const DETAIL_TIMEOUT_MS = 10_000;
const DETAIL_BUDGET_MS = 90_000;
const DETAIL_MAX_FAILURES = 3;
const PLAYER_STATISTICS_TABLE = 'player_statistics';
const PLAYER_LINKS_TABLE = 'kleague_player_links';
const BIRTH_DATES_TABLE = 'kleague_player_birthdates';

// K리그 공식 리그 번호 → TheSportsDB 리그 ID
const KLEAGUE_LEAGUES = [
  { kleagueId: 1, idLeague: '4689', name: 'K League 1' },
  { kleagueId: 2, idLeague: '4822', name: 'K League 2' },
] as const;

// 언어 헤더에 따라 선수·구단 이름이 한글/영문으로 바뀐다. 기록은 한글로 저장하고, 영문은 명단과 이을 때만 쓴다
async function fetchRanking(kleagueId: number, year: number, recordType: KLeagueRecordType, language: 'ko' | 'en' = 'ko') {
  const response = await fetch(RANK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Accept-Language': language === 'ko' ? 'ko-KR,ko;q=0.9' : 'en-US,en;q=0.9',
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
  const englishRows: KLeagueRankRow[] = [];

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

      englishRows.push(...await fetchEnglishRankings(league, Number(season), [...goals, ...assists]));
    } catch (error) {
      console.error(`❌ K League player stats failed for ${league.name}:`, error);
      ok = false;
    }
  }

  // 선수 연결은 부가 정보라 실패해도 기록 동기화는 성공으로 둔다 (화면은 연결 없이도 동작). 문제는 경고로 남긴다.
  if (englishRows.length > 0) {
    try {
      await linkKLeaguePlayers(englishRows);
    } catch (error) {
      console.warn('⚠️  K League player links failed:', error);
    }
  }
  return ok;
}

/**
 * 같은 순위를 영문 이름으로 다시 받는다. 한글 순위와 선수 구성이 다르면(빈 응답·순위 갱신 사이 변동) 이 리그는 연결하지 않는다.
 */
async function fetchEnglishRankings(
  league: (typeof KLEAGUE_LEAGUES)[number], year: number, koreanRows: KLeagueRankRow[]
): Promise<KLeagueRankRow[]> {
  try {
    const rows = [
      ...await fetchRanking(league.kleagueId, year, 'GOAL', 'en'),
      ...await fetchRanking(league.kleagueId, year, 'ASSIST', 'en'),
    ];
    const key = (list: KLeagueRankRow[]) => [...new Set(list.map(r => `${r.playerId}:${r.teamId}`))].sort().join(',');
    if (key(rows) !== key(koreanRows)) {
      console.warn(`⚠️  ${league.name}: English rankings differ from Korean rankings. Skipping player links.`);
      return [];
    }
    return rows;
  } catch (error) {
    console.warn(`⚠️  ${league.name}: English rankings failed. Skipping player links.`, error);
    return [];
  }
}

// 선수 상세 페이지(한국어)의 생년월일. 선수 페이지를 못 받으면 'failed', 받았는데 생년월일이 없으면 null
async function fetchBirthDate(kleaguePlayerId: string): Promise<string | null | 'failed'> {
  try {
    const response = await fetch(`${PLAYER_DETAIL_URL}?playerId=${encodeURIComponent(kleaguePlayerId)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(DETAIL_TIMEOUT_MS),
    });
    if (!response.ok) return 'failed';
    const birth = parseKLeagueBirthDate(await response.text());
    return birth === undefined ? 'failed' : birth;
  } catch {
    return 'failed';
  }
}

/**
 * 이름으로 못 이은 선수의 생년월일을 모은다. 받은 값은 kleague_player_birthdates(migration 23)에 두고 다시 받지 않는다.
 * 캐시를 읽지 못하면 생년월일 없이 진행하고 complete 를 false 로 돌려준다(이름 연결만). 페이지 요청은 시간·연속 실패
 * 한도 안에서만 하고, 못 받은 선수는 다음 실행에서 다시 시도한다. 캐시에 저장하지 못한 값은 쓰지 않는다
 * (다음 실행에 없는 값으로 연결이 바뀌지 않도록).
 */
async function loadBirthDates(unmatchedKLeagueIds: string[]): Promise<{
  birthDates: Map<string, string>; complete: boolean; requested: number; failed: number;
}> {
  const birthDates = new Map<string, string>();
  const cache: KLeagueBirthDateCacheRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from(BIRTH_DATES_TABLE)
      .select('kleaguePlayerId, birthDate, checkedAt')
      .order('kleaguePlayerId')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('[DB] ⚠️  Failed to read K League birth dates (migration 23 applied?). Linking by name only:', error);
      return { birthDates, complete: false, requested: 0, failed: 0 };
    }
    cache.push(...data);
    if (data.length < PAGE) break;
  }
  for (const row of cache) if (row.birthDate) birthDates.set(String(row.kleaguePlayerId), row.birthDate);

  const deadline = Date.now() + DETAIL_BUDGET_MS;
  const fetched: KLeagueBirthDateCacheRow[] = [];
  let requested = 0, failed = 0, failedInRow = 0;
  for (const id of planBirthDateFetch(unmatchedKLeagueIds, cache)) {
    if (requested > 0) await new Promise(resolve => setTimeout(resolve, DETAIL_DELAY_MS));
    if (Date.now() > deadline || failedInRow >= DETAIL_MAX_FAILURES) {
      console.warn(`⚠️  K League birth dates: stopped early (${failedInRow >= DETAIL_MAX_FAILURES ? 'repeated failures' : 'time budget'}). The rest are retried next run.`);
      break;
    }
    requested++;
    const birth = await fetchBirthDate(id);
    if (birth === 'failed') {
      failed++;
      failedInRow++;
      continue;
    }
    failedInRow = 0;
    fetched.push({ kleaguePlayerId: id, birthDate: birth, checkedAt: new Date().toISOString() });
  }
  if (fetched.length > 0) {
    const { error } = await supa.from(BIRTH_DATES_TABLE).upsert(fetched, { onConflict: 'kleaguePlayerId' });
    if (error) console.warn('[DB] ⚠️  Failed to cache K League birth dates. Not using them this run:', error);
    else for (const row of fetched) if (row.birthDate) birthDates.set(row.kleaguePlayerId, row.birthDate);
  }
  return { birthDates, complete: true, requested, failed };
}

/**
 * kleague.com 선수 ID 를 players_v2(TheSportsDB) 선수와 잇는다. 같은 팀에서 영문 이름이 맞는 선수가 정확히 한 명이면
 * 잇고, 아니면 kleague.com 생년월일로 한 번 더 찾는다(matchKLeaguePlayers). 저장된 연결과 맞춰 1:1 을 유지한다(planLinkChanges).
 * 같은 사람의 ID 대응이라 순위에서 빠져도 연결은 남긴다. 실패는 경고만 남긴다.
 */
async function linkKLeaguePlayers(rows: KLeagueRankRow[]): Promise<void> {
  const roster: RosterPlayer[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from('players_v2')
      .select('idPlayer, idTeam, strPlayer, strPosition, updated_at, dateBorn')
      .in('idTeam', Object.values(KLEAGUE_TEAM_TO_THESPORTSDB))
      .order('idPlayer')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('[DB] ⚠️  Failed to load K League rosters for player links:', error);
      return;
    }
    roster.push(...data.map(({ updated_at, ...p }) => ({ ...p, updatedAt: updated_at ?? null })));
    if (data.length < PAGE) break;
  }

  const existing: KLeaguePlayerLink[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from(PLAYER_LINKS_TABLE)
      .select('kleaguePlayerId, idPlayer')
      .order('kleaguePlayerId')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('[DB] ⚠️  Failed to read K League player links (migration 22 applied?):', error);
      return;
    }
    existing.push(...data);
    if (data.length < PAGE) break;
  }

  // 저장된 연결도 매번 같은 기준으로 다시 맞춰 보므로, 이름으로 못 이은 선수는 연결 여부와 관계없이 생년월일을 쓴다(캐시)
  const { birthDates, complete, requested, failed } = await loadBirthDates(matchKLeaguePlayers(rows, roster).unmatchedKLeagueIds);
  const result = matchKLeaguePlayers(rows, roster, { birthDates, storedLinks: existing });
  // 생년월일 캐시를 못 읽은 실행에서는 생년월일로 이었던 연결이 애매해 보일 수 있어, 애매함을 이유로 지우지 않는다
  // (지우지 않은 연결과 겹치는 새 연결은 planLinkChanges 가 충돌로 거른다)
  const { insert, removeKLeagueIds, conflicts } = planLinkChanges(
    complete ? result : { ...result, ambiguousKLeagueIds: [], ambiguousPlayerIds: [] }, existing
  );
  for (const c of conflicts) console.warn(`⚠️  K League player link not saved (conflicts with a stored link): ${c.kleaguePlayerId} -> ${c.idPlayer}`);

  if (removeKLeagueIds.length > 0) {
    const { error } = await supa.from(PLAYER_LINKS_TABLE).delete().in('kleaguePlayerId', removeKLeagueIds);
    if (error) {
      console.warn('[DB] ⚠️  Failed to remove ambiguous K League player links:', error);
      return;
    }
  }
  if (insert.length > 0) {
    const matchedAt = new Date().toISOString();
    const { error } = await supa.from(PLAYER_LINKS_TABLE).insert(insert.map(link => ({ ...link, matchedAt })));
    if (error) {
      console.warn('[DB] ⚠️  K League player links insert failed:', error);
      return;
    }
  }
  const ranked = new Set(rows.map(r => String(r.playerId))).size;
  console.log(`[DB] ✅ K League player links: ${result.links.length}/${ranked} matched, birth date pages ${requested} requested / ${failed} failed (new ${insert.length}, removed ${removeKLeagueIds.length}, conflicts ${conflicts.length}).`);
}
