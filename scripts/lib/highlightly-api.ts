/**
 * Highlightly API 클라이언트
 * CSV 분석 기반 주요 데이터 소스:
 * - 실시간 스코어/이벤트 (높음)
 * - 라인업/경기 통계 (높음, K리그 + Highlightly 결합)
 * - 비디오 하이라이트 (높음, 주요 소스)
 */

export interface HighlightlyConfig {
  apiKey: string
  rateLimit?: { requests: number, window: number }
}

export interface HighlightlyLeague {
  id: number
  name: string
  country?: {
    name: string
    code: string
  }
  countryName?: string
  currentSeason?: {
    year: number
  }
  logo?: string
}

export interface HighlightlyTeam {
  id: number
  name: string
  shortName?: string
  code?: string
  logo?: string
  logoUrl?: string
  country?: {
    name: string
  }
  founded?: number
}

// CSV 전략 기반 추가 인터페이스
export interface HighlightlyMatch {
  id: string
  home_team: {
    id: string
    name: string
    logo?: string
  }
  away_team: {
    id: string
    name: string
    logo?: string
  }
  league: {
    id: string
    name: string
  }
  date: string
  time?: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  score?: {
    home: number
    away: number
  }
  minute?: number
  venue?: {
    name: string
    city?: string
  }
}

export interface HighlightlyLiveEvent {
  id: string
  match_id: string
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty' | 'own_goal'
  team_id: string
  player: {
    id: string
    name: string
    position?: string
  }
  assist_player?: {
    id: string
    name: string
  }
  minute: number
  additional_time?: number
  description?: string
}

export interface HighlightlyLineup {
  match_id: string
  team_id: string
  formation?: string
  starting_eleven: HighlightlyPlayer[]
  substitutes: HighlightlyPlayer[]
  coach?: {
    id: string
    name: string
  }
}

export interface HighlightlyPlayer {
  id: string
  name: string
  jersey_number: number
  position: string
  photo?: string
  statistics?: {
    goals?: number
    assists?: number
    yellow_cards?: number
    red_cards?: number
    minutes_played?: number
  }
}

export interface HighlightlyHighlight {
  id: string
  match_id: string
  title: string
  url: string
  thumbnail?: string
  duration?: number
  type: 'goal' | 'highlight' | 'full_match' | 'extended'
  quality?: string[]
}

export class HighlightlyAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseBody: string
  ) {
    super(`Highlightly API Error ${status}: ${statusText}`)
    this.name = 'HighlightlyAPIError'
  }
}

class RateLimiter {
  private requests: number[] = []

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async wait(): Promise<void> {
    const now = Date.now()
    
    // Remove requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests)
      const waitTime = this.windowMs - (now - oldestRequest)
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    this.requests.push(now)
  }
}

export class HighlightlyAPI {
  private baseUrl: string
  private headers: Record<string, string>
  private rateLimiter: RateLimiter
  
  constructor(config: HighlightlyConfig) {
    // Updated to use Sports API URL structure with correct RapidAPI headers
    this.baseUrl = 'https://sports.highlightly.net/football'
    
    this.headers = {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': config.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.requests ?? 100,
      config.rateLimit?.window ?? 60000 // 60 seconds
    )
  }

  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    await this.rateLimiter.wait()
    
    // Properly construct URL to preserve base path
    const url = new URL(this.baseUrl + endpoint)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })

    console.log(`🌐 Highlightly API: GET ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers
    })

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000
      console.log(`⏳ Rate limited, waiting ${waitTime}ms before retry...`)
      await this.delay(waitTime)
      return this.get<T>(endpoint, params) // Retry once
    }

    if (!response.ok) {
      const responseText = await response.text()
      throw new HighlightlyAPIError(
        response.status, 
        response.statusText,
        responseText
      )
    }

    const data = await response.json()
    console.log(`✅ Highlightly API response: ${Array.isArray(data) ? data.length : 'single'} items`)
    return data
  }

  async getPaged<T>(endpoint: string, params: Record<string, any> = {}): Promise<T[]> {
    const allResults: T[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const response = await this.get<any>(endpoint, { ...params, page })
        
        // Handle different pagination response structures
        const items = response.data || response.results || response
        const itemsArray = Array.isArray(items) ? items : [items]
        
        if (itemsArray.length === 0) {
          hasMore = false
          break
        }
        
        allResults.push(...itemsArray)
        
        // Check pagination conditions
        hasMore = response.hasMore || 
                  response.pagination?.hasNext || 
                  (itemsArray.length > 0 && itemsArray.length >= (params.limit || 50))
        
        page++
        
        // Safety break to prevent infinite loops
        if (page > 100) {
          console.warn('⚠️ Pagination safety break at page 100')
          break
        }
        
      } catch (error) {
        if (error instanceof HighlightlyAPIError && error.status === 404) {
          // No more pages
          break
        }
        throw error
      }
    }

    return allResults
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 기존 메서드들
  async getLeagues(params: { 
    countryCode?: string
    countryName?: string
    leagueName?: string
    season?: number
  } = {}): Promise<HighlightlyLeague[]> {
    const response = await this.get<any>('/leagues', params)
    return response.data || response
  }

  async getTeams(params: {
    leagueId?: number
    countryCode?: string
    teamName?: string
    season?: number
  } = {}): Promise<HighlightlyTeam[]> {
    const response = await this.get<any>('/teams', params)
    return response.data || response
  }

  async getCountries(): Promise<any[]> {
    const response = await this.get<any>('/countries')
    return response.data || response
  }

  /**
   * CSV 전략: 실시간 스코어/이벤트 (주요 소스)
   */
  async getLiveMatches(): Promise<HighlightlyMatch[]> {
    try {
      // API 요구사항에 맞춰 기본 매개변수 제공 (오늘 날짜 기준)
      const today = new Date().toISOString().split('T')[0]
      const response = await this.get<any>('/matches', { date: today })
      const matches = response.data || response.matches || response
      
      // 클라이언트 사이드에서 라이브 매치 필터링
      if (Array.isArray(matches)) {
        return matches.filter((match: any) => 
          match.status === 'live' || 
          match.status === 'in_progress' ||
          match.status === 'playing'
        )
      }
      
      return []
    } catch (error) {
      console.warn('⚠️ Highlightly 실시간 경기 데이터 가져오기 실패:', error)
      // Fallback: 최소 매개변수로 다시 시도
      try {
        const fallbackResponse = await this.get<any>('/matches', { limit: 100 })
        const fallbackMatches = fallbackResponse.data || fallbackResponse.matches || fallbackResponse
        
        if (Array.isArray(fallbackMatches)) {
          return fallbackMatches.filter((match: any) => 
            match.status === 'live' || 
            match.status === 'in_progress' ||
            match.status === 'playing'
          )
        }
      } catch (fallbackError) {
        console.warn('⚠️ Highlightly fallback도 실패:', fallbackError)
      }
      
      return []
    }
  }

  /**
   * 리그별 실시간 경기
   */
  async getLeagueLiveMatches(leagueId: string): Promise<HighlightlyMatch[]> {
    try {
      // 리그 ID와 오늘 날짜로 매치 조회
      const today = new Date().toISOString().split('T')[0]
      const response = await this.get<any>('/matches', { leagueId: leagueId, date: today })
      const matches = response.data || response.matches || response
      
      if (Array.isArray(matches)) {
        return matches.filter((match: any) => 
          match.status === 'live' || match.status === 'in_progress' || match.status === 'playing'
        )
      }
      
      return []
    } catch (error) {
      console.warn(`⚠️ 리그 ${leagueId} 실시간 경기 실패:`, error)
      return []
    }
  }

  /**
   * 경기 상세 정보
   */
  async getMatchDetails(matchId: string): Promise<HighlightlyMatch | null> {
    try {
      const response = await this.get<any>(`/matches/${matchId}`)
      return response.data || response
    } catch (error) {
      console.warn(`⚠️ 경기 ${matchId} 상세 정보 실패:`, error)
      return null
    }
  }

  /**
   * CSV 전략: 실시간 이벤트 (주요 소스)
   */
  async getMatchLiveEvents(matchId: string): Promise<HighlightlyLiveEvent[]> {
    try {
      const response = await this.get<any>(`/matches/${matchId}/events`)
      return response.data || response.events || response
    } catch (error) {
      console.warn(`⚠️ 경기 ${matchId} 이벤트 실패:`, error)
      return []
    }
  }

  /**
   * CSV 전략: 라인업/경기 통계 (K리그와 결합하여 높은 정확도)
   */
  async getMatchLineups(matchId: string): Promise<HighlightlyLineup[]> {
    try {
      const response = await this.get<any>(`/matches/${matchId}/lineups`)
      return response.data || response.lineups || response
    } catch (error) {
      console.warn(`⚠️ 경기 ${matchId} 라인업 실패:`, error)
      return []
    }
  }

  /**
   * CSV 전략: 비디오 하이라이트 (주요 소스)
   */
  async getMatchHighlights(matchId: string): Promise<HighlightlyHighlight[]> {
    try {
      const response = await this.get<any>(`/matches/${matchId}/highlights`)
      return response.data || response.highlights || response
    } catch (error) {
      console.warn(`⚠️ 경기 ${matchId} 하이라이트 실패:`, error)
      return []
    }
  }

  /**
   * 팀별 하이라이트
   */
  async getTeamHighlights(teamId: string, limit: number = 10): Promise<HighlightlyHighlight[]> {
    try {
      const response = await this.get<any>('/highlights', {
        team_id: teamId,
        limit
      })
      return response.data || response.highlights || response
    } catch (error) {
      console.warn(`⚠️ 팀 ${teamId} 하이라이트 실패:`, error)
      return []
    }
  }

  /**
   * 리그 경기 일정 (특정 날짜)
   */
  async getLeagueMatches(leagueId: string, date?: string): Promise<HighlightlyMatch[]> {
    try {
      // 필수 매개변수와 함께 API 호출
      const params: Record<string, any> = { leagueId: leagueId }
      if (date) {
        params.date = date
      } else {
        // 날짜가 없으면 오늘 날짜 사용
        params.date = new Date().toISOString().split('T')[0]
      }

      const response = await this.get<any>('/matches', params)
      return response.data || response.matches || response
    } catch (error) {
      console.warn(`⚠️ 리그 ${leagueId} 경기 일정 실패:`, error)
      return []
    }
  }

  /**
   * 한국 리그 전용 종합 데이터 수집
   * CSV 전략에 따른 주요 데이터 소스로 활용
   */
  async getKoreanLeagueComprehensiveData(): Promise<{
    leagues: HighlightlyLeague[]
    liveMatches: HighlightlyMatch[]
    todayMatches: HighlightlyMatch[]
    highlights: HighlightlyHighlight[]
    dataQuality: {
      live_matches_count: number
      highlights_count: number
      leagues_found: number
      data_freshness: string
    }
  }> {
    console.log('🚀 Highlightly 한국 리그 종합 데이터 수집 시작...')
    
    try {
      // 1. 전체 리그 조회
      console.log('🏆 리그 정보 수집...')
      const allLeagues = await this.getLeagues()
      const koreanLeagues = allLeagues.filter(league => 
        league.country?.name.toLowerCase() === 'south korea' ||
        league.countryName?.toLowerCase() === 'south korea' ||
        league.name.toLowerCase().includes('k league') ||
        league.name.includes('K리그')
      )
      
      console.log(`✅ 한국 리그 발견: ${koreanLeagues.length}개`)
      
      // 2. 실시간 경기 수집
      console.log('📡 실시간 경기 데이터 수집...')
      const allLiveMatches: HighlightlyMatch[] = []
      for (const league of koreanLeagues) {
        try {
          const liveMatches = await this.getLeagueLiveMatches(league.id.toString())
          allLiveMatches.push(...liveMatches)
          console.log(`  📡 ${league.name}: ${liveMatches.length}경기 진행중`)
          await this.delay(200) // API 호출 간격
        } catch (error) {
          console.warn(`⚠️ ${league.name} 실시간 데이터 실패:`, error)
        }
      }

      // 3. 오늘 경기 수집
      console.log('📅 오늘 경기 일정 수집...')
      const today = new Date().toISOString().split('T')[0]
      const todayMatches: HighlightlyMatch[] = []
      
      for (const league of koreanLeagues) {
        try {
          const matches = await this.getLeagueMatches(league.id.toString(), today)
          todayMatches.push(...matches)
          console.log(`  📅 ${league.name}: ${matches.length}경기 예정`)
          await this.delay(200)
        } catch (error) {
          console.warn(`⚠️ ${league.name} 오늘 경기 데이터 실패:`, error)
        }
      }

      // 4. 하이라이트 수집 (최근 경기들)
      console.log('🎥 비디오 하이라이트 수집...')
      const allHighlights: HighlightlyHighlight[] = []
      const recentMatches = [...allLiveMatches, ...todayMatches].slice(0, 5)
      
      for (const match of recentMatches) {
        try {
          const highlights = await this.getMatchHighlights(match.id)
          allHighlights.push(...highlights)
          console.log(`  🎥 ${match.home_team.name} vs ${match.away_team.name}: ${highlights.length}개 하이라이트`)
          await this.delay(300)
        } catch (error) {
          console.warn(`⚠️ 경기 ${match.id} 하이라이트 실패:`, error)
        }
      }

      const dataQuality = {
        live_matches_count: allLiveMatches.length,
        highlights_count: allHighlights.length,
        leagues_found: koreanLeagues.length,
        data_freshness: new Date().toISOString()
      }

      console.log('🎉 Highlightly 한국 리그 데이터 수집 완료!')
      console.log(`📊 수집 요약:`)
      console.log(`  - 리그: ${dataQuality.leagues_found}개`)
      console.log(`  - 실시간 경기: ${dataQuality.live_matches_count}경기`)
      console.log(`  - 오늘 경기: ${todayMatches.length}경기`)
      console.log(`  - 하이라이트: ${dataQuality.highlights_count}개`)

      return {
        leagues: koreanLeagues,
        liveMatches: allLiveMatches,
        todayMatches,
        highlights: allHighlights,
        dataQuality
      }
    } catch (error) {
      console.error('❌ Highlightly 종합 데이터 수집 실패:', error)
      throw error
    }
  }

  /**
   * API 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Highlightly API 연결 테스트...')
      
      // 간단한 리그 조회로 테스트
      const leagues = await this.getLeagues()
      console.log(`✅ Highlightly API 연결 성공 - ${leagues.length}개 리그 발견`)
      
      return true
    } catch (error) {
      console.error('❌ Highlightly API 연결 실패:', error)
      return false
    }
  }
}

// Factory function for easy instantiation
export function createHighlightlyAPI(config: HighlightlyConfig): HighlightlyAPI {
  return new HighlightlyAPI(config)
}

// Export types for use in other modules
export type { 
  HighlightlyConfig, 
  HighlightlyLeague, 
  HighlightlyTeam,
  HighlightlyMatch,
  HighlightlyLiveEvent,
  HighlightlyLineup,
  HighlightlyPlayer,
  HighlightlyHighlight
}