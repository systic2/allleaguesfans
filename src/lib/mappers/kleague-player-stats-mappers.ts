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
  /** TheSportsDB 생년월일 (YYYY-MM-DD) */
  dateBorn?: string | null;
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
  /** 같은 팀에서 이름이 맞는 선수가 정확히 한 명이 아닌 kleague.com 선수 (생년월일로 다시 찾을 대상) */
  unmatchedKLeagueIds: string[];
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

// 선수 생년월일로 쓸 만한 'YYYY-MM-DD' 만 받는다 (뒤에 시각 'HH:MM[:SS[.fff]][Z|±HH:MM]' 이 붙는 건 허용).
// 없는 날짜('0000-00-00', '2001-02-30'), 1950년 이전, 만 14세가 안 되는 값은 기본값·오류로 보고 버린다
export function birthDateKey(value: string | null | undefined, now: Date = new Date()): string | null {
  const match = (value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const today = now.toISOString().slice(0, 10);
  const latest = `${String(Number(today.slice(0, 4)) - 14).padStart(4, '0')}${today.slice(4)}`;
  return date >= '1950-01-01' && date <= latest ? date : null;
}

/**
 * kleague.com 선수 상세 페이지(record/playerDetail.do, 한국어)에서 생년월일을 'YYYY-MM-DD' 로 꺼낸다.
 * 생년월일 칸은 있는데 값이 없거나 쓸 수 없으면 null, 칸 자체가 없으면(선수 페이지가 아님: 점검·차단·오류 페이지,
 * 바뀐 마크업) undefined.
 */
export function parseKLeagueBirthDate(html: string, now: Date = new Date()): string | null | undefined {
  if (!/<th>\s*생년월일\s*<\/th>/.test(html)) return undefined;
  const match = html.match(/생년월일\s*<\/th>\s*<td>\s*(\d{4})[./-](\d{2})[./-](\d{2})\s*<\/td>/);
  return match ? birthDateKey(`${match[1]}-${match[2]}-${match[3]}`, now) : null;
}

// 이름 비교용 단어. 띄어 쓴 이름('Seon Min Moon')과 붙인 이름('Seon-Min Moon' → seonmin)이 맞도록 상대 이름은
// 이웃한 두 단어를 붙인 것까지 넓혀 본다. 전치사는 세지 않는다
const nameWords = (tokens: string[]) => [...new Set(tokens.filter(t => !NAME_PARTICLES.has(t)))];
const widenedWords = (tokens: string[]) => new Set([...tokens, ...tokens.slice(1).map((t, i) => tokens[i] + t)]);

// 겹치는 이름 단어가 하나라도 있는가 (같은 팀 후보)
function shareNameWord(a: string[], b: string[]): boolean {
  const wideA = widenedWords(a), wideB = widenedWords(b);
  return nameWords(a).some(t => wideB.has(t)) || nameWords(b).some(t => wideA.has(t));
}

// 한쪽 이름 단어(둘 이상)가 모두 다른 쪽에 있는가 (다른 팀 후보). 'Kim Min Su'·'Kim Min Jae' 처럼 일부만 겹치면 아니다
function coveredName(a: string[], b: string[]): boolean {
  const covered = (from: string[], to: string[]) => {
    const words = nameWords(from), target = widenedWords(to);
    return words.length >= 2 && words.every(t => target.has(t));
  };
  return covered(a, b) || covered(b, a);
}

export interface KLeagueMatchOptions {
  /** kleague.com 선수 ID → 생년월일 ('YYYY-MM-DD') */
  birthDates?: ReadonlyMap<string, string>;
  /** 이미 저장된 연결. 생년월일로 남은 유일한 후보가 다른 kleague.com 선수에게 연결돼 있으면 잇지 않는다 */
  storedLinks?: readonly KLeaguePlayerLink[];
}

/**
 * kleague.com 순위 행(영문 이름)을 TheSportsDB 명단 선수와 잇는다. 확실하지 않으면 연결하지 않는 쪽을 택한다
 * (잘못된 선수에 기록이 붙는 것보다 낫다).
 * 1. 같은 팀에서 영문 이름이 일치하는 선수가 정확히 한 명이면 연결한다.
 * 2. 아니면 kleague.com 생년월일이 같은 명단 선수가 정확히 한 명일 때 연결한다. 후보는
 *    - 같은 팀에 이름이 맞는 선수가 여럿이면 그 선수들 중에서만,
 *    - 아니면 같은 팀에서 이름 단어가 하나 이상 겹치거나, 다른 팀에서 한쪽 이름 단어(둘 이상)가 모두 다른 쪽에 있는 선수다.
 *    표기 차이('Seon Min Moon'·'Seon-Min Moon', 'ABDALLAH HLEIHIL'·'Abdallah Hleihel')와 TheSportsDB 명단에
 *    이적이 늦게 반영된 선수(다른 팀 명단에 남아 있음)가 여기서 이어진다. 생년월일 후보가 둘 이상이면 애매한 것으로 본다.
 * 한 명단 선수에 kleague.com 선수 둘 이상이 붙으면 모두 버린다. 명단은 팀별로 감독·코치와 이전 명단을 뺀다(currentRoster).
 */
export function matchKLeaguePlayers(
  rows: KLeagueRankRow[], roster: RosterPlayer[], { birthDates = new Map(), storedLinks = [] }: KLeagueMatchOptions = {}
): KLeagueMatchResult {
  const byTeam = new Map<string, RosterPlayer[]>();
  for (const player of roster) byTeam.set(player.idTeam, [...(byTeam.get(player.idTeam) ?? []), player]);
  const rosterByTeam = new Map<string, { idPlayer: string; idTeam: string; tokens: string[]; birth: string | null }[]>();
  for (const [idTeam, players] of byTeam) {
    rosterByTeam.set(idTeam, currentRoster(players)
      .map(p => ({ idPlayer: String(p.idPlayer), idTeam, tokens: nameTokens(p.strPlayer), birth: birthDateKey(p.dateBorn) }))
      .filter(p => p.tokens.length > 0));
  }
  const allPlayers = [...rosterByTeam.values()].flat();

  const candidates = new Map<string, string>();
  const ambiguousKLeagueIds = new Set<string>();
  const unmatched: { kleaguePlayerId: string; idTeam: string | undefined; tokens: string[]; nameHits: typeof allPlayers }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const kleaguePlayerId = String(row.playerId);
    if (seen.has(kleaguePlayerId)) continue;
    seen.add(kleaguePlayerId);
    const idTeam = KLEAGUE_TEAM_TO_THESPORTSDB[row.teamId];
    const tokens = nameTokens(row.name);
    const hits = (idTeam ? rosterByTeam.get(idTeam) ?? [] : []).filter(p => sameName(tokens, p.tokens));
    if (hits.length === 1) candidates.set(kleaguePlayerId, hits[0].idPlayer);
    else unmatched.push({ kleaguePlayerId, idTeam, tokens, nameHits: hits });
  }

  // 생년월일 연결은 이번에 이름으로 이어진 명단 선수를 후보에서 뺀다 (이름 연결을 밀어내지 않도록)
  const nameMatched = new Set(candidates.values());
  const storedOwner = new Map(storedLinks.map(l => [String(l.idPlayer), String(l.kleaguePlayerId)]));
  for (const { kleaguePlayerId, idTeam, tokens, nameHits } of unmatched) {
    const birth = birthDateKey(birthDates.get(kleaguePlayerId));
    const pool = nameHits.length > 1
      ? nameHits
      : allPlayers.filter(p => p.idTeam === idTeam ? shareNameWord(tokens, p.tokens) : coveredName(tokens, p.tokens));
    const byBirth = birth ? pool.filter(p => p.birth === birth && !nameMatched.has(p.idPlayer)) : [];
    // 애매한지 먼저 본 뒤, 하나 남은 후보가 저장된 연결로 다른 kleague.com 선수 것이면 잇지 않는다
    // (저장된 연결을 빼고 세면 두 선수가 실행마다 번갈아 연결·삭제될 수 있다)
    if (byBirth.length === 1) {
      const owner = storedOwner.get(byBirth[0].idPlayer);
      if (owner === undefined || owner === kleaguePlayerId) candidates.set(kleaguePlayerId, byBirth[0].idPlayer);
    } else if (nameHits.length > 1 || byBirth.length > 1) ambiguousKLeagueIds.add(kleaguePlayerId);
  }

  const claims = new Map<string, number>();
  for (const idPlayer of candidates.values()) claims.set(idPlayer, (claims.get(idPlayer) ?? 0) + 1);
  return {
    links: [...candidates]
      .filter(([, idPlayer]) => claims.get(idPlayer) === 1)
      .map(([kleaguePlayerId, idPlayer]) => ({ kleaguePlayerId, idPlayer })),
    ambiguousKLeagueIds: [...ambiguousKLeagueIds],
    ambiguousPlayerIds: [...claims].filter(([, n]) => n > 1).map(([idPlayer]) => idPlayer),
    unmatchedKLeagueIds: unmatched.map(u => u.kleaguePlayerId),
  };
}

export interface KLeagueBirthDateCacheRow {
  kleaguePlayerId: string;
  /** 페이지에 생년월일이 없었으면 null */
  birthDate: string | null;
  checkedAt: string;
}

/** 생년월일이 없던 선수는 이 기간이 지나야 다시 확인한다 */
export const BIRTH_DATE_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 생년월일 페이지를 받을 kleague.com 선수를 고른다: 이름으로 못 이었고, 캐시에 없거나
 * 생년월일 없이 확인한 지 BIRTH_DATE_RETRY_MS 가 지난 선수. 확인 시각을 읽을 수 없으면 다시 받는다.
 */
export function planBirthDateFetch(
  unmatchedKLeagueIds: string[], cache: KLeagueBirthDateCacheRow[], now: Date = new Date()
): string[] {
  const cached = new Map(cache.map(row => [String(row.kleaguePlayerId), row]));
  return [...new Set(unmatchedKLeagueIds.map(String))].filter(id => {
    const row = cached.get(id);
    if (!row) return true;
    if (row.birthDate) return false;
    const checkedAt = Date.parse(row.checkedAt);
    return Number.isNaN(checkedAt) || now.getTime() - checkedAt >= BIRTH_DATE_RETRY_MS;
  });
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
