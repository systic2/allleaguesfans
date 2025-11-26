/**
 * TheSportsDB Data Mappers
 * Maps TheSportsDB API responses to standardized database formats
 * TheSportsDB mappers
 */

import { 
  TheSportsDBLeague, 
  TheSportsDBTeam, 
  TheSportsDBFixture, 
  TheSportsDBStandingsEntry 
} from './thesportsdb-api.js'

export interface StandardizedLeague {
  id: number
  name: string
  country: string
  logo: string | null
  season_year: number
  created_at: string
  updated_at: string
  sourceId: number
  source: 'thesportsdb'
}

export interface StandardizedTeam {
  id: number
  name: string
  code: string | null
  logo_url: string | null
  league_id: number
  season_year: number
  country_name: string | null
  data_source: 'thesportsdb'
  founded: number | null
  stadium: string | null
  stadium_capacity: number | null
  website: string | null
  created_at: string
  updated_at: string
  sourceId: number
}

export interface StandardizedFixture {
  id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  season_year: number
  match_date: string
  status: string
  home_score: number | null
  away_score: number | null
  venue: string | null
  round: number | null
  created_at: string
  updated_at: string
  sourceId: number
  source: 'thesportsdb'
}

export interface StandardizedStanding {
  id?: number
  team_id: number
  league_id: number
  season_year: number
  position: number
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form: string | null
  created_at: string
  updated_at: string
  sourceId: number
  source: 'thesportsdb'
}

export class TheSportsDBMapper {
  private static readonly CURRENT_SEASON = 2024

  /**
   * Map TheSportsDB league to standardized format
   */
  static mapLeague(league: TheSportsDBLeague): StandardizedLeague {
    const now = new Date().toISOString()
    
    // Extract league ID from string (TheSportsDB uses string IDs)
    const sourceId = parseInt(league.idLeague, 10)
    
    return {
      id: sourceId,
      name: league.strLeague,
      country: league.strCountry,
      logo: league.strBadge || league.strLogo || null,
      season_year: this.CURRENT_SEASON,
      created_at: now,
      updated_at: now,
      sourceId,
      source: 'thesportsdb'
    }
  }

  /**
   * Map TheSportsDB team to standardized format
   */
  static mapTeam(team: TheSportsDBTeam, leagueId?: number): StandardizedTeam {
    const now = new Date().toISOString()
    const sourceId = parseInt(team.idTeam, 10)
    
    // Use provided leagueId or extract from team data
    const teamLeagueId = leagueId || parseInt(team.idLeague, 10)
    
    return {
      id: sourceId,
      name: team.strTeam,
      code: team.strTeamShort || null,
      logo_url: team.strTeamBadge || team.strTeamLogo || null,
      league_id: teamLeagueId,
      season_year: this.CURRENT_SEASON,
      country_name: team.strCountry || null,
      data_source: 'thesportsdb',
      founded: team.intFormedYear ? parseInt(team.intFormedYear, 10) : null,
      stadium: team.strStadium || null,
      stadium_capacity: team.intStadiumCapacity ? parseInt(team.intStadiumCapacity, 10) : null,
      website: team.strWebsite || null,
      created_at: now,
      updated_at: now,
      sourceId
    }
  }

  /**
   * Map TheSportsDB fixture to standardized format
   */
  static mapFixture(fixture: TheSportsDBFixture): StandardizedFixture {
    const now = new Date().toISOString()
    const sourceId = parseInt(fixture.idEvent, 10)
    
    // Parse scores (can be null for future matches)
    const homeScore = fixture.intHomeScore ? parseInt(fixture.intHomeScore, 10) : null
    const awayScore = fixture.intAwayScore ? parseInt(fixture.intAwayScore, 10) : null
    
    // Determine match status
    let status = 'scheduled'
    if (homeScore !== null && awayScore !== null) {
      status = 'finished'
    } else if (fixture.strPostponed === 'yes') {
      status = 'postponed'
    }
    
    // Parse date - TheSportsDB uses dateEvent format: "2024-03-15"
    const matchDate = fixture.dateEvent
    
    return {
      id: sourceId,
      home_team_id: parseInt(fixture.idHomeTeam, 10),
      away_team_id: parseInt(fixture.idAwayTeam, 10),
      league_id: parseInt(fixture.idLeague, 10),
      season_year: this.CURRENT_SEASON,
      match_date: matchDate,
      status,
      home_score: homeScore,
      away_score: awayScore,
      venue: fixture.strVenue || null,
      round: fixture.intRound ? parseInt(fixture.intRound, 10) : null,
      created_at: now,
      updated_at: now,
      sourceId,
      source: 'thesportsdb'
    }
  }

  /**
   * Map TheSportsDB standings entry to standardized format
   */
  static mapStanding(standing: TheSportsDBStandingsEntry): StandardizedStanding {
    const now = new Date().toISOString()
    const sourceId = parseInt(standing.idStanding, 10)
    
    return {
      team_id: parseInt(standing.idTeam, 10),
      league_id: parseInt(standing.idLeague, 10),
      season_year: this.CURRENT_SEASON,
      position: parseInt(standing.intRank, 10),
      played: parseInt(standing.intPlayed, 10),
      wins: parseInt(standing.intWin, 10),
      draws: parseInt(standing.intDraw, 10),
      losses: parseInt(standing.intLoss, 10),
      goals_for: parseInt(standing.intGoalsFor, 10),
      goals_against: parseInt(standing.intGoalsAgainst, 10),
      goal_difference: parseInt(standing.intGoalDifference, 10),
      points: parseInt(standing.intPoints, 10),
      form: standing.strForm || null,
      created_at: now,
      updated_at: now,
      sourceId,
      source: 'thesportsdb'
    }
  }

  /**
   * Create K League ID mapping
   */
  static createKLeagueIdMapping(): Record<string, number> {
    // Map known TheSportsDB K League IDs to our database IDs
    return {
      // These will need to be updated with actual TheSportsDB league IDs
      // K League 1: we'll use 292 to maintain compatibility
      // K League 2: we'll use 293 to maintain compatibility
      'k-league-1': 292,
      'k-league-2': 293
    }
  }

  /**
   * Get K League standardized IDs
   */
  static getKLeagueStandardIds(theSportsDbLeague: TheSportsDBLeague): number {
    const leagueName = theSportsDbLeague.strLeague.toLowerCase()
    
    if (leagueName.includes('k league 1') || leagueName.includes('k-league 1')) {
      return 292 // K League 1
    } else if (leagueName.includes('k league 2') || leagueName.includes('k-league 2')) {
      return 293 // K League 2
    }
    
    // Default to using TheSportsDB ID converted to number
    return parseInt(theSportsDbLeague.idLeague, 10)
  }

  /**
   * Validate and clean team data
   */
  static validateTeam(team: StandardizedTeam): boolean {
    return !!(
      team.name &&
      team.league_id &&
      team.sourceId
    )
  }

  /**
   * Validate and clean fixture data
   */
  static validateFixture(fixture: StandardizedFixture): boolean {
    return !!(
      fixture.home_team_id &&
      fixture.away_team_id &&
      fixture.league_id &&
      fixture.match_date &&
      fixture.sourceId
    )
  }

  /**
   * Validate and clean standing data
   */
  static validateStanding(standing: StandardizedStanding): boolean {
    return !!(
      standing.team_id &&
      standing.league_id &&
      standing.position >= 1 &&
      standing.sourceId
    )
  }

  /**
   * Get league name mapping for display
   */
  static getLeagueDisplayName(league: TheSportsDBLeague): string {
    const name = league.strLeague
    
    // Clean up league names for better display
    if (name.includes('K League')) {
      return name.replace(/Korean?/gi, '').trim()
    }
    
    return name
  }

  /**
   * Extract season from fixture or use current
   */
  static extractSeason(fixture: TheSportsDBFixture): number {
    // TheSportsDB season format is usually "2024-2025"
    if (fixture.strSeason) {
      const yearMatch = fixture.strSeason.match(/(\d{4})/)
      if (yearMatch) {
        return parseInt(yearMatch[1], 10)
      }
    }
    
    // Extract from date if available
    if (fixture.dateEvent) {
      const year = new Date(fixture.dateEvent).getFullYear()
      if (year > 2020 && year < 2030) {
        return year
      }
    }
    
    return this.CURRENT_SEASON
  }

  /**
   * Generate team code from name if not provided
   */
  static generateTeamCode(teamName: string): string {
    // Generate 3-letter code from team name
    const words = teamName.split(' ')
    if (words.length >= 2) {
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') + 'C'
    } else {
      return teamName.substring(0, 3).toUpperCase()
    }
  }

  /**
   * Comprehensive data validation and cleanup
   */
  static validateAndCleanData(data: {
    leagues: TheSportsDBLeague[]
    teams: TheSportsDBTeam[]
    fixtures: TheSportsDBFixture[]
    standings: TheSportsDBStandingsEntry[]
  }) {
    console.log('🔍 Validating and cleaning TheSportsDB data...')
    
    const validLeagues = data.leagues.filter(league => 
      league.strLeague && league.idLeague && league.strCountry
    )
    
    const validTeams = data.teams.filter(team => 
      team.strTeam && team.idTeam && team.idLeague
    )
    
    const validFixtures = data.fixtures.filter(fixture => 
      fixture.idEvent && fixture.idHomeTeam && fixture.idAwayTeam && 
      fixture.idLeague && fixture.dateEvent
    )
    
    const validStandings = data.standings.filter(standing => 
      standing.idTeam && standing.idLeague && standing.intRank &&
      standing.intPoints && standing.intPlayed
    )
    
    console.log(`✅ Validation results:`)
    console.log(`  Leagues: ${validLeagues.length}/${data.leagues.length}`)
    console.log(`  Teams: ${validTeams.length}/${data.teams.length}`)
    console.log(`  Fixtures: ${validFixtures.length}/${data.fixtures.length}`)
    console.log(`  Standings: ${validStandings.length}/${data.standings.length}`)
    
    return {
      leagues: validLeagues,
      teams: validTeams,
      fixtures: validFixtures,
      standings: validStandings
    }
  }
}

export default TheSportsDBMapper