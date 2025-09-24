/**
 * Hybrid Sync Manager
 * Manages data synchronization between API-Football and Highlightly APIs
 */

import { HighlightlyAPI, HighlightlyAPIError } from './highlightly-api.js'
import { 
  DataMapper, 
  EntityMatcher, 
  QualityScorer,
  StandardizedLeague, 
  StandardizedTeam 
} from './data-mappers.js'

export interface APIMapping {
  id?: number
  entityType: 'league' | 'team' | 'player' | 'fixture'
  apiFootballId: number
  highlightlyId: number
  entityName: string
  mappingConfidence: number
  verifiedAt: string
  createdAt?: string
  updatedAt?: string
}

export interface SyncOptions {
  forceUpdate?: boolean
  dryRun?: boolean
  maxRetries?: number
  batchSize?: number
}

export interface SyncResult {
  entityType: string
  processed: number
  matched: number
  created: number
  updated: number
  errors: string[]
  mappings: APIMapping[]
}

export class HybridSyncManager {
  constructor(
    private apiFootball: any, // Existing API-Football client
    private highlightly: HighlightlyAPI,
    private supabase: any,
    private options: SyncOptions = {}
  ) {}

  /**
   * Sync leagues between APIs and create ID mappings
   */
  async syncLeagues(): Promise<SyncResult> {
    console.log('🔄 Starting hybrid league sync...')
    
    const result: SyncResult = {
      entityType: 'league',
      processed: 0,
      matched: 0,
      created: 0,
      updated: 0,
      errors: [],
      mappings: []
    }

    try {
      // 1. Get API-Football K League data
      console.log('📡 Fetching API-Football leagues...')
      
      // Fetch each league individually (API doesn't support comma-separated IDs)
      const league292 = await this.apiFootball.apiGet('leagues', { id: 292, season: 2024 })
      const league293 = await this.apiFootball.apiGet('leagues', { id: 293, season: 2024 })
      
      const apiFootballResponse = {
        response: [...(league292.response || []), ...(league293.response || [])]
      }
      
      const apiFootballLeagues = apiFootballResponse.response.map((data: any) => 
        DataMapper.mapLeague(data, 'api-football')
      )

      console.log(`✅ Found ${apiFootballLeagues.length} API-Football leagues`)

      // 2. Get Highlightly Korean leagues
      let highlightlyLeagues: StandardizedLeague[] = []
      try {
        console.log('📡 Fetching Highlightly leagues...')
        const highlightlyResponse = await this.highlightly.getLeagues({
          countryCode: 'KR',
          season: 2024
        })
        
        highlightlyLeagues = highlightlyResponse.map((data: any) =>
          DataMapper.mapLeague(data, 'highlightly')
        )
        
        console.log(`✅ Found ${highlightlyLeagues.length} Highlightly leagues`)
      } catch (error) {
        if (error instanceof HighlightlyAPIError) {
          console.warn('⚠️ Highlightly leagues not available:', error.message)
          result.errors.push(`Highlightly API error: ${error.message}`)
        } else {
          throw error
        }
      }

      // 3. Process and match leagues
      for (const apiLeague of apiFootballLeagues) {
        result.processed++
        
        try {
          // Upsert API-Football league data
          if (!this.options.dryRun) {
            await this.upsertLeague(apiLeague)
            result.created++
          }

          // Try to find Highlightly match
          const highlightlyMatch = EntityMatcher.findMatchingLeague(
            apiLeague,
            highlightlyLeagues,
            0.7 // Lower threshold for initial matching
          )

          if (highlightlyMatch) {
            const confidence = QualityScorer.scoreLeagueMapping(apiLeague, highlightlyMatch)
            
            const mapping: APIMapping = {
              entityType: 'league',
              apiFootballId: apiLeague.sourceId,
              highlightlyId: highlightlyMatch.sourceId,
              entityName: apiLeague.name,
              mappingConfidence: confidence,
              verifiedAt: new Date().toISOString()
            }

            if (!this.options.dryRun) {
              await this.createIDMapping(mapping)
            }
            
            result.mappings.push(mapping)
            result.matched++
            
            console.log(`✅ Mapped league: ${apiLeague.name} (confidence: ${(confidence * 100).toFixed(1)}%)`)
          } else {
            console.log(`⚠️ No Highlightly match found for: ${apiLeague.name}`)
          }
        } catch (error) {
          const errorMsg = `Failed to process league ${apiLeague.name}: ${error}`
          console.error('❌', errorMsg)
          result.errors.push(errorMsg)
        }
      }

    } catch (error) {
      const errorMsg = `League sync failed: ${error}`
      console.error('❌', errorMsg)
      result.errors.push(errorMsg)
    }

    console.log(`📊 League sync completed: ${result.matched}/${result.processed} matched`)
    return result
  }

  /**
   * Sync teams for a specific league
   */
  async syncTeams(leagueId: number): Promise<SyncResult> {
    console.log(`🔄 Starting hybrid team sync for league ${leagueId}...`)
    
    const result: SyncResult = {
      entityType: 'team',
      processed: 0,
      matched: 0,
      created: 0,
      updated: 0,
      errors: [],
      mappings: []
    }

    try {
      // 1. Get API-Football teams
      console.log('📡 Fetching API-Football teams...')
      const apiFootballResponse = await this.apiFootball.apiGet('teams', {
        league: leagueId,
        season: 2024
      })

      const apiFootballTeams = apiFootballResponse.response.map((data: any) =>
        DataMapper.mapTeam(data, 'api-football', leagueId)
      )

      console.log(`✅ Found ${apiFootballTeams.length} API-Football teams`)

      // 2. Get corresponding Highlightly league ID
      const highlightlyLeagueId = await this.getHighlightlyLeagueId(leagueId)
      let highlightlyTeams: StandardizedTeam[] = []

      if (highlightlyLeagueId) {
        try {
          console.log('📡 Fetching Highlightly teams...')
          const highlightlyResponse = await this.highlightly.getTeams({
            leagueId: highlightlyLeagueId,
            season: 2024
          })

          highlightlyTeams = highlightlyResponse.map((data: any) =>
            DataMapper.mapTeam(data, 'highlightly', leagueId)
          )

          console.log(`✅ Found ${highlightlyTeams.length} Highlightly teams`)
        } catch (error) {
          if (error instanceof HighlightlyAPIError) {
            console.warn('⚠️ Highlightly teams not available:', error.message)
            result.errors.push(`Highlightly API error: ${error.message}`)
          } else {
            throw error
          }
        }
      } else {
        console.warn('⚠️ No Highlightly league mapping found')
      }

      // 3. Process and match teams
      for (const apiTeam of apiFootballTeams) {
        result.processed++
        
        try {
          // Upsert API-Football team data
          if (!this.options.dryRun) {
            await this.upsertTeam(apiTeam)
            result.created++
          }

          // Try to find Highlightly match
          const highlightlyMatch = EntityMatcher.findMatchingTeam(
            apiTeam,
            highlightlyTeams,
            0.8
          )

          if (highlightlyMatch) {
            const confidence = QualityScorer.scoreTeamMapping(apiTeam, highlightlyMatch)
            
            const mapping: APIMapping = {
              entityType: 'team',
              apiFootballId: apiTeam.sourceId,
              highlightlyId: highlightlyMatch.sourceId,
              entityName: apiTeam.name,
              mappingConfidence: confidence,
              verifiedAt: new Date().toISOString()
            }

            if (!this.options.dryRun) {
              await this.createIDMapping(mapping)
              // Enrich team data with Highlightly information
              await this.enrichTeamData(apiTeam.id, highlightlyMatch)
            }
            
            result.mappings.push(mapping)
            result.matched++
            
            console.log(`✅ Mapped team: ${apiTeam.name} (confidence: ${(confidence * 100).toFixed(1)}%)`)
          } else {
            console.log(`⚠️ No Highlightly match found for: ${apiTeam.name}`)
          }
        } catch (error) {
          const errorMsg = `Failed to process team ${apiTeam.name}: ${error}`
          console.error('❌', errorMsg)
          result.errors.push(errorMsg)
        }
      }

    } catch (error) {
      const errorMsg = `Team sync failed: ${error}`
      console.error('❌', errorMsg)
      result.errors.push(errorMsg)
    }

    console.log(`📊 Team sync completed: ${result.matched}/${result.processed} matched`)
    return result
  }

  /**
   * Sync all entities for K Leagues
   */
  async syncAll(): Promise<{ leagues: SyncResult, teams: SyncResult[] }> {
    console.log('🚀 Starting complete hybrid sync...')
    
    // 1. Sync leagues first
    const leagueResult = await this.syncLeagues()
    
    // 2. Sync teams for each league
    const teamResults: SyncResult[] = []
    const kLeagueIds = [292, 293] // K League 1 and K League 2
    
    for (const leagueId of kLeagueIds) {
      const teamResult = await this.syncTeams(leagueId)
      teamResults.push(teamResult)
    }

    console.log('🎉 Complete hybrid sync finished!')
    
    return {
      leagues: leagueResult,
      teams: teamResults
    }
  }

  /**
   * Get Highlightly league ID from API-Football league ID
   */
  private async getHighlightlyLeagueId(apiFootballLeagueId: number): Promise<number | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_id_mapping')
        .select('highlightly_id')
        .eq('entity_type', 'league')
        .eq('api_football_id', apiFootballLeagueId)
        .single()

      if (error || !data) {
        return null
      }

      return data.highlightly_id
    } catch (error) {
      console.warn('Failed to get Highlightly league ID:', error)
      return null
    }
  }

  /**
   * Create or update ID mapping between APIs
   */
  private async createIDMapping(mapping: APIMapping): Promise<void> {
    const now = new Date().toISOString()
    
    const { error } = await this.supabase
      .from('api_id_mapping')
      .upsert({
        entity_type: mapping.entityType,
        api_football_id: mapping.apiFootballId,
        highlightly_id: mapping.highlightlyId,
        entity_name: mapping.entityName,
        mapping_confidence: mapping.mappingConfidence,
        verified_at: mapping.verifiedAt,
        created_at: now,
        updated_at: now
      })

    if (error) {
      throw new Error(`Failed to create ID mapping: ${error.message}`)
    }
  }

  /**
   * Upsert league data to database
   */
  private async upsertLeague(league: StandardizedLeague): Promise<void> {
    const { error } = await this.supabase
      .from('leagues')
      .upsert({
        id: league.sourceId,
        name: league.name,
        country_name: league.country,
        logo_url: league.logo,
        season_year: 2024,
        created_at: league.createdAt,
        updated_at: league.updatedAt
      })

    if (error) {
      throw new Error(`Failed to upsert league: ${error.message}`)
    }
  }

  /**
   * Upsert team data to database
   */
  private async upsertTeam(team: StandardizedTeam): Promise<void> {
    const { error } = await this.supabase
      .from('teams')
      .upsert({
        id: team.sourceId,
        name: team.name,
        code: team.code,
        logo_url: team.logo,
        league_id: team.leagueId,
        season_year: 2024,
        country_name: team.country || null,
        data_source: 'api-football',
        created_at: team.createdAt,
        updated_at: team.updatedAt
      })

    if (error) {
      throw new Error(`Failed to upsert team: ${error.message}`)
    }
  }

  /**
   * Enrich team data with additional information from Highlightly
   */
  private async enrichTeamData(teamId: number, highlightlyData: StandardizedTeam): Promise<void> {
    // Add any additional enrichment logic here
    // For example, updating additional fields that Highlightly provides
    console.log(`🔗 Enriching team ${teamId} with Highlightly data`)
    
    // This could include additional metadata, better logo quality, etc.
    // Implementation depends on what additional data Highlightly provides
  }

  /**
   * Get sync statistics and quality metrics
   */
  async getSyncStatistics(): Promise<any> {
    const { data: mappings, error } = await this.supabase
      .from('api_id_mapping')
      .select('*')

    if (error) {
      throw new Error(`Failed to get sync statistics: ${error.message}`)
    }

    const stats = {
      total_mappings: mappings.length,
      by_entity_type: {} as Record<string, number>,
      average_confidence: 0,
      high_confidence_count: 0,
      low_confidence_count: 0
    }

    let totalConfidence = 0
    
    for (const mapping of mappings) {
      stats.by_entity_type[mapping.entity_type] = 
        (stats.by_entity_type[mapping.entity_type] || 0) + 1
      
      totalConfidence += mapping.mapping_confidence
      
      if (mapping.mapping_confidence >= 0.9) {
        stats.high_confidence_count++
      } else if (mapping.mapping_confidence < 0.7) {
        stats.low_confidence_count++
      }
    }

    stats.average_confidence = mappings.length > 0 ? totalConfidence / mappings.length : 0

    return stats
  }
}

/**
 * Factory function for creating sync manager instances
 */
export function createHybridSyncManager(
  apiFootball: any,
  highlightly: HighlightlyAPI,
  supabase: any,
  options: SyncOptions = {}
): HybridSyncManager {
  return new HybridSyncManager(apiFootball, highlightly, supabase, options)
}

export type { SyncOptions, SyncResult, APIMapping }