// src/lib/mappers/kleague-player-stats-mappers.ts
// K리그 공식 사이트 선수 순위(/record/rankSort.do) 응답을 검증하고 player_statistics 행으로 바꾼다.
// 네트워크·DB 는 scripts/sync/lib/kleague-player-stats.ts 가 담당하고, 여기는 순수 함수만 둔다.

export type KLeagueRecordType = 'GOAL' | 'ASSIST';

// K리그 공식 구단 코드 → TheSportsDB 팀 ID (teams_v2.id). 화면의 팀 링크가 이 ID 를 쓴다.
export const KLEAGUE_TEAM_TO_THESPORTSDB: Record<string, string> = {
  K01: '138117', // 울산
  K02: '138116', // 수원 삼성
  K03: '138112', // 포항
  K04: '139078', // 제주
  K05: '138111', // 전북
  K06: '138106', // 부산
  K07: '139787', // 전남
  K08: '138114', // 성남
  K09: '138115', // 서울
  K10: '139785', // 대전
  K17: '138107', // 대구
  K18: '138110', // 인천
  K20: '139079', // 경남
  K21: '138108', // 강원
  K22: '138109', // 광주
  K26: '139783', // 부천
  K27: '139786', // 안양
  K29: '139789', // 수원FC
  K31: '139788', // 서울E
  K32: '139782', // 안산
  K34: '139784', // 충남아산
  K35: '138113', // 김천
  K36: '144995', // 김포
  K37: '147078', // 충북청주
  K38: '147077', // 천안
  K39: '150531', // 화성
  K40: '152161', // 파주
  K41: '152158', // 김해
  K42: '154522', // 용인
};

export interface KLeagueRankRow {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  goalQty: number | null;
  assistQty: number | null;
  gameQty: number | null;
  warnQty: number | null;
  exitQty: number | null;
}

export interface KLeaguePlayerStatisticsRow {
  idPlayer: string;
  strPlayer: string;
  idTeam: string;
  strTeam: string;
  idLeague: string;
  strSeason: string;
  goals: number;
  assists: number;
  appearances: number;
  yellow_cards: number;
  red_cards: number;
  last_updated: string;
}

/**
 * rankSort.do 응답 본문을 검증해 순위 행을 돌려준다.
 * 문서화되지 않은 엔드포인트라 형식이 바뀌면 잘못된 값을 저장하지 않도록 예외를 던진다.
 */
export function parseRankingResponse(
  body: unknown, year: number, kleagueId: number, recordType: KLeagueRecordType
): KLeagueRankRow[] {
  const label = `${recordType} L${kleagueId} ${year}`;
  const response = body as { resultCode?: unknown; data?: unknown } | null;
  if (response?.resultCode !== '200') throw new Error(`rankSort ${label}: resultCode ${String(response?.resultCode)}`);

  const list = (response.data as { list?: unknown } | null)?.list;
  if (!Array.isArray(list)) throw new Error(`rankSort ${label}: unexpected response shape`);

  // 행에는 연도·리그·종류가 담겨 오지 않으므로, 요청한 기록 기준으로 정렬돼 있는지로 대신 확인한다.
  const sortKey = recordType === 'GOAL' ? 'goalQty' : 'assistQty';
  const rows = list as Partial<KLeagueRankRow>[];
  rows.forEach((row, i) => {
    if (!row.playerId || !row.name || !row.teamId) throw new Error(`rankSort ${label}: row missing player/team fields`);
    if (typeof row.goalQty !== 'number' || typeof row.assistQty !== 'number') {
      throw new Error(`rankSort ${label}: row missing goalQty/assistQty for ${row.name}`);
    }
    if (i > 0 && (rows[i - 1][sortKey] as number) < (row[sortKey] as number)) {
      throw new Error(`rankSort ${label}: rows are not sorted by ${sortKey}`);
    }
  });
  return rows as KLeagueRankRow[];
}

/**
 * 득점·도움 순위를 선수 단위로 합친다. 두 목록 모두 각 선수의 goalQty/assistQty 를 담고 있고,
 * 같은 선수가 양쪽에 있으면 더 큰 값을 쓴다. 매핑되지 않은 구단 코드가 있으면 팀 링크가 깨지므로 예외를 던진다.
 */
export function mergeRankings(
  rankings: KLeagueRankRow[][], idLeague: string, season: string, now: string = new Date().toISOString()
): KLeaguePlayerStatisticsRow[] {
  const byPlayer = new Map<string, KLeaguePlayerStatisticsRow>();
  for (const row of rankings.flat()) {
    const idTeam = KLEAGUE_TEAM_TO_THESPORTSDB[row.teamId];
    if (!idTeam) throw new Error(`Unmapped K League team code ${row.teamId} (${row.teamName}) for ${row.name}`);

    const idPlayer = String(row.playerId);
    const previous = byPlayer.get(idPlayer);
    byPlayer.set(idPlayer, {
      idPlayer,
      strPlayer: row.name,
      idTeam,
      strTeam: row.teamName,
      idLeague,
      strSeason: season,
      goals: Math.max(previous?.goals ?? 0, row.goalQty ?? 0),
      assists: Math.max(previous?.assists ?? 0, row.assistQty ?? 0),
      appearances: Math.max(previous?.appearances ?? 0, row.gameQty ?? 0),
      yellow_cards: Math.max(previous?.yellow_cards ?? 0, row.warnQty ?? 0),
      red_cards: Math.max(previous?.red_cards ?? 0, row.exitQty ?? 0),
      last_updated: now,
    });
  }
  return [...byPlayer.values()];
}

/**
 * 이번 순위에 없는 기존 선수 ID 를 고른다. 순위가 일부만 온 경우를 막기 위해
 * 지울 행이 기존의 20% 를 넘으면 skip 을 true 로 돌려준다.
 */
export function planStaleDeletion(existingIds: string[], keepIds: string[]): { stale: string[]; skip: boolean } {
  const keep = new Set(keepIds);
  const stale = existingIds.filter(id => !keep.has(id));
  return { stale, skip: stale.length > existingIds.length * 0.2 };
}
