// src/lib/lineup-validation-api.ts
import { createClient } from '@supabase/supabase-js';

// Environment configuration with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;
const apiFootballKey = import.meta.env.VITE_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Type Definitions
// ============================================================================

export interface PlayerValidationResult {
  player_id: number;
  name: string;
  jersey_number_db: number | null;
  jersey_number_api: number | null;
  position_db: string | null;
  position_api: string | null;
  team_id: number;
  status: 'valid' | 'jersey_mismatch' | 'position_mismatch' | 'missing_from_api' | 'missing_from_db' | 'transfer_detected';
  confidence: number; // 0-1 confidence score
  last_validated: string;
  issues: string[];
}

export interface TeamLineupValidation {
  team_id: number;
  team_name: string;
  season_year: number;
  validation_timestamp: string;
  total_players: number;
  valid_players: number;
  issues_detected: number;
  validation_results: PlayerValidationResult[];
  data_quality_score: number; // 0-100
  recommendations: string[];
}

export interface PlayerStatusUpdate {
  player_id: number;
  previous_team_id: number | null;
  current_team_id: number | null;
  status_change: 'transfer' | 'loan' | 'retirement' | 'return' | 'new_signing';
  detection_method: 'api_comparison' | 'missing_from_squad' | 'manual_flag';
  confidence: number;
  detected_at: string;
  metadata?: Record<string, any>;
}

export interface ValidationAlert {
  id: string;
  type: 'jersey_conflict' | 'player_missing' | 'mass_changes' | 'data_quality' | 'transfer_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  team_id: number;
  team_name: string;
  message: string;
  details: Record<string, any>;
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface APIFootballPlayerData {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  photo: string;
  number: number;
  position: string;
  age: number;
  birth?: {
    date: string;
    place: string;
    country: string;
  };
  nationality: string;
  height?: string;
  weight?: string;
  injured: boolean;
}

export interface APIFootballSquadResponse {
  response: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    players: APIFootballPlayerData[];
  }>;
}

// Rate limiting interface
interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

// ============================================================================
// Core API Football Integration
// ============================================================================

class APIFootballClient {
  private baseURL = 'https://v3.football.api-sports.io';
  private rateLimitInfo: RateLimitInfo = { remaining: 100, reset: Date.now() + 3600000, limit: 100 };

  async makeRequest<T>(endpoint: string): Promise<T | null> {
    if (!apiFootballKey) {
      console.warn('API_FOOTBALL_KEY not configured - using database fallback');
      return null;
    }

    // Check rate limits
    if (this.rateLimitInfo.remaining <= 5 && Date.now() < this.rateLimitInfo.reset) {
      console.warn('API rate limit approached - delaying request');
      await this.delay(Math.min(30000, this.rateLimitInfo.reset - Date.now()));
    }

    try {
      const response = await fetch(`${this.baseURL}/${endpoint}`, {
        headers: {
          'x-apisports-key': apiFootballKey,
          'x-apisports-host': 'v3.football.api-sports.io'
        }
      });

      // Update rate limit info from headers
      this.updateRateLimit(response);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error(`API-Football request failed for ${endpoint}:`, error);
      return null;
    }
  }

  private updateRateLimit(response: Response): void {
    const remaining = response.headers.get('x-ratelimit-requests-remaining');
    const reset = response.headers.get('x-ratelimit-requests-reset');
    const limit = response.headers.get('x-ratelimit-requests-limit');

    if (remaining) this.rateLimitInfo.remaining = parseInt(remaining);
    if (reset) this.rateLimitInfo.reset = parseInt(reset) * 1000; // Convert to milliseconds
    if (limit) this.rateLimitInfo.limit = parseInt(limit);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchSquad(teamId: number, season: number = 2025): Promise<APIFootballPlayerData[]> {
    const data = await this.makeRequest<APIFootballSquadResponse>(`players/squads?team=${teamId}&season=${season}`);
    
    if (!data?.response?.[0]?.players) {
      // Try previous season as fallback
      const fallbackData = await this.makeRequest<APIFootballSquadResponse>(`players/squads?team=${teamId}&season=${season - 1}`);
      return fallbackData?.response?.[0]?.players || [];
    }

    return data.response[0].players;
  }

  async fetchPlayerProfile(playerId: number, season: number = 2025): Promise<APIFootballPlayerData | null> {
    const data = await this.makeRequest<{ response: APIFootballPlayerData[] }>(`players?id=${playerId}&season=${season}`);
    return data?.response?.[0] || null;
  }

  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }
}

// ============================================================================
// Player Name Normalization & Matching
// ============================================================================

export class PlayerMatcher {
  static normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^\w\s가-힣]/g, '') // Include Korean characters
      .replace(/\s+/g, ' ')
      .trim();
  }

  static calculateNameSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizePlayerName(name1);
    const norm2 = this.normalizePlayerName(name2);
    
    if (norm1 === norm2) return 1.0;
    
    // Check if one name contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
    
    // Check individual words
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    
    let matchCount = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.length > 2 && word2.length > 2) {
          if (word1 === word2) matchCount += 1.0;
          else if (word1.includes(word2) || word2.includes(word1)) matchCount += 0.5;
        }
      }
    }
    
    return Math.min(matchCount / Math.max(words1.length, words2.length), 1.0);
  }

  static findBestMatch(
    targetPlayer: APIFootballPlayerData,
    dbPlayers: any[],
    minSimilarity: number = 0.6
  ): { player: any; similarity: number } | null {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const dbPlayer of dbPlayers) {
      const similarity = this.calculateNameSimilarity(targetPlayer.name, dbPlayer.name);
      
      if (similarity >= minSimilarity && similarity > bestSimilarity) {
        bestMatch = dbPlayer;
        bestSimilarity = similarity;
      }
    }

    return bestMatch ? { player: bestMatch, similarity: bestSimilarity } : null;
  }
}

// ============================================================================
// Core Validation Engine
// ============================================================================

export class LineupValidationEngine {
  private apiClient = new APIFootballClient();

  async validateTeamLineup(
    teamId: number, 
    season: number = 2025,
    options: { includeTransferDetection?: boolean; forceRefresh?: boolean } = {}
  ): Promise<TeamLineupValidation> {
    const startTime = Date.now();
    
    try {
      // Fetch data in parallel
      const [dbPlayers, apiPlayers, teamInfo] = await Promise.all([
        this.fetchDatabasePlayers(teamId, season),
        this.apiClient.fetchSquad(teamId, season),
        this.fetchTeamInfo(teamId, season)
      ]);

      const validationResults: PlayerValidationResult[] = [];
      const issues: string[] = [];
      let validCount = 0;

      // Validate each API player against database
      for (const apiPlayer of apiPlayers) {
        const result = await this.validatePlayer(apiPlayer, dbPlayers, teamId);
        validationResults.push(result);
        
        if (result.status === 'valid') {
          validCount++;
        } else {
          issues.push(...result.issues);
        }
      }

      // Check for players in DB but not in API (potential transfers/departures)
      for (const dbPlayer of dbPlayers) {
        const foundInAPI = apiPlayers.some(api => 
          PlayerMatcher.calculateNameSimilarity(api.name, dbPlayer.name) >= 0.7
        );
        
        if (!foundInAPI) {
          validationResults.push({
            player_id: dbPlayer.id,
            name: dbPlayer.name,
            jersey_number_db: dbPlayer.jersey_number,
            jersey_number_api: null,
            position_db: dbPlayer.position,
            position_api: null,
            team_id: teamId,
            status: 'missing_from_api',
            confidence: 0.8,
            last_validated: new Date().toISOString(),
            issues: ['Player exists in database but not found in current API squad']
          });
        }
      }

      // Calculate data quality score
      const totalPlayers = validationResults.length;
      const dataQualityScore = totalPlayers > 0 ? Math.round((validCount / totalPlayers) * 100) : 0;

      // Generate recommendations
      const recommendations = this.generateRecommendations(validationResults, dataQualityScore);

      const validation: TeamLineupValidation = {
        team_id: teamId,
        team_name: teamInfo?.name || `Team ${teamId}`,
        season_year: season,
        validation_timestamp: new Date().toISOString(),
        total_players: totalPlayers,
        valid_players: validCount,
        issues_detected: totalPlayers - validCount,
        validation_results: validationResults,
        data_quality_score: dataQualityScore,
        recommendations
      };

      // Log validation for monitoring
      await this.logValidation(validation, Date.now() - startTime);

      return validation;

    } catch (error) {
      console.error(`Team lineup validation failed for team ${teamId}:`, error);
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validatePlayer(
    apiPlayer: APIFootballPlayerData,
    dbPlayers: any[],
    teamId: number
  ): Promise<PlayerValidationResult> {
    const match = PlayerMatcher.findBestMatch(apiPlayer, dbPlayers);
    
    if (!match) {
      return {
        player_id: apiPlayer.id,
        name: apiPlayer.name,
        jersey_number_db: null,
        jersey_number_api: apiPlayer.number,
        position_db: null,
        position_api: apiPlayer.position,
        team_id: teamId,
        status: 'missing_from_db',
        confidence: 0.9,
        last_validated: new Date().toISOString(),
        issues: ['Player found in API but not in database - potential new signing']
      };
    }

    const dbPlayer = match.player;
    const issues: string[] = [];
    let status: PlayerValidationResult['status'] = 'valid';

    // Validate jersey number
    if (dbPlayer.jersey_number !== apiPlayer.number) {
      issues.push(`Jersey number mismatch: DB has #${dbPlayer.jersey_number}, API has #${apiPlayer.number}`);
      status = 'jersey_mismatch';
    }

    // Validate position (normalize for comparison)
    const normalizedDBPosition = this.normalizePosition(dbPlayer.position);
    const normalizedAPIPosition = this.normalizePosition(apiPlayer.position);
    
    if (normalizedDBPosition !== normalizedAPIPosition) {
      issues.push(`Position mismatch: DB has "${dbPlayer.position}", API has "${apiPlayer.position}"`);
      if (status === 'valid') status = 'position_mismatch';
    }

    return {
      player_id: dbPlayer.id,
      name: dbPlayer.name,
      jersey_number_db: dbPlayer.jersey_number,
      jersey_number_api: apiPlayer.number,
      position_db: dbPlayer.position,
      position_api: apiPlayer.position,
      team_id: teamId,
      status,
      confidence: match.similarity,
      last_validated: new Date().toISOString(),
      issues
    };
  }

  private normalizePosition(position: string | null): string {
    if (!position) return 'Unknown';
    
    const pos = position.toLowerCase();
    
    // Map common variations to standard positions
    const positionMap: Record<string, string> = {
      'goalkeeper': 'GK',
      'goalie': 'GK',
      'keeper': 'GK',
      'defender': 'DF',
      'centre-back': 'CB',
      'center-back': 'CB',
      'central defender': 'CB',
      'left-back': 'LB',
      'right-back': 'RB',
      'midfielder': 'MF',
      'central midfielder': 'CM',
      'defensive midfielder': 'DM',
      'attacking midfielder': 'AM',
      'left midfielder': 'LM',
      'right midfielder': 'RM',
      'forward': 'FW',
      'striker': 'ST',
      'centre-forward': 'CF',
      'left winger': 'LW',
      'right winger': 'RW',
      'attacker': 'FW'
    };

    return positionMap[pos] || position.toUpperCase();
  }

  private generateRecommendations(
    results: PlayerValidationResult[],
    dataQualityScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    const jerseyMismatches = results.filter(r => r.status === 'jersey_mismatch').length;
    const positionMismatches = results.filter(r => r.status === 'position_mismatch').length;
    const missingFromDB = results.filter(r => r.status === 'missing_from_db').length;
    const missingFromAPI = results.filter(r => r.status === 'missing_from_api').length;

    if (dataQualityScore < 80) {
      recommendations.push('🚨 Critical: Data quality below 80% - immediate sync required');
    }

    if (jerseyMismatches > 0) {
      recommendations.push(`🔢 Update ${jerseyMismatches} jersey number(s) in database`);
    }

    if (positionMismatches > 0) {
      recommendations.push(`📍 Review ${positionMismatches} position discrepanc${positionMismatches === 1 ? 'y' : 'ies'}`);
    }

    if (missingFromDB > 0) {
      recommendations.push(`➕ Add ${missingFromDB} new player(s) to database`);
    }

    if (missingFromAPI > 0) {
      recommendations.push(`🔍 Investigate ${missingFromAPI} player(s) missing from API (potential transfers)`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All player data is current and accurate');
    }

    return recommendations;
  }

  private async fetchDatabasePlayers(teamId: number, season: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, jersey_number, position, team_id')
      .eq('team_id', teamId)
      .eq('season_year', season);

    if (error) {
      console.error('Error fetching database players:', error);
      return [];
    }

    return data || [];
  }

  private async fetchTeamInfo(teamId: number, season: number): Promise<{ name: string } | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .eq('season_year', season)
      .maybeSingle();

    if (error) {
      console.error('Error fetching team info:', error);
      return null;
    }

    return data;
  }

  private async logValidation(validation: TeamLineupValidation, duration: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('validation_logs')
        .insert({
          team_id: validation.team_id,
          season_year: validation.season_year,
          validation_timestamp: validation.validation_timestamp,
          total_players: validation.total_players,
          valid_players: validation.valid_players,
          issues_detected: validation.issues_detected,
          data_quality_score: validation.data_quality_score,
          duration_ms: duration,
          api_rate_limit: this.apiClient.getRateLimitStatus()
        });

      if (error) {
        console.warn('Failed to log validation:', error);
      }
    } catch (error) {
      console.warn('Validation logging failed:', error);
    }
  }
}

// ============================================================================
// Transfer Detection & Player Status Tracking
// ============================================================================

export class TransferDetectionEngine {
  private validationEngine = new LineupValidationEngine();

  async detectPlayerStatusChanges(
    teamIds: number[],
    season: number = 2025
  ): Promise<PlayerStatusUpdate[]> {
    const statusUpdates: PlayerStatusUpdate[] = [];
    
    for (const teamId of teamIds) {
      try {
        const validation = await this.validationEngine.validateTeamLineup(teamId, season);
        
        // Analyze missing players for transfer detection
        const missingFromAPI = validation.validation_results.filter(r => r.status === 'missing_from_api');
        
        for (const missing of missingFromAPI) {
          // Check if player appears in another team's squad
          const transferDestination = await this.findPlayerInOtherTeams(missing.player_id, teamId, season);
          
          if (transferDestination) {
            statusUpdates.push({
              player_id: missing.player_id,
              previous_team_id: teamId,
              current_team_id: transferDestination.team_id,
              status_change: 'transfer',
              detection_method: 'api_comparison',
              confidence: 0.85,
              detected_at: new Date().toISOString(),
              metadata: {
                previous_team: transferDestination.previous_team_name,
                current_team: transferDestination.current_team_name,
                detection_source: 'squad_comparison'
              }
            });
          } else {
            // Player not found in any squad - potential retirement or loan to non-tracked league
            statusUpdates.push({
              player_id: missing.player_id,
              previous_team_id: teamId,
              current_team_id: null,
              status_change: 'retirement',
              detection_method: 'missing_from_squad',
              confidence: 0.6,
              detected_at: new Date().toISOString(),
              metadata: {
                last_known_team: teamId,
                detection_source: 'absence_from_all_squads'
              }
            });
          }
        }

        // Analyze new players
        const newPlayers = validation.validation_results.filter(r => r.status === 'missing_from_db');
        
        for (const newPlayer of newPlayers) {
          statusUpdates.push({
            player_id: newPlayer.player_id,
            previous_team_id: null,
            current_team_id: teamId,
            status_change: 'new_signing',
            detection_method: 'api_comparison',
            confidence: 0.9,
            detected_at: new Date().toISOString(),
            metadata: {
              jersey_number: newPlayer.jersey_number_api,
              position: newPlayer.position_api,
              detection_source: 'new_in_squad'
            }
          });
        }

        // Rate limiting between teams
        await this.delay(1000);

      } catch (error) {
        console.error(`Transfer detection failed for team ${teamId}:`, error);
      }
    }

    return statusUpdates;
  }

  private async findPlayerInOtherTeams(
    playerId: number,
    excludeTeamId: number,
    season: number
  ): Promise<{ team_id: number; previous_team_name: string; current_team_name: string } | null> {
    // This would require checking player across all teams in the league
    // For now, return null - in production, implement squad-wide search
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Automated Correction Engine
// ============================================================================

export class AutoCorrectionEngine {
  async applyValidationCorrections(
    validation: TeamLineupValidation,
    options: {
      autoFixJerseyNumbers?: boolean;
      autoFixPositions?: boolean;
      addMissingPlayers?: boolean;
      flagTransfers?: boolean;
    } = {}
  ): Promise<{ applied: number; errors: string[] }> {
    let appliedCount = 0;
    const errors: string[] = [];

    for (const result of validation.validation_results) {
      try {
        if (result.status === 'jersey_mismatch' && options.autoFixJerseyNumbers) {
          await this.updatePlayerJerseyNumber(result.player_id, result.jersey_number_api!, validation.season_year);
          appliedCount++;
        }

        if (result.status === 'position_mismatch' && options.autoFixPositions) {
          await this.updatePlayerPosition(result.player_id, result.position_api!, validation.season_year);
          appliedCount++;
        }

        if (result.status === 'missing_from_db' && options.addMissingPlayers) {
          await this.addMissingPlayer(result, validation.team_id, validation.season_year);
          appliedCount++;
        }

        if (result.status === 'missing_from_api' && options.flagTransfers) {
          await this.flagPotentialTransfer(result.player_id, validation.team_id, validation.season_year);
          appliedCount++;
        }

      } catch (error) {
        errors.push(`Failed to correct ${result.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { applied: appliedCount, errors };
  }

  private async updatePlayerJerseyNumber(playerId: number, jerseyNumber: number, season: number): Promise<void> {
    const { error } = await supabase
      .from('players')
      .update({ 
        jersey_number: jerseyNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId)
      .eq('season_year', season);

    if (error) {
      throw new Error(`Failed to update jersey number: ${error.message}`);
    }
  }

  private async updatePlayerPosition(playerId: number, position: string, season: number): Promise<void> {
    const { error } = await supabase
      .from('players')
      .update({ 
        position,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId)
      .eq('season_year', season);

    if (error) {
      throw new Error(`Failed to update position: ${error.message}`);
    }
  }

  private async addMissingPlayer(result: PlayerValidationResult, teamId: number, season: number): Promise<void> {
    const { error } = await supabase
      .from('players')
      .insert({
        id: result.player_id,
        name: result.name,
        jersey_number: result.jersey_number_api,
        position: result.position_api,
        team_id: teamId,
        season_year: season,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to add missing player: ${error.message}`);
    }
  }

  private async flagPotentialTransfer(playerId: number, teamId: number, season: number): Promise<void> {
    // Log potential transfer for manual review
    const { error } = await supabase
      .from('transfer_flags')
      .insert({
        player_id: playerId,
        team_id: teamId,
        season_year: season,
        flag_type: 'missing_from_api',
        flagged_at: new Date().toISOString(),
        status: 'pending_review'
      });

    if (error) {
      console.warn(`Failed to flag potential transfer: ${error.message}`);
    }
  }
}

// ============================================================================
// Alert System
// ============================================================================

export class ValidationAlertSystem {
  async generateAlerts(validation: TeamLineupValidation): Promise<ValidationAlert[]> {
    const alerts: ValidationAlert[] = [];
    
    // Critical data quality alert
    if (validation.data_quality_score < 70) {
      alerts.push({
        id: `dq-${validation.team_id}-${Date.now()}`,
        type: 'data_quality',
        severity: 'critical',
        team_id: validation.team_id,
        team_name: validation.team_name,
        message: `Critical data quality issue: ${validation.data_quality_score}% accuracy`,
        details: {
          score: validation.data_quality_score,
          issues: validation.issues_detected,
          total: validation.total_players
        },
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Mass changes alert (potential transfer window activity)
    const significantChanges = validation.validation_results.filter(r => 
      ['missing_from_api', 'missing_from_db'].includes(r.status)
    ).length;

    if (significantChanges >= 3) {
      alerts.push({
        id: `mass-${validation.team_id}-${Date.now()}`,
        type: 'mass_changes',
        severity: 'high',
        team_id: validation.team_id,
        team_name: validation.team_name,
        message: `${significantChanges} player changes detected - possible transfer activity`,
        details: {
          changes: significantChanges,
          missing_from_api: validation.validation_results.filter(r => r.status === 'missing_from_api').length,
          missing_from_db: validation.validation_results.filter(r => r.status === 'missing_from_db').length
        },
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Jersey number conflicts
    const jerseyConflicts = validation.validation_results.filter(r => r.status === 'jersey_mismatch');
    if (jerseyConflicts.length > 0) {
      alerts.push({
        id: `jersey-${validation.team_id}-${Date.now()}`,
        type: 'jersey_conflict',
        severity: 'medium',
        team_id: validation.team_id,
        team_name: validation.team_name,
        message: `${jerseyConflicts.length} jersey number mismatches detected`,
        details: {
          conflicts: jerseyConflicts.map(c => ({
            player: c.name,
            db_number: c.jersey_number_db,
            api_number: c.jersey_number_api
          }))
        },
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    return alerts;
  }

  async persistAlerts(alerts: ValidationAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    try {
      const { error } = await supabase
        .from('validation_alerts')
        .insert(alerts);

      if (error) {
        console.error('Failed to persist alerts:', error);
      }
    } catch (error) {
      console.error('Alert persistence failed:', error);
    }
  }
}

// ============================================================================
// Main API Interface
// ============================================================================

export class LineupValidationAPI {
  private validationEngine = new LineupValidationEngine();
  private transferEngine = new TransferDetectionEngine();
  private correctionEngine = new AutoCorrectionEngine();
  private alertSystem = new ValidationAlertSystem();

  /**
   * Validate a single team's lineup against live API data
   */
  async validateTeam(teamId: number, season: number = 2025): Promise<TeamLineupValidation> {
    return this.validationEngine.validateTeamLineup(teamId, season);
  }

  /**
   * Validate multiple teams in parallel (with rate limiting)
   */
  async validateMultipleTeams(teamIds: number[], season: number = 2025): Promise<TeamLineupValidation[]> {
    const results: TeamLineupValidation[] = [];
    
    // Process teams in batches to respect rate limits
    const batchSize = 3;
    for (let i = 0; i < teamIds.length; i += batchSize) {
      const batch = teamIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(teamId => 
        this.validationEngine.validateTeamLineup(teamId, season)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Team validation failed:', result.reason);
        }
      }
      
      // Rate limiting delay between batches
      if (i + batchSize < teamIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  /**
   * Detect transfer and status changes across league
   */
  async detectTransfers(leagueTeamIds: number[], season: number = 2025): Promise<PlayerStatusUpdate[]> {
    return this.transferEngine.detectPlayerStatusChanges(leagueTeamIds, season);
  }

  /**
   * Apply automatic corrections to validation issues
   */
  async applyCorrections(
    validation: TeamLineupValidation,
    options?: {
      autoFixJerseyNumbers?: boolean;
      autoFixPositions?: boolean;
      addMissingPlayers?: boolean;
      flagTransfers?: boolean;
    }
  ): Promise<{ applied: number; errors: string[] }> {
    return this.correctionEngine.applyValidationCorrections(validation, options);
  }

  /**
   * Generate and persist alerts for validation issues
   */
  async processAlerts(validation: TeamLineupValidation): Promise<ValidationAlert[]> {
    const alerts = await this.alertSystem.generateAlerts(validation);
    await this.alertSystem.persistAlerts(alerts);
    return alerts;
  }

  /**
   * Complete validation workflow with corrections and alerts
   */
  async runCompleteValidation(
    teamId: number,
    season: number = 2025,
    options?: {
      autoCorrect?: boolean;
      generateAlerts?: boolean;
      correctionOptions?: {
        autoFixJerseyNumbers?: boolean;
        autoFixPositions?: boolean;
        addMissingPlayers?: boolean;
        flagTransfers?: boolean;
      };
    }
  ): Promise<{
    validation: TeamLineupValidation;
    corrections?: { applied: number; errors: string[] };
    alerts?: ValidationAlert[];
  }> {
    // Step 1: Validate team lineup
    const validation = await this.validationEngine.validateTeamLineup(teamId, season);
    
    const result: any = { validation };

    // Step 2: Apply corrections if requested
    if (options?.autoCorrect) {
      result.corrections = await this.correctionEngine.applyValidationCorrections(
        validation,
        options.correctionOptions
      );
    }

    // Step 3: Generate alerts if requested
    if (options?.generateAlerts) {
      result.alerts = await this.processAlerts(validation);
    }

    return result;
  }
}

// Export singleton instance
export const lineupValidationAPI = new LineupValidationAPI();

// ============================================================================
// Utility Functions
// ============================================================================

export const ValidationUtils = {
  /**
   * Get K League team IDs for validation
   */
  async getKLeagueTeams(leagueId: number = 292, season: number = 2025): Promise<number[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('league_id', leagueId)
      .eq('season_year', season);

    if (error) {
      console.error('Error fetching K League teams:', error);
      return [];
    }

    return (data || []).map(team => team.id);
  },

  /**
   * Format validation results for display
   */
  formatValidationSummary(validation: TeamLineupValidation): string {
    const { team_name, data_quality_score, total_players, valid_players, issues_detected } = validation;
    
    return `
🏈 ${team_name} Lineup Validation
📊 Quality Score: ${data_quality_score}%
👥 Players: ${total_players} total, ${valid_players} valid, ${issues_detected} issues
⏰ Last Updated: ${new Date(validation.validation_timestamp).toLocaleString()}
    `.trim();
  },

  /**
   * Check if validation needs refresh
   */
  needsRefresh(validation: TeamLineupValidation, maxAgeHours: number = 24): boolean {
    const validationTime = new Date(validation.validation_timestamp).getTime();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    return Date.now() - validationTime > maxAge;
  }
};