/**
 * API-Football 프록시 API
 * CORS 문제를 해결하기 위해 백엔드를 통해 API-Football 데이터를 가져옵니다.
 */

export interface StandingTeam {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  update: string;
}

/**
 * API-Football 순위표 데이터를 Supabase 서버리스 함수나 백엔드를 통해 가져옵니다
 */
export async function fetchStandingsProxy(leagueId: number, season: number): Promise<StandingTeam[]> {
  try {
    // 개발 환경에서는 Mock 데이터를 사용
    if (import.meta.env.DEV) {
      console.log('🧪 개발 환경 - Mock 순위표 데이터 사용');
      return getMockStandings(leagueId);
    }

    // 프로덕션에서는 백엔드 API를 통해 데이터 가져오기
    const response = await fetch(`/api/standings?league=${leagueId}&season=${season}`);
    
    if (!response.ok) {
      throw new Error(`백엔드 API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    return data.standings;
  } catch (error) {
    console.error('❌ 프록시 순위표 로드 실패:', error);
    // 에러 발생 시 Mock 데이터 반환
    return getMockStandings(leagueId);
  }
}

/**
 * 개발 환경용 Mock 순위표 데이터
 */
function getMockStandings(leagueId: number): StandingTeam[] {
  const kLeague1MockData: StandingTeam[] = [
    {
      rank: 1,
      team: { id: 2762, name: "Jeonbuk Motors", logo: "https://media.api-sports.io/football/teams/2762.png" },
      points: 66,
      goalsDiff: 29,
      group: "K League 1",
      form: "WWLWW",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 20, draw: 6, lose: 3, goals: { for: 58, against: 29 } },
      update: new Date().toISOString()
    },
    {
      rank: 2,
      team: { id: 2768, name: "Gimcheon Sangmu FC", logo: "https://media.api-sports.io/football/teams/2768.png" },
      points: 46,
      goalsDiff: 13,
      group: "K League 1",
      form: "LLWWD",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 13, draw: 7, lose: 9, goals: { for: 42, against: 29 } },
      update: new Date().toISOString()
    },
    {
      rank: 3,
      team: { id: 2750, name: "Daejeon Citizen", logo: "https://media.api-sports.io/football/teams/2750.png" },
      points: 45,
      goalsDiff: 2,
      group: "K League 1",
      form: "LWLLW",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 12, draw: 9, lose: 8, goals: { for: 44, against: 42 } },
      update: new Date().toISOString()
    },
    {
      rank: 4,
      team: { id: 2764, name: "Pohang Steelers", logo: "https://media.api-sports.io/football/teams/2764.png" },
      points: 45,
      goalsDiff: -1,
      group: "K League 1",
      form: "DLWWW",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 13, draw: 6, lose: 10, goals: { for: 39, against: 40 } },
      update: new Date().toISOString()
    },
    {
      rank: 5,
      team: { id: 2759, name: "Gwangju FC", logo: "https://media.api-sports.io/football/teams/2759.png" },
      points: 41,
      goalsDiff: 0,
      group: "K League 1",
      form: "WWLWL",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 11, draw: 8, lose: 10, goals: { for: 38, against: 38 } },
      update: new Date().toISOString()
    },
    {
      rank: 6,
      team: { id: 2746, name: "Gangwon FC", logo: "https://media.api-sports.io/football/teams/2746.png" },
      points: 41,
      goalsDiff: -3,
      group: "K League 1",
      form: "WWWDD",
      status: "same",
      description: "Championship Round",
      all: { played: 29, win: 11, draw: 8, lose: 10, goals: { for: 37, against: 40 } },
      update: new Date().toISOString()
    },
    {
      rank: 7,
      team: { id: 2766, name: "FC Seoul", logo: "https://media.api-sports.io/football/teams/2766.png" },
      points: 40,
      goalsDiff: -1,
      group: "K League 1",
      form: "LLWLD",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 10, draw: 10, lose: 9, goals: { for: 35, against: 36 } },
      update: new Date().toISOString()
    },
    {
      rank: 8,
      team: { id: 2748, name: "FC Anyang", logo: "https://media.api-sports.io/football/teams/2748.png" },
      points: 36,
      goalsDiff: -2,
      group: "K League 1",
      form: "WWWLL",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 11, draw: 3, lose: 15, goals: { for: 40, against: 42 } },
      update: new Date().toISOString()
    },
    {
      rank: 9,
      team: { id: 2767, name: "Ulsan Hyundai FC", logo: "https://media.api-sports.io/football/teams/2767.png" },
      points: 35,
      goalsDiff: -3,
      group: "K League 1",
      form: "DLLLW",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 9, draw: 8, lose: 12, goals: { for: 34, against: 37 } },
      update: new Date().toISOString()
    },
    {
      rank: 10,
      team: { id: 2756, name: "Suwon City FC", logo: "https://media.api-sports.io/football/teams/2756.png" },
      points: 31,
      goalsDiff: -5,
      group: "K League 1",
      form: "LLLWL",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 8, draw: 7, lose: 14, goals: { for: 33, against: 38 } },
      update: new Date().toISOString()
    },
    {
      rank: 11,
      team: { id: 2761, name: "Jeju United FC", logo: "https://media.api-sports.io/football/teams/2761.png" },
      points: 31,
      goalsDiff: -8,
      group: "K League 1",
      form: "LLDDD",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 8, draw: 7, lose: 14, goals: { for: 32, against: 40 } },
      update: new Date().toISOString()
    },
    {
      rank: 12,
      team: { id: 2747, name: "Daegu FC", logo: "https://media.api-sports.io/football/teams/2747.png" },
      points: 22,
      goalsDiff: -21,
      group: "K League 1",
      form: "WWDLD",
      status: "same",
      description: "Relegation Round",
      all: { played: 29, win: 5, draw: 7, lose: 17, goals: { for: 27, against: 48 } },
      update: new Date().toISOString()
    }
  ];

  const kLeague2MockData: StandingTeam[] = [
    {
      rank: 1,
      team: { id: 2750, name: "Bucheon FC 1995", logo: "https://media.api-sports.io/football/teams/2750.png" },
      points: 58,
      goalsDiff: 22,
      group: "K League 2",
      form: "WWWWL",
      status: "same",
      description: "Promotion",
      all: { played: 29, win: 17, draw: 7, lose: 5, goals: { for: 48, against: 26 } },
      update: new Date().toISOString()
    },
    {
      rank: 2,
      team: { id: 2751, name: "Seoul E-Land FC", logo: "https://media.api-sports.io/football/teams/2751.png" },
      points: 52,
      goalsDiff: 15,
      group: "K League 2",
      form: "WDWLW",
      status: "same",
      description: "Promotion Playoff",
      all: { played: 29, win: 15, draw: 7, lose: 7, goals: { for: 42, against: 27 } },
      update: new Date().toISOString()
    }
  ];

  return leagueId === 292 ? kLeague1MockData : kLeague2MockData;
}