/**
 * Data Mappers for API Standardization
 * Maps different API response formats to standardized internal structures
 */

export type DataSource = 'api-football' | 'highlightly'

export interface StandardizedLeague {
  id: number
  name: string
  country: string
  countryCode?: string
  season: number
  logo?: string
  source: DataSource
  sourceId: number
  createdAt?: string
  updatedAt?: string
}

export interface StandardizedTeam {
  id: number
  name: string
  shortName?: string
  code?: string
  logo?: string
  country: string
  countryCode?: string
  founded?: number
  source: DataSource
  sourceId: number
  leagueId?: number
  createdAt?: string
  updatedAt?: string
}

export interface StandardizedPlayer {
  id: number
  name: string
  firstName?: string
  lastName?: string
  position?: string
  number?: number
  age?: number
  nationality?: string
  photo?: string
  source: DataSource
  sourceId: number
  teamId?: number
  createdAt?: string
  updatedAt?: string
}

export interface StandardizedFixture {
  id: number
  homeTeamId: number
  awayTeamId: number
  leagueId: number
  season: number
  round?: string
  matchDate: string
  status: string
  homeScore?: number
  awayScore?: number
  venue?: string
  source: DataSource
  sourceId: number
  createdAt?: string
  updatedAt?: string
}

/**
 * Data mapping utilities for converting between API formats
 */
export class DataMapper {
  /**
   * Map league data from different API sources
   */
  static mapLeague(data: any, source: DataSource): StandardizedLeague {
    const now = new Date().toISOString()
    
    if (source === 'api-football') {
      return {
        id: data.league.id,
        name: data.league.name,
        country: data.country.name,
        countryCode: data.country.code,
        season: data.seasons?.[0]?.year || new Date().getFullYear(),
        logo: data.league.logo,
        source: 'api-football',
        sourceId: data.league.id,
        createdAt: now,
        updatedAt: now
      }
    } else {
      // Highlightly API mapping
      return {
        id: data.id,
        name: data.name,
        country: data.country?.name || data.countryName || 'Unknown',
        countryCode: data.country?.code || data.countryCode,
        season: data.currentSeason?.year || data.season || new Date().getFullYear(),
        logo: data.logo || data.logoUrl,
        source: 'highlightly',
        sourceId: data.id,
        createdAt: now,
        updatedAt: now
      }
    }
  }

  /**
   * Map team data from different API sources
   */
  static mapTeam(data: any, source: DataSource, leagueId?: number): StandardizedTeam {
    const now = new Date().toISOString()
    
    if (source === 'api-football') {
      return {
        id: data.team.id,
        name: data.team.name,
        shortName: data.team.code,
        code: data.team.code,
        logo: data.team.logo,
        country: data.team.country,
        founded: data.team.founded,
        source: 'api-football',
        sourceId: data.team.id,
        leagueId,
        createdAt: now,
        updatedAt: now
      }
    } else {
      // Highlightly API mapping
      return {
        id: data.id,
        name: data.name,
        shortName: data.shortName || data.code,
        code: data.code || data.shortName,
        logo: data.logo || data.logoUrl,
        country: data.country?.name || 'Unknown',
        countryCode: data.country?.code,
        founded: data.founded,
        source: 'highlightly',
        sourceId: data.id,
        leagueId,
        createdAt: now,
        updatedAt: now
      }
    }
  }

  /**
   * Map player data from different API sources
   */
  static mapPlayer(data: any, source: DataSource, teamId?: number): StandardizedPlayer {
    const now = new Date().toISOString()
    
    if (source === 'api-football') {
      return {
        id: data.player.id,
        name: data.player.name,
        firstName: data.player.firstname,
        lastName: data.player.lastname,
        position: data.statistics?.[0]?.games?.position,
        number: data.statistics?.[0]?.games?.number,
        age: data.player.age,
        nationality: data.player.nationality,
        photo: data.player.photo,
        source: 'api-football',
        sourceId: data.player.id,
        teamId,
        createdAt: now,
        updatedAt: now
      }
    } else {
      // Highlightly API mapping
      return {
        id: data.id,
        name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        position: data.position,
        number: data.number || data.shirtNumber,
        age: data.age,
        nationality: data.nationality || data.country,
        photo: data.photo || data.image,
        source: 'highlightly',
        sourceId: data.id,
        teamId,
        createdAt: now,
        updatedAt: now
      }
    }
  }

  /**
   * Map fixture data from different API sources
   */
  static mapFixture(data: any, source: DataSource): StandardizedFixture {
    const now = new Date().toISOString()
    
    if (source === 'api-football') {
      return {
        id: data.fixture.id,
        homeTeamId: data.teams.home.id,
        awayTeamId: data.teams.away.id,
        leagueId: data.league.id,
        season: data.league.season,
        round: data.league.round,
        matchDate: data.fixture.date,
        status: data.fixture.status.short,
        homeScore: data.goals?.home,
        awayScore: data.goals?.away,
        venue: data.fixture.venue?.name,
        source: 'api-football',
        sourceId: data.fixture.id,
        createdAt: now,
        updatedAt: now
      }
    } else {
      // Highlightly API mapping
      return {
        id: data.id,
        homeTeamId: data.homeTeam?.id || data.homeTeamId,
        awayTeamId: data.awayTeam?.id || data.awayTeamId,
        leagueId: data.league?.id || data.leagueId,
        season: data.season || new Date().getFullYear(),
        round: data.round || data.matchday,
        matchDate: data.matchDate || data.date,
        status: data.status || 'SCHEDULED',
        homeScore: data.homeScore || data.score?.home,
        awayScore: data.awayScore || data.score?.away,
        venue: data.venue?.name || data.venueName,
        source: 'highlightly',
        sourceId: data.id,
        createdAt: now,
        updatedAt: now
      }
    }
  }
}

/**
 * Entity matching utilities for finding corresponding entities across APIs
 */
export class EntityMatcher {
  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0
    
    const matrix = []
    const len1 = str1.length
    const len2 = str2.length

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j
    }

    // Calculate distances
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    const maxLen = Math.max(len1, len2)
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen
  }

  /**
   * Find matching league from a list of candidates
   */
  static findMatchingLeague(
    target: StandardizedLeague, 
    candidates: StandardizedLeague[],
    threshold: number = 0.8
  ): StandardizedLeague | null {
    let bestMatch: StandardizedLeague | null = null
    let bestScore = 0

    for (const candidate of candidates) {
      // Country match is important for leagues
      const countryMatch = target.country.toLowerCase() === candidate.country.toLowerCase()
      
      if (!countryMatch) continue
      
      // Calculate name similarity
      const nameSimilarity = this.calculateSimilarity(
        target.name.toLowerCase(),
        candidate.name.toLowerCase()
      )
      
      // Boost score for country match
      const totalScore = nameSimilarity * (countryMatch ? 1.2 : 1.0)
      
      if (totalScore > bestScore && totalScore > threshold) {
        bestScore = totalScore
        bestMatch = candidate
      }
    }

    return bestMatch
  }

  /**
   * Find matching team from a list of candidates
   */
  static findMatchingTeam(
    target: StandardizedTeam, 
    candidates: StandardizedTeam[],
    threshold: number = 0.85
  ): StandardizedTeam | null {
    let bestMatch: StandardizedTeam | null = null
    let bestScore = 0

    for (const candidate of candidates) {
      let score = 0
      
      // Exact name match
      if (target.name.toLowerCase() === candidate.name.toLowerCase()) {
        score = 1.0
      }
      // Short name/code match
      else if (target.shortName && candidate.shortName && 
               target.shortName.toLowerCase() === candidate.shortName.toLowerCase()) {
        score = 0.95
      }
      // Code match
      else if (target.code && candidate.code && 
               target.code.toLowerCase() === candidate.code.toLowerCase()) {
        score = 0.9
      }
      // Similarity-based match
      else {
        score = this.calculateSimilarity(
          target.name.toLowerCase(),
          candidate.name.toLowerCase()
        )
      }
      
      // Boost for country match
      if (target.country && candidate.country && 
          target.country.toLowerCase() === candidate.country.toLowerCase()) {
        score *= 1.1
      }
      
      if (score > bestScore && score > threshold) {
        bestScore = score
        bestMatch = candidate
      }
    }

    return bestMatch
  }

  /**
   * Find matching player from a list of candidates
   */
  static findMatchingPlayer(
    target: StandardizedPlayer, 
    candidates: StandardizedPlayer[],
    threshold: number = 0.8
  ): StandardizedPlayer | null {
    let bestMatch: StandardizedPlayer | null = null
    let bestScore = 0

    for (const candidate of candidates) {
      let score = 0
      
      // Exact name match
      if (target.name.toLowerCase() === candidate.name.toLowerCase()) {
        score = 1.0
      }
      // First/Last name combination match
      else if (target.firstName && target.lastName && 
               candidate.firstName && candidate.lastName &&
               target.firstName.toLowerCase() === candidate.firstName.toLowerCase() &&
               target.lastName.toLowerCase() === candidate.lastName.toLowerCase()) {
        score = 0.95
      }
      // Similarity-based match
      else {
        score = this.calculateSimilarity(
          target.name.toLowerCase(),
          candidate.name.toLowerCase()
        )
      }
      
      // Boost for position match
      if (target.position && candidate.position && 
          target.position.toLowerCase() === candidate.position.toLowerCase()) {
        score *= 1.1
      }
      
      // Boost for number match
      if (target.number && candidate.number && target.number === candidate.number) {
        score *= 1.1
      }
      
      if (score > bestScore && score > threshold) {
        bestScore = score
        bestMatch = candidate
      }
    }

    return bestMatch
  }
}

/**
 * Quality scoring for mapping confidence
 */
export class QualityScorer {
  static scoreLeagueMapping(
    source: StandardizedLeague,
    target: StandardizedLeague
  ): number {
    let score = 0
    
    // Name similarity (40% weight)
    const nameSimilarity = EntityMatcher.calculateSimilarity(
      source.name.toLowerCase(),
      target.name.toLowerCase()
    )
    score += nameSimilarity * 0.4
    
    // Country match (40% weight)
    const countryMatch = source.country.toLowerCase() === target.country.toLowerCase()
    score += countryMatch ? 0.4 : 0
    
    // Season match (20% weight)
    const seasonMatch = source.season === target.season
    score += seasonMatch ? 0.2 : 0
    
    return Math.min(score, 1.0)
  }
  
  static scoreTeamMapping(
    source: StandardizedTeam,
    target: StandardizedTeam
  ): number {
    let score = 0
    
    // Name similarity (50% weight)
    const nameSimilarity = EntityMatcher.calculateSimilarity(
      source.name.toLowerCase(),
      target.name.toLowerCase()
    )
    score += nameSimilarity * 0.5
    
    // Short name/code match (30% weight)
    const codeMatch = (source.shortName && target.shortName && 
                      source.shortName.toLowerCase() === target.shortName.toLowerCase()) ||
                     (source.code && target.code && 
                      source.code.toLowerCase() === target.code.toLowerCase())
    score += codeMatch ? 0.3 : 0
    
    // Country match (20% weight)
    const countryMatch = source.country && target.country && 
                        source.country.toLowerCase() === target.country.toLowerCase()
    score += countryMatch ? 0.2 : 0
    
    return Math.min(score, 1.0)
  }
}

export { DataSource }