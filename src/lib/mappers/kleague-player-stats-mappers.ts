// src/lib/mappers/kleague-player-stats-mappers.ts
// K리그 공식 사이트 선수 순위(/record/rankSort.do) 응답을 검증하고 player_statistics 행으로 바꾼다.
// 네트워크·DB 는 scripts/sync/lib/kleague-player-stats.ts 가 담당하고, 여기는 순수 함수만 둔다.

import { currentRoster } from '../roster-snapshot';

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
  // 응답에 값이 없으면 null (0 으로 채우지 않는다)
  appearances: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  last_updated: string;
}

// 두 순위 목록에 같은 선수가 있으면 큰 값을 쓰되, 양쪽 모두 값이 없으면 null
function maxKnown(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
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
      appearances: maxKnown(previous?.appearances, row.gameQty),
      yellow_cards: maxKnown(previous?.yellow_cards, row.warnQty),
      red_cards: maxKnown(previous?.red_cards, row.exitQty),
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

export interface RosterPlayer {
  idPlayer: string;
  idTeam: string;
  strPlayer: string | null;
  strPosition: string | null;
  updatedAt: string | null;
}

export interface KLeaguePlayerLink {
  kleaguePlayerId: string;
  idPlayer: string;
}

export interface KLeagueMatchResult {
  links: KLeaguePlayerLink[];
  /** 같은 팀에 이름이 맞는 명단 선수가 둘 이상인 kleague.com 선수 */
  ambiguousKLeagueIds: string[];
  /** kleague.com 선수 둘 이상과 이름이 맞는 명단 선수 */
  ambiguousPlayerIds: string[];
}

// NFD 로 분해되지 않는 라틴 문자
const LATIN_FOLD: Record<string, string> = { 'đ': 'd', 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ı': 'i', 'þ': 'th' };
// 이름 토큰 수를 셀 때 빼는 성 앞 전치사 ('Da Silva' 는 사실상 한 단어)
const NAME_PARTICLES = new Set(['da', 'de', 'do', 'dos', 'das', 'di', 'del', 'van', 'von', 'der', 'la', 'le', 'el', 'bin']);

/** 영문 이름을 비교용 토큰으로: 악센트·대소문자·하이픈·아포스트로피 차이를 없앤다 ('Dae-Won Kim' = 'DAEWON KIM') */
export function nameTokens(name: string | null | undefined): string[] {
  return (name ?? '')
    .toLowerCase()
    .replace(/[đłøæœßıþ]/g, ch => LATIN_FOLD[ch])
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/['’-]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// 한쪽 토큰이 모두 다른 쪽에 있어야 같은 이름으로 본다 (kleague.com 은 풀네임, TheSportsDB 는 줄인 이름이 많다).
// 양쪽 모두 전치사를 뺀 서로 다른 토큰이 둘 이상이어야 한다 ('Marcão', 'Da Silva' 는 다른 선수와 겹치기 쉽다).
function sameName(a: string[], b: string[]): boolean {
  const meaningful = (tokens: string[]) => new Set(tokens.filter(t => !NAME_PARTICLES.has(t))).size;
  if (meaningful(a) < 2 || meaningful(b) < 2) return false;
  const setA = new Set(a), setB = new Set(b);
  const [short, long] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  return [...short].every(token => long.has(token));
}

/**
 * kleague.com 순위 행(영문 이름)을 같은 팀 현재 명단의 TheSportsDB 선수와 잇는다.
 * 같은 팀에서 이름이 일치하는 선수가 정확히 한 명일 때만 연결하고, 한 명단 선수에 kleague.com 선수 둘 이상이
 * 붙으면 모두 버린다. 확실하지 않으면 연결하지 않는 쪽을 택한다(잘못된 선수에 기록이 붙는 것보다 낫다).
 * 명단은 팀별로 감독·코치와 이전 명단을 뺀다(currentRoster).
 */
export function matchKLeaguePlayers(rows: KLeagueRankRow[], roster: RosterPlayer[]): KLeagueMatchResult {
  const byTeam = new Map<string, RosterPlayer[]>();
  for (const player of roster) byTeam.set(player.idTeam, [...(byTeam.get(player.idTeam) ?? []), player]);
  const rosterByTeam = new Map<string, { idPlayer: string; tokens: string[] }[]>();
  for (const [idTeam, players] of byTeam) {
    rosterByTeam.set(idTeam, currentRoster(players)
      .map(p => ({ idPlayer: String(p.idPlayer), tokens: nameTokens(p.strPlayer) }))
      .filter(p => p.tokens.length > 0));
  }

  const candidates = new Map<string, string>();
  const ambiguousKLeagueIds = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    const kleaguePlayerId = String(row.playerId);
    if (seen.has(kleaguePlayerId)) continue;
    seen.add(kleaguePlayerId);
    const idTeam = KLEAGUE_TEAM_TO_THESPORTSDB[row.teamId];
    const tokens = nameTokens(row.name);
    const hits = (idTeam ? rosterByTeam.get(idTeam) ?? [] : []).filter(p => sameName(tokens, p.tokens));
    if (hits.length === 1) candidates.set(kleaguePlayerId, hits[0].idPlayer);
    else if (hits.length > 1) ambiguousKLeagueIds.add(kleaguePlayerId);
  }

  const claims = new Map<string, number>();
  for (const idPlayer of candidates.values()) claims.set(idPlayer, (claims.get(idPlayer) ?? 0) + 1);
  return {
    links: [...candidates]
      .filter(([, idPlayer]) => claims.get(idPlayer) === 1)
      .map(([kleaguePlayerId, idPlayer]) => ({ kleaguePlayerId, idPlayer })),
    ambiguousKLeagueIds: [...ambiguousKLeagueIds],
    ambiguousPlayerIds: [...claims].filter(([, n]) => n > 1).map(([idPlayer]) => idPlayer),
  };
}

/**
 * 이번 매칭 결과를 이미 저장된 연결과 맞춘다. 연결은 1:1 로 유지한다.
 * - 이번에 애매해진 kleague.com 선수·명단 선수의 기존 연결은 지운다.
 * - 이미 연결된 kleague.com 선수는 바꾸지 않는다(다른 선수로 바뀌면 경고만).
 * - 다른 kleague.com 선수가 이미 차지한 명단 선수에는 새로 잇지 않는다.
 */
export function planLinkChanges(result: KLeagueMatchResult, existing: KLeaguePlayerLink[]): {
  insert: KLeaguePlayerLink[]; removeKLeagueIds: string[]; conflicts: KLeaguePlayerLink[];
} {
  const ambiguousK = new Set(result.ambiguousKLeagueIds);
  const ambiguousP = new Set(result.ambiguousPlayerIds);
  const removeKLeagueIds = existing
    .filter(l => ambiguousK.has(l.kleaguePlayerId) || ambiguousP.has(l.idPlayer))
    .map(l => l.kleaguePlayerId);
  const removed = new Set(removeKLeagueIds);
  const kept = existing.filter(l => !removed.has(l.kleaguePlayerId));
  const byKLeague = new Map(kept.map(l => [l.kleaguePlayerId, l.idPlayer]));
  const byPlayer = new Map(kept.map(l => [l.idPlayer, l.kleaguePlayerId]));

  const insert: KLeaguePlayerLink[] = [];
  const conflicts: KLeaguePlayerLink[] = [];
  for (const link of result.links) {
    const current = byKLeague.get(link.kleaguePlayerId);
    if (current === link.idPlayer) continue;
    if (current !== undefined || byPlayer.has(link.idPlayer)) { conflicts.push(link); continue; }
    insert.push(link);
  }
  return { insert, removeKLeagueIds, conflicts };
}
