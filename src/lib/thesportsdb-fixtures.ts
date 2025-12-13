// TheSportsDB 경기 일정 API 함수들
// 사용자 요구사항: schedule API들을 활용해서 리그 페이지 정보 제대로 출력

// Remove unused variable - using import.meta.env directly in function
const BASE_URL_V2 = '/api/thesportsdb'

export interface TheSportsDBEvent {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: number | null
  intAwayScore: number | null
  dateEvent: string
  strTime: string
  strStatus: string
  idHomeTeam: string
  idAwayTeam: string
  strLeague: string
  idLeague: string
  strSeason: string
  intRound: number
  strVenue: string
}

export interface ScheduleResponse {
  events: TheSportsDBEvent[] | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTheSportsDBWithAuth(url: string): Promise<any> {
  try {
    const apiKey = import.meta.env.VITE_THESPORTSDB_API_KEY || import.meta.env.VITE_THESPORTSDB_KEY;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? {
          'X-API-KEY': apiKey,
        } : {}),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('TheSportsDB API Error:', error)
    return null
  }
}

// 1. 리그 향후 경기
export async function fetchLeagueUpcomingFixtures(leagueId: number): Promise<TheSportsDBEvent[]> {
  const url = `${BASE_URL_V2}/schedule/next/league/${leagueId}`
  const data = await fetchTheSportsDBWithAuth(url)
  
  if (data && data.events) {
    return data.events
  }
  
  console.log(`No upcoming fixtures from TheSportsDB for league ${leagueId}`)
  return []
}

// 2. 리그 이전 경기
export async function fetchLeaguePreviousFixtures(leagueId: number): Promise<TheSportsDBEvent[]> {
  const url = `${BASE_URL_V2}/schedule/previous/league/${leagueId}`
  const data = await fetchTheSportsDBWithAuth(url)
  
  if (data && data.events) {
    return data.events
  }
  
  console.log(`No previous fixtures from TheSportsDB for league ${leagueId}`)
  return []
}

// 3. 팀 향후 경기
export async function fetchTeamUpcomingFixtures(teamId: number): Promise<TheSportsDBEvent[]> {
  const url = `${BASE_URL_V2}/schedule/next/team/${teamId}`
  const data = await fetchTheSportsDBWithAuth(url)
  
  if (data && data.events) {
    return data.events
  }
  
  console.log(`No upcoming fixtures from TheSportsDB for team ${teamId}`)
  return []
}

// 4. 팀 이전 경기
export async function fetchTeamPreviousFixtures(teamId: number): Promise<TheSportsDBEvent[]> {
  const url = `${BASE_URL_V2}/schedule/previous/team/${teamId}`
  const data = await fetchTheSportsDBWithAuth(url)
  
  if (data && data.events) {
    return data.events
  }
  
  console.log(`No previous fixtures from TheSportsDB for team ${teamId}`)
  return []
}

// 하이브리드 함수들 - TheSportsDB 우선, 없으면 DB 사용
export async function getLeagueFixturesHybrid(leagueId: number, type: 'upcoming' | 'previous'): Promise<TheSportsDBEvent[]> {
  try {
    // TheSportsDB 매핑 (우리 DB ID → TheSportsDB ID)
    const thesportsdbLeagueId = leagueId === 4001 ? 4689 : 
                               leagueId === 4002 ? 4822 : leagueId
    
    let thesportsdbFixtures: TheSportsDBEvent[] = []
    
    if (type === 'upcoming') {
      thesportsdbFixtures = await fetchLeagueUpcomingFixtures(thesportsdbLeagueId)
    } else {
      thesportsdbFixtures = await fetchLeaguePreviousFixtures(thesportsdbLeagueId)
    }
    
    // TheSportsDB에 데이터가 있으면 사용
    if (thesportsdbFixtures.length > 0) {
      console.log(`Using TheSportsDB data: ${thesportsdbFixtures.length} ${type} fixtures`)
      return thesportsdbFixtures
    }
    
    // 없으면 기존 DB 데이터 사용하도록 빈 배열 반환 (호출자가 처리)
    console.log(`TheSportsDB has no ${type} fixtures for league ${leagueId}, fallback needed`)
    return []
  } catch (error) {
    console.warn(`TheSportsDB API error for league ${leagueId} ${type} fixtures:`, error)
    return []
  }
}

export async function getTeamFixturesHybrid(teamId: number, type: 'upcoming' | 'previous'): Promise<TheSportsDBEvent[]> {
  try {
    let thesportsdbFixtures: TheSportsDBEvent[] = []
    
    if (type === 'upcoming') {
      thesportsdbFixtures = await fetchTeamUpcomingFixtures(teamId)
    } else {
      thesportsdbFixtures = await fetchTeamPreviousFixtures(teamId)
    }
    
    // TheSportsDB에 데이터가 있으면 사용
    if (thesportsdbFixtures.length > 0) {
      console.log(`Using TheSportsDB data: ${thesportsdbFixtures.length} ${type} fixtures for team ${teamId}`)
      return thesportsdbFixtures
    }
    
    // 없으면 기존 DB 데이터 사용하도록 빈 배열 반환
    console.log(`TheSportsDB has no ${type} fixtures for team ${teamId}, fallback needed`)
    return []
  } catch (error) {
    console.warn(`TheSportsDB API error for team ${teamId} ${type} fixtures:`, error)
    return []
  }
}

// 통합 경기 정보 함수 - TheSportsDB와 DB 데이터 조합
export async function getEnhancedLeagueFixtures(leagueId: number) {
  // TheSportsDB에서 데이터 시도
  const upcomingFromAPI = await getLeagueFixturesHybrid(leagueId, 'upcoming')
  const previousFromAPI = await getLeagueFixturesHybrid(leagueId, 'previous')
  
  return {
    upcoming: upcomingFromAPI,
    previous: previousFromAPI,
    hasTheSportsDBData: upcomingFromAPI.length > 0 || previousFromAPI.length > 0,
    dataSource: upcomingFromAPI.length > 0 || previousFromAPI.length > 0 ? 'TheSportsDB' : 'Database'
  }
}