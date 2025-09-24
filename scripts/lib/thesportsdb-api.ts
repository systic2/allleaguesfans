/**
 * TheSportsDB API Client
 * Free alternative to API-Football for Korean football data
 * Emergency replacement before October 2nd deadline
 */

export interface TheSportsDBConfig {
  baseUrl?: string
  rateLimit?: { requests: number, window: number }
}

export interface TheSportsDBLeague {
  idLeague: string
  strLeague: string
  strSport: string
  strLeagueAlternate?: string
  strCountry: string
  strBadge?: string
  strLogo?: string
  strPoster?: string
  strTrophy?: string
  strComplete: string
  strWebsite?: string
  strFacebook?: string
  strTwitter?: string
  strYoutube?: string
  strDescriptionEN?: string
  strFanart1?: string
  strFanart2?: string
  strFanart3?: string
  strFanart4?: string
  strBanner?: string
  strNaming?: string
  intFormedYear?: string
  strGender: string
  strDivision?: string
  strCurrentSeason?: string
  strLocked: string
}

export interface TheSportsDBTeam {
  idTeam: string
  strTeam: string
  strTeamShort?: string
  strAlternate?: string
  intFormedYear?: string
  strSport: string
  strLeague: string
  idLeague: string
  strDivision?: string
  strManager?: string
  strStadium?: string
  strKeywords?: string
  strRSS?: string
  strStadiumThumb?: string
  strStadiumDescription?: string
  strStadiumLocation?: string
  intStadiumCapacity?: string
  strWebsite?: string
  strFacebook?: string
  strTwitter?: string
  strInstagram?: string
  strDescriptionEN?: string
  strGender: string
  strCountry: string
  strTeamBadge?: string
  strTeamJersey?: string
  strTeamLogo?: string
  strTeamFanart1?: string
  strTeamFanart2?: string
  strTeamFanart3?: string
  strTeamFanart4?: string
  strTeamBanner?: string
  strYoutube?: string
  strLocked: string
}

export interface TheSportsDBFixture {
  idEvent: string
  strEvent: string
  strFilename?: string
  strSport: string
  idLeague: string
  strLeague: string
  strSeason: string
  strDescriptionEN?: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore?: string
  intAwayScore?: string
  intRound?: string
  idHomeTeam: string
  idAwayTeam: string
  strDate: string
  strTime?: string
  dateEvent: string
  strTimeLocal?: string
  strTVStation?: string
  idHomeTeamBadge?: string
  idAwayTeamBadge?: string
  strResult?: string
  strVenue?: string
  strCountry?: string
  strCity?: string
  strPoster?: string
  strSquare?: string
  strFanart?: string
  strThumb?: string
  strBanner?: string
  strMap?: string
  strLocked: string
  strPostponed?: string
  strTimestamp?: string
  intSpectators?: string
}

export interface TheSportsDBStandingsEntry {
  idStanding: string
  intRank: string
  idTeam: string
  strTeam: string
  strTeamBadge?: string
  idLeague: string
  strLeague: string
  strSeason: string
  strForm?: string
  strDescription?: string
  intPlayed: string
  intWin: string
  intLoss: string
  intDraw: string
  intGoalsFor: string
  intGoalsAgainst: string
  intGoalDifference: string
  intPoints: string
  dateUpdated?: string
}

export class TheSportsDBAPIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseBody: string
  ) {
    super(`TheSportsDB API Error ${status}: ${statusText}`)
    this.name = 'TheSportsDBAPIError'
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
        console.log(`⏳ TheSportsDB rate limit reached, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    this.requests.push(now)
  }
}

export class TheSportsDBAPI {
  private baseUrl: string
  private rateLimiter: RateLimiter
  
  constructor(config: TheSportsDBConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://www.thesportsdb.com/api/v1/json/3'
    
    // Conservative rate limiting for free API
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.requests ?? 10, // 10 requests per minute
      config.rateLimit?.window ?? 60000 // 60 seconds
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

    console.log(`🌐 TheSportsDB API: GET ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AllLeaguesFans/1.0 (Emergency Migration)'
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
    console.log(`✅ TheSportsDB API response: ${Object.keys(data).join(', ')}`)
    return data
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // K League specific methods

  /**
   * Get Korean leagues (K League 1 and K League 2)
   */
  async getKoreanLeagues(): Promise<TheSportsDBLeague[]> {
    const response = await this.get<{ leagues: TheSportsDBLeague[] }>('/search_all_leagues.php', {
      c: 'South Korea'
    })
    
    const leagues = response.leagues || []
    // Filter for football/soccer leagues only
    return leagues.filter(league => 
      league.strSport === 'Soccer' && 
      (league.strLeague.includes('K League') || league.strLeague.includes('Korean'))
    )
  }

  /**
   * Get teams for a specific league
   */
  async getTeamsByLeague(leagueId: string): Promise<TheSportsDBTeam[]> {
    const response = await this.get<{ teams: TheSportsDBTeam[] }>('/lookup_all_teams.php', {
      id: leagueId
    })
    
    return response.teams || []
  }

  /**
   * Get team details by team ID
   */
  async getTeamDetails(teamId: string): Promise<TheSportsDBTeam | null> {
    const response = await this.get<{ teams: TheSportsDBTeam[] }>('/lookupteam.php', {
      id: teamId
    })
    
    return response.teams?.[0] || null
  }

  /**
   * Get fixtures for a league in a specific season
   */
  async getLeagueFixtures(leagueId: string, season: string): Promise<TheSportsDBFixture[]> {
    const response = await this.get<{ events: TheSportsDBFixture[] }>('/eventsseason.php', {
      id: leagueId,
      s: season
    })
    
    return response.events || []
  }

  /**
   * Get current season fixtures for a league
   */
  async getCurrentSeasonFixtures(leagueId: string): Promise<TheSportsDBFixture[]> {
    return this.getLeagueFixtures(leagueId, '2024-2025')
  }

  /**
   * Get league standings/table
   */
  async getLeagueStandings(leagueId: string, season: string): Promise<TheSportsDBStandingsEntry[]> {
    const response = await this.get<{ table: TheSportsDBStandingsEntry[] }>('/lookuptable.php', {
      l: leagueId,
      s: season
    })
    
    return response.table || []
  }

  /**
   * Get current season standings
   */
  async getCurrentSeasonStandings(leagueId: string): Promise<TheSportsDBStandingsEntry[]> {
    return this.getLeagueStandings(leagueId, '2024-2025')
  }

  /**
   * Search for teams by name (useful for matching)
   */
  async searchTeams(teamName: string): Promise<TheSportsDBTeam[]> {
    const response = await this.get<{ teams: TheSportsDBTeam[] }>('/searchteams.php', {
      t: teamName
    })
    
    return response.teams || []
  }

  /**
   * Get team's next fixture
   */
  async getTeamNextFixture(teamId: string): Promise<TheSportsDBFixture[]> {
    const response = await this.get<{ events: TheSportsDBFixture[] }>('/eventsnext.php', {
      id: teamId
    })
    
    return response.events || []
  }

  /**
   * Get team's last fixture
   */
  async getTeamLastFixture(teamId: string): Promise<TheSportsDBFixture[]> {
    const response = await this.get<{ results: TheSportsDBFixture[] }>('/eventslast.php', {
      id: teamId
    })
    
    return response.results || []
  }

  /**
   * Get all countries (for reference)
   */
  async getAllCountries(): Promise<any[]> {
    const response = await this.get<{ countries: any[] }>('/all_countries.php')
    return response.countries || []
  }

  /**
   * Comprehensive K League data fetch
   */
  async getComprehensiveKLeagueData(): Promise<{
    leagues: TheSportsDBLeague[]
    teams: TheSportsDBTeam[]
    fixtures: TheSportsDBFixture[]
    standings: TheSportsDBStandingsEntry[]
  }> {
    console.log('🚀 Starting comprehensive K League data fetch...')
    
    // 1. Get Korean leagues
    const leagues = await this.getKoreanLeagues()
    console.log(`✅ Found ${leagues.length} Korean leagues`)
    
    const allTeams: TheSportsDBTeam[] = []
    const allFixtures: TheSportsDBFixture[] = []
    const allStandings: TheSportsDBStandingsEntry[] = []
    
    // 2. Process each league
    for (const league of leagues) {
      console.log(`🔄 Processing league: ${league.strLeague} (ID: ${league.idLeague})`)
      
      try {
        // Get teams
        const teams = await this.getTeamsByLeague(league.idLeague)
        allTeams.push(...teams)
        console.log(`  ✅ Found ${teams.length} teams`)
        
        // Small delay between API calls
        await this.delay(1000)
        
        // Get fixtures
        const fixtures = await this.getCurrentSeasonFixtures(league.idLeague)
        allFixtures.push(...fixtures)
        console.log(`  ✅ Found ${fixtures.length} fixtures`)
        
        await this.delay(1000)
        
        // Get standings
        const standings = await this.getCurrentSeasonStandings(league.idLeague)
        allStandings.push(...standings)
        console.log(`  ✅ Found ${standings.length} standings entries`)
        
        await this.delay(1000)
        
      } catch (error) {
        console.warn(`  ⚠️ Error processing league ${league.strLeague}:`, error)
      }
    }
    
    console.log('🎉 Comprehensive K League data fetch completed!')
    console.log(`📊 Summary: ${leagues.length} leagues, ${allTeams.length} teams, ${allFixtures.length} fixtures, ${allStandings.length} standings`)
    
    return {
      leagues,
      teams: allTeams,
      fixtures: allFixtures,
      standings: allStandings
    }
  }
}

// Factory function for easy instantiation
export function createTheSportsDBAPI(config: TheSportsDBConfig = {}): TheSportsDBAPI {
  return new TheSportsDBAPI(config)
}

// Export types for use in other modules
export type { 
  TheSportsDBConfig, 
  TheSportsDBLeague, 
  TheSportsDBTeam, 
  TheSportsDBFixture, 
  TheSportsDBStandingsEntry 
}