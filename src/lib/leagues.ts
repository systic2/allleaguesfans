// src/lib/leagues.ts
// 지원 리그의 주소(slug)·한글 이름·표시 순서. DB 조회가 없는 순수 상수라 api.ts 와 분리한다.

// TheSportsDB 리그 ID → 화면 주소(slug)
export const LEAGUE_SLUGS: Record<string, string> = {
  '4689': 'k-league-1', '4822': 'k-league-2', '4328': 'premier-league', '4335': 'la-liga',
  '4332': 'serie-a', '4331': 'bundesliga', '4334': 'ligue-1',
};

export function leagueSlugFor(idLeague: string): string {
  return LEAGUE_SLUGS[idLeague] ?? `league-${idLeague}`;
}

// 리그 한글 이름. 순서는 메뉴·목록 순서 (K리그 우선)
const LEAGUE_NAMES_KO: [slug: string, name: string][] = [
  ['k-league-1', 'K리그1'], ['k-league-2', 'K리그2'], ['premier-league', '프리미어리그'], ['la-liga', '라리가'],
  ['serie-a', '세리에 A'], ['bundesliga', '분데스리가'], ['ligue-1', '리그 1'],
];

export function leagueNameKo(slug: string): string | null {
  return LEAGUE_NAMES_KO.find(([s]) => s === slug)?.[1] ?? null;
}

// 목록에 없는 리그는 뒤로 보낸다
export function compareLeagueSlugs(a: string, b: string): number {
  const rank = (slug: string) => {
    const i = LEAGUE_NAMES_KO.findIndex(([s]) => s === slug);
    return i === -1 ? LEAGUE_NAMES_KO.length : i;
  };
  return rank(a) - rank(b);
}

/** 검색어가 한글 리그 이름에 들어 있는 리그의 TheSportsDB ID (띄어쓰기 무시) */
export function leagueIdsByKoreanName(query: string): string[] {
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return [];
  const slugs = LEAGUE_NAMES_KO.filter(([, name]) => name.toLowerCase().replace(/\s+/g, '').includes(q)).map(([slug]) => slug);
  return Object.keys(LEAGUE_SLUGS).filter(id => slugs.includes(LEAGUE_SLUGS[id]));
}

// K리그는 단일 연도 시즌, 유럽 리그는 7월 시작 시즌 (CLAUDE.md Seasons)
export function seasonFormatFor(idLeague: string): 'single' | 'split' {
  return idLeague === '4689' || idLeague === '4822' ? 'single' : 'split';
}

/** 지원 리그의 TheSportsDB ID (메뉴 순서) */
export function supportedLeagueIds(): string[] {
  return LEAGUE_NAMES_KO.map(([slug]) => Object.keys(LEAGUE_SLUGS).find(id => LEAGUE_SLUGS[id] === slug)!).filter(Boolean);
}

export function leagueIdForSlug(slug: string): string | null {
  return Object.keys(LEAGUE_SLUGS).find(id => LEAGUE_SLUGS[id] === slug) ?? null;
}

/** 시즌 표시: K리그 '2026', 유럽 '2026/27' (DB 는 시작 연도) */
export function seasonLabel(idLeague: string, season: string): string {
  if (seasonFormatFor(idLeague) === 'single' || !/^\d{4}$/.test(season)) return season;
  return `${season}/${String((Number(season) + 1) % 100).padStart(2, '0')}`;
}
