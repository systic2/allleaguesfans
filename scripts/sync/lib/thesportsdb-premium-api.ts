/**
 * TheSportsDB Premium API Client (v2)
 * Premium subscription features with API key authentication
 * Enhanced data coverage and real-time capabilities
 */

export interface TheSportsDBPremiumConfig {
  apiKey: string
  baseUrl?: string
  rateLimit?: { requests: number, window: number }
}

// Extended interfaces for premium features
export interface TheSportsDBPlayer {
  idPlayer: string
  strPlayer: string
  strTeam: string
  idTeam: string
  strSport: string
  intSoccerXMLTeamID?: string
  strNationality?: string
  strPosition?: string
  strHeight?: string
  strWeight?: string
  dateBorn?: string
  strBirthLocation?: string
  strDescriptionEN?: string
  strGender: string
  strSide?: string
  strTwitter?: string
  strInstagram?: string
  strYoutube?: string
  strFacebook?: string
  strWebsite?: string
  strFanart1?: string
  strFanart2?: string
  strFanart3?: string
  strFanart4?: string
  strThumb?: string
  strCutout?: string
  strRender?: string
  strBanner?: string
  strCreativeCommons: string
  strLocked: string
}

export interface TheSportsDBPlayerStatistics {
  idPlayer: string
  strPlayer: string
  idTeam: string
  strTeam: string
  intRank?: string
  intGoals?: string
  intAssists?: string
  intYellowCards?: string
  intRedCards?: string
  intAppearances?: string
  intMinutes?: string
  intGoalsConceded?: string
  intCleanSheets?: string
  strSeason: string
  strLeague: string
}

export interface TheSportsDBLiveScore {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore?: string
  intAwayScore?: string
  strProgress: string
  strStatus: string
  dateEvent: string
  strTime?: string
  strLeague: string
  strSeason: string
  idHomeTeam: string
  idAwayTeam: string
}

export interface TheSportsDBMatchEvent {
  idEvent: string
  idPlayer?: string
  strPlayer?: string
  idAssist?: string
  strAssist?: string
  strEvent: string
  intTime?: string
  strDetail?: string
  strComment?: string
}

export interface TheSportsDBHighlight {
  idEvent: string
  strEvent: string
  strVideo?: string
  strVideoEmbed?: string
  strHighlight?: string
  strThumb?: string
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
        console.log(`⏳ TheSportsDB Premium rate limit reached, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    this.requests.push(now)
  }
}

export class TheSportsDBAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseBody: string
  ) {
    super(`TheSportsDB Premium API Error ${status}: ${statusText}`)
    this.name = 'TheSportsDBPremiumAPIError'
  }
}

export class TheSportsDBPremiumAPI {
  private apiKey: string
  private baseUrl: string
  private rateLimiter: RateLimiter
  
  constructor(config: TheSportsDBPremiumConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://www.thesportsdb.com/api/v2/json'
    
    // Premium API allows higher rate limits
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.requests ?? 100, // 100 requests per minute for premium
      config.rateLimit?.window ?? 60000
    )
  }

  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    await this.rateLimiter.wait()
    
    const url = new URL(this.baseUrl + endpoint)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })

    console.log(`💎 TheSportsDB Premium API v2: GET ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': this.apiKey,
        'User-Agent': 'AllLeaguesFans/1.0 (Premium Integration)'
      }
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw new TheSportsDBAPIError(
        response.status, 
        response.statusText,
        responseText
      )
    }

    const data = await response.json()
    console.log(`✅ TheSportsDB Premium response: ${Object.keys(data).join(', ')}`)
    return data
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Premium Feature: Get live scores with real-time updates
   */
  async getLiveScores(): Promise<TheSportsDBLiveScore[]> {
    const response = await this.get<{ events: TheSportsDBLiveScore[] }>('/livescore/all')
    return response.events || []
  }

  /**
   * Premium Feature: Get live scores for specific league
   */
  async getLeagueLiveScores(leagueId: string): Promise<TheSportsDBLiveScore[]> {
    const response = await this.get<{ events: TheSportsDBLiveScore[] }>(`/livescore/${leagueId}`)
    return response.events || []
  }

  /**
   * Premium Feature: Get detailed match events
   */
  async getMatchEvents(eventId: string): Promise<TheSportsDBMatchEvent[]> {
    const response = await this.get<{ timeline: TheSportsDBMatchEvent[] }>('/timeline.php', {
      e: eventId
    })
    return response.timeline || []
  }

  /**
   * Premium Feature: Get player statistics
   */
  async getPlayerStatistics(playerId: string, season?: string): Promise<TheSportsDBPlayerStatistics[]> {
    const params: Record<string, any> = { id: playerId }
    if (season) params.s = season
    
    const response = await this.get<{ playerstats: TheSportsDBPlayerStatistics[] }>('/playerstats.php', params)
    return response.playerstats || []
  }

  /**
   * Premium Feature: Get team players (squad)
   */
  async getTeamPlayers(teamId: string): Promise<TheSportsDBPlayer[]> {
    const response = await this.get<{ player: TheSportsDBPlayer[] }>(`/list/players/${teamId}`)
    return response.player || []
  }

  /**
   * Premium Feature: Search players
   */
  async searchPlayers(playerName: string): Promise<TheSportsDBPlayer[]> {
    const response = await this.get<{ player: TheSportsDBPlayer[] }>(`/search/player/${encodeURIComponent(playerName)}`)
    return response.player || []
  }

  /**
   * Premium Feature: Get video highlights
   */
  async getMatchHighlights(eventId: string): Promise<TheSportsDBHighlight[]> {
    const response = await this.get<{ highlights: TheSportsDBHighlight[] }>('/lookuphighlight.php', {
      id: eventId
    })
    return response.highlights || []
  }

  /**
   * Premium Feature: Get league top scorers
   */
  async getLeagueTopScorers(leagueId: string, season: string): Promise<TheSportsDBPlayerStatistics[]> {
    const response = await this.get<{ topscorers: TheSportsDBPlayerStatistics[] }>('/lookuptopscorers.php', {
      l: leagueId,
      s: season
    })
    return response.topscorers || []
  }

  /**
   * Premium Feature: Get league statistics
   */
  async getLeagueStatistics(leagueId: string, season: string): Promise<any> {
    const response = await this.get<any>('/lookupstats.php', {
      l: leagueId,
      s: season
    })
    return response
  }

  /**
   * Enhanced team lookup with premium features
   */
  async getEnhancedTeamDetails(teamId: string): Promise<{
    team: any
    players: TheSportsDBPlayer[]
    nextFixtures: any[]
    lastResults: any[]
  }> {
    console.log(`🔍 Getting enhanced team details for team ${teamId}...`)
    
    // Get basic team info from v1 API (fallback)
    const teamResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupteam.php?id=${teamId}`)
    const teamData = await teamResponse.json()
    const team = teamData.teams?.[0]
    
    if (!team) {
      throw new Error(`Team ${teamId} not found`)
    }

    // Get premium data
    const [players, nextFixtures, lastResults] = await Promise.all([
      this.getTeamPlayers(teamId).catch(() => []),
      fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${teamId}`)
        .then(r => r.json()).then(d => d.events || []).catch(() => []),
      fetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamId}`)
        .then(r => r.json()).then(d => d.results || []).catch(() => [])
    ])

    console.log(`✅ Enhanced team data: ${players.length} players, ${nextFixtures.length} upcoming, ${lastResults.length} recent`)

    return {
      team,
      players,
      nextFixtures,
      lastResults
    }
  }

  /**
   * Comprehensive Korean League data with premium features
   */
  async getComprehensiveKoreanData(): Promise<{
    leagues: any[]
    teams: any[]
    players: TheSportsDBPlayer[]
    fixtures: any[]
    standings: any[]
    liveScores: TheSportsDBLiveScore[]
    topScorers: TheSportsDBPlayerStatistics[]
  }> {
    console.log('🚀 Starting comprehensive Korean league data fetch with premium features...')
    
    // First get basic data from v1 API
    const basicAPI = new (await import('./thesportsdb-api.js')).TheSportsDBAPI()
    const basicData = await basicAPI.getComprehensiveKLeagueData()
    
    const allPlayers: TheSportsDBPlayer[] = []
    const allTopScorers: TheSportsDBPlayerStatistics[] = []
    
    // Get premium data for each team
    console.log('💎 Fetching premium player data...')
    for (const team of basicData.teams.slice(0, 5)) { // Limit to first 5 teams for testing
      try {
        const players = await this.getTeamPlayers(team.idTeam)
        allPlayers.push(...players)
        console.log(`  ✅ ${team.strTeam}: ${players.length} players`)
        await this.delay(500) // Respect rate limits
      } catch (error) {
        console.warn(`  ⚠️ Failed to get players for ${team.strTeam}:`, error)
      }
    }
    
    // Get live scores
    console.log('📡 Fetching live scores...')
    const liveScores = await this.getLiveScores().catch(() => [])
    
    // Get top scorers for each league
    console.log('🏆 Fetching top scorers...')
    for (const league of basicData.leagues) {
      try {
        const topScorers = await this.getLeagueTopScorers(league.idLeague, '2024-2025')
        allTopScorers.push(...topScorers)
        console.log(`  ✅ ${league.strLeague}: ${topScorers.length} top scorers`)
        await this.delay(500)
      } catch (error) {
        console.warn(`  ⚠️ Failed to get top scorers for ${league.strLeague}:`, error)
      }
    }

    console.log('🎉 Comprehensive Korean data fetch completed!')
    console.log(`📊 Premium Summary: ${allPlayers.length} players, ${liveScores.length} live scores, ${allTopScorers.length} top scorers`)

    return {
      ...basicData,
      players: allPlayers,
      liveScores,
      topScorers: allTopScorers
    }
  }

  /**
   * Test API connection and features
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing TheSportsDB Premium API v2 connection...')
      
      // Test with a simple search endpoint (v2 style)
      const response = await this.get<any>('/search/league/premier')
      console.log(`✅ Premium API v2 connected - Test search successful`)
      
      return true
    } catch (error) {
      console.error('❌ Premium API v2 connection failed:', error)
      return false
    }
  }
}

// Factory function for easy instantiation
export function createTheSportsDBPremiumAPI(config: TheSportsDBPremiumConfig): TheSportsDBPremiumAPI {
  return new TheSportsDBPremiumAPI(config)
}

// Export types for use in other modules
export type { 
  TheSportsDBPremiumConfig,
  TheSportsDBPlayer,
  TheSportsDBPlayerStatistics,
  TheSportsDBLiveScore,
  TheSportsDBMatchEvent,
  TheSportsDBHighlight
}