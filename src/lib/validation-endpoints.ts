// src/lib/validation-endpoints.ts
import { lineupValidationAPI, ValidationUtils, type TeamLineupValidation, type PlayerStatusUpdate, type ValidationAlert } from './lineup-validation-api';

// ============================================================================
// Response Types
// ============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  execution_time_ms?: number;
}

export interface ValidationEndpointResponse extends APIResponse<TeamLineupValidation> {
  data?: TeamLineupValidation & {
    summary: string;
    needs_refresh: boolean;
    recommendations_count: number;
  };
}

export interface MultiTeamValidationResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  data?: {
    validations: TeamLineupValidation[];
    summary: {
      teams_validated: number;
      average_quality_score: number;
      total_issues: number;
      teams_needing_attention: number;
    };
  };
}

export interface TransferDetectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  data?: {
    transfers: PlayerStatusUpdate[];
    summary: {
      total_changes: number;
      new_signings: number;
      departures: number;
      potential_retirements: number;
    };
  };
}

export interface CorrectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  data?: {
    applied: number;
    errors: string[];
    success_rate: number;
  };
}

export interface AlertResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  data?: {
    alerts: ValidationAlert[];
    summary: {
      total_alerts: number;
      critical_alerts: number;
      high_priority_alerts: number;
      teams_affected: number;
    };
  };
}

// ============================================================================
// Error Handling
// ============================================================================

class ValidationAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ValidationAPIError';
  }
}

function handleError(error: unknown): APIResponse<never> {
  const timestamp = new Date().toISOString();
  
  if (error instanceof ValidationAPIError) {
    return {
      success: false,
      error: error.message,
      timestamp
    };
  }
  
  if (error instanceof Error) {
    return {
      success: false,
      error: `Validation API Error: ${error.message}`,
      timestamp
    };
  }
  
  return {
    success: false,
    error: 'Unknown validation error occurred',
    timestamp
  };
}

function wrapEndpoint<T>(
  fn: () => Promise<T>
): Promise<APIResponse<T>> {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    
    try {
      const data = await fn();
      const execution_time_ms = Date.now() - startTime;
      
      resolve({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        execution_time_ms
      });
    } catch (error) {
      resolve(handleError(error));
    }
  });
}

// ============================================================================
// Validation Endpoints
// ============================================================================

export class ValidationEndpoints {
  
  /**
   * GET /api/validation/team/:teamId
   * Validate a single team's lineup
   */
  static async validateTeam(
    teamId: number,
    season: number = 2025,
    options?: { forceRefresh?: boolean }
  ): Promise<ValidationEndpointResponse> {
    return wrapEndpoint(async () => {
      if (!teamId || teamId <= 0) {
        throw new ValidationAPIError('Invalid team ID provided', 400);
      }

      const validation = await lineupValidationAPI.validateTeam(teamId, season);
      
      return {
        ...validation,
        summary: ValidationUtils.formatValidationSummary(validation),
        needs_refresh: ValidationUtils.needsRefresh(validation, 24),
        recommendations_count: validation.recommendations.length
      };
    });
  }

  /**
   * GET /api/validation/league/:leagueId
   * Validate all teams in a league
   */
  static async validateLeague(
    leagueId: number = 292,
    season: number = 2025,
    options?: { batchSize?: number; maxConcurrent?: number }
  ): Promise<MultiTeamValidationResponse> {
    return wrapEndpoint(async () => {
      if (!leagueId || leagueId <= 0) {
        throw new ValidationAPIError('Invalid league ID provided', 400);
      }

      // Get all teams in the league
      const teamIds = await ValidationUtils.getKLeagueTeams(leagueId, season);
      
      if (teamIds.length === 0) {
        throw new ValidationAPIError(`No teams found for league ${leagueId}`, 404);
      }

      // Validate all teams
      const validations = await lineupValidationAPI.validateMultipleTeams(teamIds, season);
      
      // Calculate summary statistics
      const summary = {
        teams_validated: validations.length,
        average_quality_score: Math.round(
          validations.reduce((sum, v) => sum + v.data_quality_score, 0) / validations.length
        ),
        total_issues: validations.reduce((sum, v) => sum + v.issues_detected, 0),
        teams_needing_attention: validations.filter(v => v.data_quality_score < 80).length
      };

      return {
        validations,
        summary
      };
    });
  }

  /**
   * GET /api/validation/teams/batch
   * Validate specific teams by ID list
   */
  static async validateTeamsBatch(
    teamIds: number[],
    season: number = 2025
  ): Promise<MultiTeamValidationResponse> {
    return wrapEndpoint(async () => {
      if (!Array.isArray(teamIds) || teamIds.length === 0) {
        throw new ValidationAPIError('Invalid team IDs list provided', 400);
      }

      if (teamIds.length > 20) {
        throw new ValidationAPIError('Maximum 20 teams per batch request', 400);
      }

      const validations = await lineupValidationAPI.validateMultipleTeams(teamIds, season);
      
      const summary = {
        teams_validated: validations.length,
        average_quality_score: validations.length > 0 ? 
          Math.round(validations.reduce((sum, v) => sum + v.data_quality_score, 0) / validations.length) : 0,
        total_issues: validations.reduce((sum, v) => sum + v.issues_detected, 0),
        teams_needing_attention: validations.filter(v => v.data_quality_score < 80).length
      };

      return {
        validations,
        summary
      };
    });
  }

  // ============================================================================
  // Transfer Detection Endpoints
  // ============================================================================

  /**
   * GET /api/transfers/detect/:leagueId
   * Detect transfers and player status changes in a league
   */
  static async detectTransfers(
    leagueId: number = 292,
    season: number = 2025
  ): Promise<TransferDetectionResponse> {
    return wrapEndpoint(async () => {
      if (!leagueId || leagueId <= 0) {
        throw new ValidationAPIError('Invalid league ID provided', 400);
      }

      const teamIds = await ValidationUtils.getKLeagueTeams(leagueId, season);
      
      if (teamIds.length === 0) {
        throw new ValidationAPIError(`No teams found for league ${leagueId}`, 404);
      }

      const transfers = await lineupValidationAPI.detectTransfers(teamIds, season);
      
      const summary = {
        total_changes: transfers.length,
        new_signings: transfers.filter(t => t.status_change === 'new_signing').length,
        departures: transfers.filter(t => t.status_change === 'transfer').length,
        potential_retirements: transfers.filter(t => t.status_change === 'retirement').length
      };

      return {
        transfers,
        summary
      };
    });
  }

  /**
   * GET /api/transfers/player/:playerId
   * Check specific player's transfer status
   */
  static async checkPlayerTransfer(
    playerId: number,
    season: number = 2025
  ): Promise<APIResponse<PlayerStatusUpdate | null>> {
    return wrapEndpoint(async () => {
      if (!playerId || playerId <= 0) {
        throw new ValidationAPIError('Invalid player ID provided', 400);
      }

      // Get all teams to check player across league
      const teamIds = await ValidationUtils.getKLeagueTeams(292, season); // Default to K League 1
      const allTransfers = await lineupValidationAPI.detectTransfers(teamIds, season);
      
      return allTransfers.find(transfer => transfer.player_id === playerId) || null;
    });
  }

  // ============================================================================
  // Correction Endpoints
  // ============================================================================

  /**
   * POST /api/validation/team/:teamId/correct
   * Apply automatic corrections to validation issues
   */
  static async applyCorrections(
    teamId: number,
    season: number = 2025,
    options: {
      autoFixJerseyNumbers?: boolean;
      autoFixPositions?: boolean;
      addMissingPlayers?: boolean;
      flagTransfers?: boolean;
    } = {}
  ): Promise<CorrectionResponse> {
    return wrapEndpoint(async () => {
      if (!teamId || teamId <= 0) {
        throw new ValidationAPIError('Invalid team ID provided', 400);
      }

      // First validate the team to get current issues
      const validation = await lineupValidationAPI.validateTeam(teamId, season);
      
      if (validation.issues_detected === 0) {
        return {
          applied: 0,
          errors: [],
          success_rate: 1.0
        };
      }

      // Apply corrections
      const result = await lineupValidationAPI.applyCorrections(validation, options);
      
      const success_rate = result.applied / (result.applied + result.errors.length);
      
      return {
        applied: result.applied,
        errors: result.errors,
        success_rate: Number(success_rate.toFixed(2))
      };
    });
  }

  /**
   * POST /api/validation/league/:leagueId/correct
   * Apply corrections to all teams in a league
   */
  static async applyLeagueCorrections(
    leagueId: number = 292,
    season: number = 2025,
    options: {
      autoFixJerseyNumbers?: boolean;
      autoFixPositions?: boolean;
      addMissingPlayers?: boolean;
      flagTransfers?: boolean;
    } = {}
  ): Promise<APIResponse<{ team_results: Array<{ team_id: number; corrections_applied: number; errors: string[] }> }>> {
    return wrapEndpoint(async () => {
      if (!leagueId || leagueId <= 0) {
        throw new ValidationAPIError('Invalid league ID provided', 400);
      }

      const teamIds = await ValidationUtils.getKLeagueTeams(leagueId, season);
      const team_results: Array<{ team_id: number; corrections_applied: number; errors: string[] }> = [];
      
      for (const teamId of teamIds) {
        try {
          const validation = await lineupValidationAPI.validateTeam(teamId, season);
          const result = await lineupValidationAPI.applyCorrections(validation, options);
          
          team_results.push({
            team_id: teamId,
            corrections_applied: result.applied,
            errors: result.errors
          });

          // Rate limiting between teams
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          team_results.push({
            team_id: teamId,
            corrections_applied: 0,
            errors: [`Failed to process team: ${error instanceof Error ? error.message : 'Unknown error'}`]
          });
        }
      }

      return { team_results };
    });
  }

  // ============================================================================
  // Alert Endpoints
  // ============================================================================

  /**
   * GET /api/alerts/team/:teamId
   * Get validation alerts for a specific team
   */
  static async getTeamAlerts(
    teamId: number,
    season: number = 2025
  ): Promise<AlertResponse> {
    return wrapEndpoint(async () => {
      if (!teamId || teamId <= 0) {
        throw new ValidationAPIError('Invalid team ID provided', 400);
      }

      const validation = await lineupValidationAPI.validateTeam(teamId, season);
      const alerts = await lineupValidationAPI.processAlerts(validation);
      
      const summary = {
        total_alerts: alerts.length,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        high_priority_alerts: alerts.filter(a => a.severity === 'high').length,
        teams_affected: 1
      };

      return {
        alerts,
        summary
      };
    });
  }

  /**
   * GET /api/alerts/league/:leagueId
   * Get all validation alerts for a league
   */
  static async getLeagueAlerts(
    leagueId: number = 292,
    season: number = 2025
  ): Promise<AlertResponse> {
    return wrapEndpoint(async () => {
      if (!leagueId || leagueId <= 0) {
        throw new ValidationAPIError('Invalid league ID provided', 400);
      }

      const teamIds = await ValidationUtils.getKLeagueTeams(leagueId, season);
      const allAlerts: ValidationAlert[] = [];
      
      for (const teamId of teamIds) {
        try {
          const validation = await lineupValidationAPI.validateTeam(teamId, season);
          const alerts = await lineupValidationAPI.processAlerts(validation);
          allAlerts.push(...alerts);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to get alerts for team ${teamId}:`, error);
        }
      }
      
      const summary = {
        total_alerts: allAlerts.length,
        critical_alerts: allAlerts.filter(a => a.severity === 'critical').length,
        high_priority_alerts: allAlerts.filter(a => a.severity === 'high').length,
        teams_affected: new Set(allAlerts.map(a => a.team_id)).size
      };

      return {
        alerts: allAlerts,
        summary
      };
    });
  }

  // ============================================================================
  // Complete Workflow Endpoints
  // ============================================================================

  /**
   * POST /api/validation/team/:teamId/complete
   * Run complete validation workflow with corrections and alerts
   */
  static async runCompleteValidation(
    teamId: number,
    season: number = 2025,
    options: {
      autoCorrect?: boolean;
      generateAlerts?: boolean;
      correctionOptions?: {
        autoFixJerseyNumbers?: boolean;
        autoFixPositions?: boolean;
        addMissingPlayers?: boolean;
        flagTransfers?: boolean;
      };
    } = {}
  ): Promise<APIResponse<{
    validation: TeamLineupValidation;
    corrections?: { applied: number; errors: string[] };
    alerts?: ValidationAlert[];
    summary: {
      initial_quality_score: number;
      final_quality_score?: number;
      improvements_made: number;
      critical_issues_remaining: number;
    };
  }>> {
    return wrapEndpoint(async () => {
      if (!teamId || teamId <= 0) {
        throw new ValidationAPIError('Invalid team ID provided', 400);
      }

      // Run complete validation workflow
      const result = await lineupValidationAPI.runCompleteValidation(teamId, season, options);
      
      // Calculate summary metrics
      const initialQuality = result.validation.data_quality_score;
      let finalQuality = initialQuality;
      let improvementsMade = 0;
      
      if (result.corrections) {
        improvementsMade = result.corrections.applied;
        
        // Re-validate to get updated quality score if corrections were applied
        if (improvementsMade > 0) {
          const updatedValidation = await lineupValidationAPI.validateTeam(teamId, season);
          finalQuality = updatedValidation.data_quality_score;
        }
      }
      
      const criticalIssuesRemaining = result.alerts?.filter(a => a.severity === 'critical').length || 0;
      
      return {
        ...result,
        summary: {
          initial_quality_score: initialQuality,
          final_quality_score: improvementsMade > 0 ? finalQuality : undefined,
          improvements_made: improvementsMade,
          critical_issues_remaining: criticalIssuesRemaining
        }
      };
    });
  }

  // ============================================================================
  // Health Check & Status Endpoints
  // ============================================================================

  /**
   * GET /api/validation/health
   * Check API health and rate limit status
   */
  static async healthCheck(): Promise<APIResponse<{
    api_status: 'healthy' | 'degraded' | 'down';
    database_connected: boolean;
    api_football_available: boolean;
    rate_limit_status: {
      remaining: number;
      reset: number;
      limit: number;
    };
    last_check: string;
  }>> {
    return wrapEndpoint(async () => {
      // Test database connection
      let databaseConnected = false;
      try {
        const teams = await ValidationUtils.getKLeagueTeams(292, 2025);
        databaseConnected = teams.length > 0;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Test API-Football availability (lightweight request)
      let apiFootballAvailable = false;
      const rateLimitStatus = { remaining: 0, reset: 0, limit: 0 };
      
      try {
        const testValidation = await lineupValidationAPI.validateTeam(2762, 2025); // Jeonbuk test
        apiFootballAvailable = true;
        
        // Get rate limit info from API client
        // rateLimitStatus = apiClient.getRateLimitStatus();
      } catch (error) {
        console.error('API-Football health check failed:', error);
      }

      let apiStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (!databaseConnected && !apiFootballAvailable) {
        apiStatus = 'down';
      } else if (!databaseConnected || !apiFootballAvailable) {
        apiStatus = 'degraded';
      }

      return {
        api_status: apiStatus,
        database_connected: databaseConnected,
        api_football_available: apiFootballAvailable,
        rate_limit_status: rateLimitStatus,
        last_check: new Date().toISOString()
      };
    });
  }

  /**
   * GET /api/validation/stats
   * Get validation system statistics
   */
  static async getValidationStats(
    days: number = 7
  ): Promise<APIResponse<{
    period_days: number;
    total_validations: number;
    average_quality_score: number;
    teams_validated: number;
    issues_corrected: number;
    alerts_generated: number;
    api_calls_made: number;
  }>> {
    return wrapEndpoint(async () => {
      // This would query validation_logs table for statistics
      // For now, return mock data structure
      return {
        period_days: days,
        total_validations: 0,
        average_quality_score: 0,
        teams_validated: 0,
        issues_corrected: 0,
        alerts_generated: 0,
        api_calls_made: 0
      };
    });
  }
}

// ============================================================================
// Express/HTTP Integration Helpers
// ============================================================================

export const ValidationRoutes = {
  /**
   * Helper to create Express route handlers from validation endpoints
   */
  createHandler<T>(
    endpointFn: (...args: any[]) => Promise<APIResponse<T>>
  ) {
    return async (req: any, res: any) => {
      try {
        const result = await endpointFn(...Object.values(req.params), req.body, req.query);
        
        const statusCode = result.success ? 200 : 
          (result.error?.includes('Invalid') || result.error?.includes('not found')) ? 400 : 500;
        
        res.status(statusCode).json(result);
      } catch (error) {
        res.status(500).json(handleError(error));
      }
    };
  },

  /**
   * Route definitions for easy integration
   */
  getRouteDefinitions() {
    return [
      {
        method: 'GET',
        path: '/api/validation/team/:teamId',
        handler: this.createHandler(ValidationEndpoints.validateTeam)
      },
      {
        method: 'GET',
        path: '/api/validation/league/:leagueId',
        handler: this.createHandler(ValidationEndpoints.validateLeague)
      },
      {
        method: 'POST',
        path: '/api/validation/teams/batch',
        handler: this.createHandler(ValidationEndpoints.validateTeamsBatch)
      },
      {
        method: 'GET',
        path: '/api/transfers/detect/:leagueId',
        handler: this.createHandler(ValidationEndpoints.detectTransfers)
      },
      {
        method: 'GET',
        path: '/api/transfers/player/:playerId',
        handler: this.createHandler(ValidationEndpoints.checkPlayerTransfer)
      },
      {
        method: 'POST',
        path: '/api/validation/team/:teamId/correct',
        handler: this.createHandler(ValidationEndpoints.applyCorrections)
      },
      {
        method: 'POST',
        path: '/api/validation/league/:leagueId/correct',
        handler: this.createHandler(ValidationEndpoints.applyLeagueCorrections)
      },
      {
        method: 'GET',
        path: '/api/alerts/team/:teamId',
        handler: this.createHandler(ValidationEndpoints.getTeamAlerts)
      },
      {
        method: 'GET',
        path: '/api/alerts/league/:leagueId',
        handler: this.createHandler(ValidationEndpoints.getLeagueAlerts)
      },
      {
        method: 'POST',
        path: '/api/validation/team/:teamId/complete',
        handler: this.createHandler(ValidationEndpoints.runCompleteValidation)
      },
      {
        method: 'GET',
        path: '/api/validation/health',
        handler: this.createHandler(ValidationEndpoints.healthCheck)
      },
      {
        method: 'GET',
        path: '/api/validation/stats',
        handler: this.createHandler(ValidationEndpoints.getValidationStats)
      }
    ];
  }
};