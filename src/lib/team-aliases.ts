// 팀 검색용 줄임말·별칭. 이름에 그대로 들어 있지 않은 표현만 둔다
// (띄어쓰기 차이는 searchByName 이 따로 처리한다). 키는 teams_v2.id
const TEAM_ALIASES: Record<string, string[]> = {
  '133612': ['맨유', 'man utd', 'mufc'], // Manchester United
  '133613': ['맨시티', 'man city', 'mcfc'], // Manchester City
  '133616': ['스퍼스', 'spurs'], // Tottenham Hotspur
  '133604': ['아스날'], // Arsenal
  '133739': ['바르사', '바르샤', 'barca'], // Barcelona
  '133729': ['아틀마', 'AT마드리드', 'atleti'], // Atlético Madrid
  '133650': ['돌문', 'bvb'], // Borussia Dortmund
  '133714': ['psg', '파리sg'], // Paris Saint-Germain
  '133676': ['유베'], // Juventus
  '133681': ['인테르'], // Inter Milan
  '138117': ['울산 현대'], // Ulsan HD (옛 이름)
  '139078': ['제주 유나이티드'], // Jeju SK (옛 이름)
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/** 검색어가 별칭의 일부와 맞는 팀 ID 목록 */
export function findTeamIdsByAlias(query: string): string[] {
  const q = normalize(query);
  if (!q) return [];
  return Object.entries(TEAM_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => normalize(alias).includes(q)))
    .map(([id]) => id);
}
