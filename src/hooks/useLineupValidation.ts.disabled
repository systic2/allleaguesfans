// src/hooks/useLineupValidation.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { lineupValidationAPI, ValidationUtils, type TeamLineupValidation, type PlayerStatusUpdate, type ValidationAlert } from '@/lib/lineup-validation-api';

// ============================================================================
// Hook Types
// ============================================================================

export interface UseLineupValidationOptions {
  teamId?: number;
  season?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  enableAlerts?: boolean;
  autoCorrect?: boolean;
}

export interface ValidationState {
  validation: TeamLineupValidation | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refreshing: boolean;
}

export interface ValidationActions {
  validateTeam: (teamId: number, season?: number) => Promise<void>;
  refresh: () => Promise<void>;
  applyCorrections: (options?: {
    autoFixJerseyNumbers?: boolean;
    autoFixPositions?: boolean;
    addMissingPlayers?: boolean;
    flagTransfers?: boolean;
  }) => Promise<{ applied: number; errors: string[] }>;
  clearError: () => void;
  getQualityScore: () => number;
  needsRefresh: () => boolean;
}

export interface UseTransferDetectionResult {
  transfers: PlayerStatusUpdate[];
  loading: boolean;
  error: string | null;
  detectTransfers: (teamIds: number[], season?: number) => Promise<void>;
  clearError: () => void;
}

export interface UseValidationAlertsResult {
  alerts: ValidationAlert[];
  loading: boolean;
  error: string | null;
  criticalCount: number;
  highPriorityCount: number;
  fetchAlerts: (teamId?: number, leagueId?: number) => Promise<void>;
  markResolved: (alertId: string) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Main Lineup Validation Hook
// ============================================================================

export function useLineupValidation(
  options: UseLineupValidationOptions = {}
): ValidationState & ValidationActions {
  const {
    teamId,
    season = 2025,
    autoRefresh = false,
    refreshInterval = 3600000, // 1 hour
    enableAlerts = false,
    autoCorrect = false
  } = options;

  const [state, setState] = useState<ValidationState>({
    validation: null,
    loading: false,
    error: null,
    lastUpdated: null,
    refreshing: false
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Validate team function
  const validateTeam = useCallback(async (targetTeamId: number, targetSeason = season) => {
    if (!targetTeamId || targetTeamId <= 0) {
      setState(prev => ({ ...prev, error: 'Invalid team ID provided' }));
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: !prev.validation, // Only show loading if no existing data
      refreshing: !!prev.validation, // Show refreshing if updating existing data
      error: null
    }));

    try {
      console.log(`🔍 Validating team ${targetTeamId} lineup...`);
      
      const validation = await lineupValidationAPI.validateTeam(targetTeamId, targetSeason);
      
      setState(prev => ({
        ...prev,
        validation,
        loading: false,
        refreshing: false,
        error: null,
        lastUpdated: new Date().toISOString()
      }));

      // Auto-apply corrections if enabled
      if (autoCorrect && validation.issues_detected > 0) {
        try {
          console.log(`🔧 Auto-correcting ${validation.issues_detected} issues...`);
          await lineupValidationAPI.applyCorrections(validation, {
            autoFixJerseyNumbers: true,
            autoFixPositions: true,
            flagTransfers: true
          });
          
          // Re-validate to get updated results
          const updatedValidation = await lineupValidationAPI.validateTeam(targetTeamId, targetSeason);
          setState(prev => ({
            ...prev,
            validation: updatedValidation,
            lastUpdated: new Date().toISOString()
          }));
        } catch (correctionError) {
          console.warn('Auto-correction failed:', correctionError);
        }
      }

      // Generate alerts if enabled
      if (enableAlerts) {
        try {
          await lineupValidationAPI.processAlerts(validation);
        } catch (alertError) {
          console.warn('Alert generation failed:', alertError);
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Validation failed:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }));
    }
  }, [season, autoCorrect, enableAlerts]);

  // Refresh function
  const refresh = useCallback(async () => {
    if (!state.validation?.team_id) {
      setState(prev => ({ ...prev, error: 'No team to refresh' }));
      return;
    }
    
    await validateTeam(state.validation.team_id, state.validation.season_year);
  }, [state.validation, validateTeam]);

  // Apply corrections function
  const applyCorrections = useCallback(async (correctionOptions = {}) => {
    if (!state.validation) {
      throw new Error('No validation data available for corrections');
    }

    try {
      const result = await lineupValidationAPI.applyCorrections(state.validation, correctionOptions);
      
      // Refresh validation after corrections
      if (result.applied > 0) {
        await refresh();
      }
      
      return result;
    } catch (error) {
      console.error('Failed to apply corrections:', error);
      throw error;
    }
  }, [state.validation, refresh]);

  // Utility functions
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const getQualityScore = useCallback(() => {
    return state.validation?.data_quality_score || 0;
  }, [state.validation]);

  const needsRefresh = useCallback(() => {
    return state.validation ? ValidationUtils.needsRefresh(state.validation, 24) : false;
  }, [state.validation]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !state.validation) return;

    const scheduleRefresh = () => {
      refreshTimeoutRef.current = setTimeout(() => {
        refresh().finally(() => scheduleRefresh());
      }, refreshInterval);
    };

    scheduleRefresh();

    return cleanup;
  }, [autoRefresh, refreshInterval, state.validation, refresh, cleanup]);

  // Initial validation effect
  useEffect(() => {
    if (teamId && teamId > 0) {
      validateTeam(teamId, season);
    }

    return cleanup;
  }, [teamId, season]); // Remove validateTeam from deps to prevent infinite loop

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    validateTeam,
    refresh,
    applyCorrections,
    clearError,
    getQualityScore,
    needsRefresh
  };
}

// ============================================================================
// Transfer Detection Hook
// ============================================================================

export function useTransferDetection(): UseTransferDetectionResult {
  const [transfers, setTransfers] = useState<PlayerStatusUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectTransfers = useCallback(async (teamIds: number[], season = 2025) => {
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      setError('Invalid team IDs provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Detecting transfers for ${teamIds.length} teams...`);
      const transferData = await lineupValidationAPI.detectTransfers(teamIds, season);
      setTransfers(transferData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer detection failed';
      console.error('Transfer detection error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    transfers,
    loading,
    error,
    detectTransfers,
    clearError
  };
}

// ============================================================================
// Validation Alerts Hook
// ============================================================================

export function useValidationAlerts(): UseValidationAlertsResult {
  const [alerts, setAlerts] = useState<ValidationAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criticalCount = alerts.filter(alert => alert.severity === 'critical' && !alert.resolved).length;
  const highPriorityCount = alerts.filter(alert => alert.severity === 'high' && !alert.resolved).length;

  const fetchAlerts = useCallback(async (teamId?: number, leagueId?: number) => {
    setLoading(true);
    setError(null);

    try {
      let alertData: ValidationAlert[] = [];

      if (teamId) {
        console.log(`🚨 Fetching alerts for team ${teamId}...`);
        const validation = await lineupValidationAPI.validateTeam(teamId);
        alertData = await lineupValidationAPI.processAlerts(validation);
      } else if (leagueId) {
        console.log(`🚨 Fetching alerts for league ${leagueId}...`);
        const teamIds = await ValidationUtils.getKLeagueTeams(leagueId);
        
        // Get alerts for all teams in the league
        for (const id of teamIds.slice(0, 5)) { // Limit to prevent API overload
          try {
            const validation = await lineupValidationAPI.validateTeam(id);
            const teamAlerts = await lineupValidationAPI.processAlerts(validation);
            alertData.push(...teamAlerts);
          } catch (teamError) {
            console.warn(`Failed to get alerts for team ${id}:`, teamError);
          }
        }
      }

      setAlerts(alertData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
      console.error('Alert fetch error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const markResolved = useCallback(async (alertId: string) => {
    try {
      // Update local state optimistically
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolved: true, resolved_at: new Date().toISOString() }
          : alert
      ));

      // In a real implementation, this would call an API to persist the resolution
      console.log(`✅ Marked alert ${alertId} as resolved`);
    } catch (err) {
      console.error('Failed to mark alert as resolved:', err);
      // Revert optimistic update on error
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolved: false, resolved_at: undefined }
          : alert
      ));
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    alerts,
    loading,
    error,
    criticalCount,
    highPriorityCount,
    fetchAlerts,
    markResolved,
    clearError
  };
}

// ============================================================================
// Multi-Team Validation Hook
// ============================================================================

export function useMultiTeamValidation() {
  const [validations, setValidations] = useState<TeamLineupValidation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const validateMultipleTeams = useCallback(async (teamIds: number[], season = 2025) => {
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      setError('Invalid team IDs provided');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ completed: 0, total: teamIds.length });
    setValidations([]);

    try {
      console.log(`🔍 Validating ${teamIds.length} teams...`);
      
      const results: TeamLineupValidation[] = [];
      
      for (let i = 0; i < teamIds.length; i++) {
        const teamId = teamIds[i];
        
        try {
          const validation = await lineupValidationAPI.validateTeam(teamId, season);
          results.push(validation);
          setValidations([...results]); // Update UI progressively
          
          setProgress({ completed: i + 1, total: teamIds.length });
          
          // Rate limiting between teams
          if (i < teamIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (teamError) {
          console.warn(`Failed to validate team ${teamId}:`, teamError);
        }
      }
      
      setValidations(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Multi-team validation failed';
      console.error('Multi-team validation error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getAverageQualityScore = useCallback(() => {
    if (validations.length === 0) return 0;
    const sum = validations.reduce((acc, v) => acc + v.data_quality_score, 0);
    return Math.round(sum / validations.length);
  }, [validations]);

  const getTeamsNeedingAttention = useCallback(() => {
    return validations.filter(v => v.data_quality_score < 80);
  }, [validations]);

  return {
    validations,
    loading,
    error,
    progress,
    validateMultipleTeams,
    clearError,
    getAverageQualityScore,
    getTeamsNeedingAttention
  };
}

// ============================================================================
// Validation Status Hook (for monitoring)
// ============================================================================

export function useValidationStatus() {
  const [status, setStatus] = useState({
    apiHealthy: true,
    databaseConnected: true,
    lastCheck: new Date().toISOString(),
    rateLimitRemaining: 100
  });

  const checkHealth = useCallback(async () => {
    try {
      // This would call the health check endpoint
      console.log('🏥 Checking validation system health...');
      
      // Mock health check - in real implementation, call ValidationEndpoints.healthCheck()
      setStatus({
        apiHealthy: true,
        databaseConnected: true,
        lastCheck: new Date().toISOString(),
        rateLimitRemaining: 95
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setStatus(prev => ({
        ...prev,
        apiHealthy: false,
        lastCheck: new Date().toISOString()
      }));
    }
  }, []);

  useEffect(() => {
    // Check health on mount
    checkHealth();
    
    // Set up periodic health checks
    const interval = setInterval(checkHealth, 300000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    ...status,
    checkHealth
  };
}

// ============================================================================
// Utility Hook for K League Teams
// ============================================================================

export function useKLeagueTeams(leagueId = 292, season = 2025) {
  const [teams, setTeams] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchTeams = async () => {
      setLoading(true);
      setError(null);

      try {
        const teamIds = await ValidationUtils.getKLeagueTeams(leagueId, season);
        if (mounted) {
          setTeams(teamIds);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch teams');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchTeams();

    return () => {
      mounted = false;
    };
  }, [leagueId, season]);

  return { teams, loading, error };
}