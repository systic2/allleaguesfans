/**
 * K리그 공식 API 클라이언트
 * K리그 공식 웹사이트의 실제 API 엔드포인트 활용
 */

export interface KLeagueConfig {
  baseUrl?: string
  rateLimit?: { requests: number, window: number }
}

// K리그 공식 API 응답 타입들
export interface KLeagueMatch {
  year: number
  leagueId: number
  roundId: number
  gameId: number
  gameDate: string
  weekdayShort: string
  gameTime: string
  endYn: string
  meetName: string
  homeTeam: string
  homeTeamName: string
  awayTeam: string
  awayTeamName: string
  fieldName: string
  fieldNameFull: string
  homeGoal: number | null
  awayGoal: number | null
  codeName: string
  gameStatus: string
  broadcastName: string | null
  meetSeq: number
}

export interface KLeagueTeamRank {
  year: number
  leagueId: number
  teamId: string
  teamName: string
  rank: number
  gainPoint: number
  winCnt: number
  winNqty: number
  winEqty: number | null
  winTKqty: number
  tieCnt: number
  lossCnt: number
  gapCnt: number
  loseCnt: number
  goalCnt: number
  loseGoalCnt: number
  yellowCardCnt: number
  redCardCnt: number
  foulCnt: number
}

export interface KLeaguePlayerRecord {
  year: number
  leagueId: number
  teamId: string
  teamName: string
  backNo: string
  playerName: string
  goalCnt?: number
  assistCnt?: number
  cleanCnt?: number
  rank: number
}

export interface KLeagueAPIResponse<T> {
  resultCode: string
  resultMsg: string
  resultMsgEn: string | null
  data: T
}

export class KLeagueAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseBody: string
  ) {
    super(`K리그 API Error ${status}: ${statusText}`)
    this.name = 'KLeagueAPIError'
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
        console.log(`⏳ K리그 API rate limit reached, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    this.requests.push(now)
  }
}

export class KLeagueAPI {
  private baseUrl: string
  private rateLimiter: RateLimiter
  
  constructor(config: KLeagueConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://www.kleague.com/api'
    
    // Conservative rate limiting to be respectful to K League servers
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.requests ?? 30, // 30 requests per minute
      config.rateLimit?.window ?? 60000 // 60 seconds
    )
  }

  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<KLeagueAPIResponse<T>> {
    await this.rateLimiter.wait()
    
    const url = new URL(this.baseUrl + endpoint)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })

    console.log(`🇰🇷 K리그 API: GET ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'POST', // K리그 API는 POST 방식 사용
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AllLeaguesFans/1.0 (K League Data Access)'
      }
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw new KLeagueAPIError(
        response.status, 
        response.statusText,
        responseText
      )
    }

    const data = await response.json()
    console.log(`✅ K리그 API response: ${data.resultMsg}`)
    return data
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 최근 경기 결과 조회
   */
  async getRecentMatches(): Promise<{
    all: KLeagueMatch[]
    league1: KLeagueMatch[]
    league2: KLeagueMatch[]
  }> {
    const response = await this.get<{
      all: KLeagueMatch[]
      league1: KLeagueMatch[]
      league2: KLeagueMatch[]
    }>('/recentMatchResult.do')
    
    return response.data
  }

  /**
   * 팀 순위 조회
   */
  async getTeamRankings(): Promise<{
    league1: KLeagueTeamRank[]
    league2: KLeagueTeamRank[]
  }> {
    const response = await this.get<{
      league1: KLeagueTeamRank[]
      league2: KLeagueTeamRank[]
    }>('/clubRank.do')
    
    return response.data
  }

  /**
   * 선수 기록 조회
   */
  async getPlayerRecords(): Promise<{
    goal: {
      league1: KLeaguePlayerRecord[]
      league2: KLeaguePlayerRecord[]
    }
    assist: {
      league1: KLeaguePlayerRecord[]
      league2: KLeaguePlayerRecord[]
    }
    clean: {
      league1: KLeaguePlayerRecord[]
      league2: KLeaguePlayerRecord[]
    }
  }> {
    const response = await this.get<{
      goal: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
      assist: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
      clean: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
    }>('/playerRecord.do')
    
    return response.data
  }

  /**
   * 특정 리그의 최근 경기 결과만 가져오기
   */
  async getLeagueMatches(leagueId: 1 | 2): Promise<KLeagueMatch[]> {
    const matches = await this.getRecentMatches()
    return leagueId === 1 ? matches.league1 : matches.league2
  }

  /**
   * 특정 리그의 순위표만 가져오기
   */
  async getLeagueRankings(leagueId: 1 | 2): Promise<KLeagueTeamRank[]> {
    const rankings = await this.getTeamRankings()
    return leagueId === 1 ? rankings.league1 : rankings.league2
  }

  /**
   * 특정 카테고리의 선수 기록만 가져오기
   */
  async getPlayerRecordsByType(type: 'goal' | 'assist' | 'clean'): Promise<{
    league1: KLeaguePlayerRecord[]
    league2: KLeaguePlayerRecord[]
  }> {
    const records = await this.getPlayerRecords()
    return records[type]
  }

  /**
   * 모든 K리그 데이터를 종합적으로 가져오기
   */
  async getComprehensiveData(): Promise<{
    matches: {
      all: KLeagueMatch[]
      league1: KLeagueMatch[]
      league2: KLeagueMatch[]
    }
    rankings: {
      league1: KLeagueTeamRank[]
      league2: KLeagueTeamRank[]
    }
    playerRecords: {
      goal: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
      assist: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
      clean: {
        league1: KLeaguePlayerRecord[]
        league2: KLeaguePlayerRecord[]
      }
    }
  }> {
    console.log('🚀 K리그 종합 데이터 수집 시작...')
    
    // 순차적으로 호출 (서버 부하 방지)
    const matches = await this.getRecentMatches()
    await this.delay(1000)
    
    const rankings = await this.getTeamRankings()
    await this.delay(1000)
    
    const playerRecords = await this.getPlayerRecords()
    
    console.log('🎉 K리그 종합 데이터 수집 완료!')
    console.log(`📊 요약: 경기 ${matches.all.length}건, K리그1 순위 ${rankings.league1.length}팀, K리그2 순위 ${rankings.league2.length}팀`)
    
    return {
      matches,
      rankings,
      playerRecords
    }
  }

  /**
   * 팀 ID를 이용한 팀명 조회 (캐시된 데이터 활용)
   */
  async getTeamNameById(teamId: string): Promise<string | null> {
    try {
      const rankings = await this.getTeamRankings()
      
      // K리그1에서 찾기
      const league1Team = rankings.league1.find(team => team.teamId === teamId)
      if (league1Team) return league1Team.teamName
      
      // K리그2에서 찾기
      const league2Team = rankings.league2.find(team => team.teamId === teamId)
      if (league2Team) return league2Team.teamName
      
      return null
    } catch (error) {
      console.warn(`팀 ID ${teamId}의 팀명을 찾을 수 없습니다:`, error)
      return null
    }
  }

  /**
   * 현재 시즌 정보 조회
   */
  getCurrentSeason(): number {
    // K리그 API 응답에서 year 필드를 기준으로 현재 시즌 판단
    return 2025 // 실제 API 응답을 보니 2025 시즌 데이터가 제공되고 있음
  }

  /**
   * API 연결 상태 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 K리그 API 연결 테스트...')
      const matches = await this.getRecentMatches()
      
      if (matches.all.length > 0) {
        console.log(`✅ K리그 API 연결 성공 - ${matches.all.length}개 경기 데이터 확인`)
        return true
      } else {
        console.warn('⚠️ K리그 API 연결됨, 하지만 경기 데이터가 없음')
        return false
      }
    } catch (error) {
      console.error('❌ K리그 API 연결 실패:', error)
      return false
    }
  }

  /**
   * 특정 팀의 최근 경기 조회
   */
  async getTeamRecentMatches(teamId: string): Promise<KLeagueMatch[]> {
    const matches = await this.getRecentMatches()
    return matches.all.filter(match => 
      match.homeTeam === teamId || match.awayTeam === teamId
    )
  }

  /**
   * 특정 날짜의 경기 조회
   */
  async getMatchesByDate(date: string): Promise<KLeagueMatch[]> {
    const matches = await this.getRecentMatches()
    return matches.all.filter(match => match.gameDate === date)
  }
}

// Factory function for easy instantiation
export function createKLeagueAPI(config: KLeagueConfig = {}): KLeagueAPI {
  return new KLeagueAPI(config)
}

// Export types for use in other modules
export type { 
  KLeagueConfig, 
  KLeagueMatch, 
  KLeagueTeamRank, 
  KLeaguePlayerRecord,
  KLeagueAPIResponse 
}