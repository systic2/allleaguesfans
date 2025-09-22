// src/components/LineupValidationDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  useLineupValidation, 
  useTransferDetection, 
  useValidationAlerts, 
  useMultiTeamValidation,
  useKLeagueTeams,
  useValidationStatus
} from '@/hooks/useLineupValidation';
import type { TeamLineupValidation, PlayerValidationResult } from '@/lib/lineup-validation-api';

// ============================================================================
// Types
// ============================================================================

interface LineupValidationDashboardProps {
  initialTeamId?: number;
  leagueId?: number;
  season?: number;
}

// ============================================================================
// Sub-components
// ============================================================================

const QualityScoreIndicator: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const getColorClass = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-yellow-600 bg-yellow-100';
    if (score >= 70) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3'
  };

  return (
    <div className={`inline-flex items-center rounded-full font-medium ${getColorClass(score)} ${sizeClasses[size]}`}>
      {score}%
    </div>
  );
};

const PlayerValidationCard: React.FC<{ result: PlayerValidationResult }> = ({ result }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return '✅';
      case 'jersey_mismatch': return '🔢';
      case 'position_mismatch': return '📍';
      case 'missing_from_api': return '❓';
      case 'missing_from_db': return '➕';
      case 'transfer_detected': return '🔄';
      default: return '⚠️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'border-green-200 bg-green-50';
      case 'jersey_mismatch': return 'border-yellow-200 bg-yellow-50';
      case 'position_mismatch': return 'border-orange-200 bg-orange-50';
      case 'missing_from_api': return 'border-purple-200 bg-purple-50';
      case 'missing_from_db': return 'border-blue-200 bg-blue-50';
      case 'transfer_detected': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getStatusColor(result.status)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon(result.status)}</span>
          <div>
            <h4 className="font-medium text-gray-900">{result.name}</h4>
            <p className="text-sm text-gray-600">
              #{result.jersey_number_db || result.jersey_number_api || 'N/A'} • {result.position_db || result.position_api || 'Unknown'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            신뢰도: {Math.round(result.confidence * 100)}%
          </p>
        </div>
      </div>
      
      {result.issues.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.issues.map((issue, index) => (
            <p key={index} className="text-xs text-gray-700 bg-white bg-opacity-60 rounded px-2 py-1">
              {issue}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const ValidationSummaryCard: React.FC<{ validation: TeamLineupValidation }> = ({ validation }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {validation.team_name} 검증 결과
        </h3>
        <QualityScoreIndicator score={validation.data_quality_score} />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{validation.total_players}</p>
          <p className="text-sm text-gray-600">총 선수</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{validation.valid_players}</p>
          <p className="text-sm text-gray-600">정확</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{validation.issues_detected}</p>
          <p className="text-sm text-gray-600">문제</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{validation.recommendations.length}</p>
          <p className="text-sm text-gray-600">권장사항</p>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        마지막 검증: {new Date(validation.validation_timestamp).toLocaleString('ko-KR')}
      </div>
    </div>
  );
};

const RecommendationsList: React.FC<{ recommendations: string[] }> = ({ recommendations }) => {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="font-medium text-blue-900 mb-2">📋 권장사항</h4>
      <ul className="space-y-1">
        {recommendations.map((rec, index) => (
          <li key={index} className="text-sm text-blue-800 flex items-start">
            <span className="mr-2 text-blue-600">•</span>
            {rec}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

const LineupValidationDashboard: React.FC<LineupValidationDashboardProps> = ({
  initialTeamId,
  leagueId = 292,
  season = 2025
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(initialTeamId);
  const [activeTab, setActiveTab] = useState<'single' | 'multi' | 'transfers' | 'alerts'>('single');
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(false);

  // Hooks
  const { teams: availableTeams } = useKLeagueTeams(leagueId, season);
  const validationStatus = useValidationStatus();
  
  const singleTeamValidation = useLineupValidation({
    teamId: selectedTeamId,
    season,
    autoRefresh: true,
    refreshInterval: 1800000, // 30 minutes
    enableAlerts: true,
    autoCorrect: autoCorrectEnabled
  });

  const multiTeamValidation = useMultiTeamValidation();
  const transferDetection = useTransferDetection();
  const validationAlerts = useValidationAlerts();

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeamId && availableTeams.length > 0) {
      setSelectedTeamId(availableTeams[0]);
    }
  }, [selectedTeamId, availableTeams]);

  // Handlers
  const handleTeamSelect = (teamId: number) => {
    setSelectedTeamId(teamId);
  };

  const handleRefresh = async () => {
    if (activeTab === 'single' && selectedTeamId) {
      await singleTeamValidation.refresh();
    } else if (activeTab === 'multi' && availableTeams.length > 0) {
      await multiTeamValidation.validateMultipleTeams(availableTeams.slice(0, 5), season);
    } else if (activeTab === 'transfers') {
      await transferDetection.detectTransfers(availableTeams, season);
    } else if (activeTab === 'alerts') {
      await validationAlerts.fetchAlerts(undefined, leagueId);
    }
  };

  const handleApplyCorrections = async () => {
    if (!singleTeamValidation.validation) return;
    
    try {
      const result = await singleTeamValidation.applyCorrections({
        autoFixJerseyNumbers: true,
        autoFixPositions: true,
        addMissingPlayers: false,
        flagTransfers: true
      });
      
      alert(`수정 완료: ${result.applied}개 항목이 수정되었습니다.`);
    } catch (error) {
      alert(`수정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">라인업 검증 시스템</h1>
          <p className="text-gray-600">실시간 선수 데이터 검증 및 관리</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* System Status */}
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              validationStatus.apiHealthy ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-gray-600">
              API 상태: {validationStatus.apiHealthy ? '정상' : '오류'}
            </span>
          </div>
          
          {/* Auto-correct toggle */}
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoCorrectEnabled}
              onChange={(e) => setAutoCorrectEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>자동 수정</span>
          </label>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={singleTeamValidation.loading || singleTeamValidation.refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {singleTeamValidation.loading || singleTeamValidation.refreshing ? '새로고침 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'single', label: '단일 팀 검증' },
            { id: 'multi', label: '리그 전체 검증' },
            { id: 'transfers', label: '이적 감지' },
            { id: 'alerts', label: '알림' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'single' && (
        <div className="space-y-6">
          {/* Team Selector */}
          {availableTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                검증할 팀 선택
              </label>
              <select
                value={selectedTeamId || ''}
                onChange={(e) => handleTeamSelect(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">팀을 선택하세요</option>
                {availableTeams.map(teamId => (
                  <option key={teamId} value={teamId}>
                    Team {teamId}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Display */}
          {singleTeamValidation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{singleTeamValidation.error}</p>
              <button
                onClick={singleTeamValidation.clearError}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                오류 지우기
              </button>
            </div>
          )}

          {/* Loading State */}
          {singleTeamValidation.loading && !singleTeamValidation.validation && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">검증 중...</span>
            </div>
          )}

          {/* Validation Results */}
          {singleTeamValidation.validation && (
            <div className="space-y-6">
              {/* Summary */}
              <ValidationSummaryCard validation={singleTeamValidation.validation} />

              {/* Action Buttons */}
              {singleTeamValidation.validation.issues_detected > 0 && (
                <div className="flex space-x-4">
                  <button
                    onClick={handleApplyCorrections}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    🔧 수정 적용 ({singleTeamValidation.validation.issues_detected}개 문제)
                  </button>
                </div>
              )}

              {/* Recommendations */}
              <RecommendationsList recommendations={singleTeamValidation.validation.recommendations} />

              {/* Player Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">선수별 검증 결과</h3>
                <div className="grid gap-3">
                  {singleTeamValidation.validation.validation_results
                    .sort((a, b) => {
                      // Sort by status (issues first) then by name
                      if (a.status === 'valid' && b.status !== 'valid') return 1;
                      if (a.status !== 'valid' && b.status === 'valid') return -1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((result) => (
                      <PlayerValidationCard key={`${result.player_id}-${result.team_id}`} result={result} />
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'multi' && (
        <div className="space-y-6">
          {/* Multi-team controls */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">리그 전체 검증</h3>
            <button
              onClick={() => multiTeamValidation.validateMultipleTeams(availableTeams.slice(0, 5), season)}
              disabled={multiTeamValidation.loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {multiTeamValidation.loading ? '검증 중...' : '전체 팀 검증'}
            </button>
          </div>

          {/* Progress */}
          {multiTeamValidation.loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>진행률</span>
                <span>{multiTeamValidation.progress.completed}/{multiTeamValidation.progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(multiTeamValidation.progress.completed / multiTeamValidation.progress.total) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Multi-team results */}
          {multiTeamValidation.validations.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-2">평균 품질 점수</h4>
                  <QualityScoreIndicator score={multiTeamValidation.getAverageQualityScore()} size="lg" />
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-2">검증된 팀</h4>
                  <p className="text-2xl font-bold text-gray-900">{multiTeamValidation.validations.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-2">주의 필요 팀</h4>
                  <p className="text-2xl font-bold text-red-600">{multiTeamValidation.getTeamsNeedingAttention().length}</p>
                </div>
              </div>

              <div className="grid gap-4">
                {multiTeamValidation.validations.map((validation) => (
                  <ValidationSummaryCard key={validation.team_id} validation={validation} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">이적 감지</h3>
            <button
              onClick={() => transferDetection.detectTransfers(availableTeams, season)}
              disabled={transferDetection.loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {transferDetection.loading ? '감지 중...' : '이적 감지 실행'}
            </button>
          </div>

          {transferDetection.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{transferDetection.error}</p>
            </div>
          )}

          {transferDetection.transfers.length > 0 && (
            <div className="space-y-4">
              {transferDetection.transfers.map((transfer, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">선수 ID: {transfer.player_id}</h4>
                      <p className="text-sm text-gray-600">
                        {transfer.status_change === 'transfer' && '이적'} 
                        {transfer.status_change === 'new_signing' && '신규 영입'}
                        {transfer.status_change === 'retirement' && '은퇴 가능성'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        신뢰도: {Math.round(transfer.confidence * 100)}%
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(transfer.detected_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">검증 알림</h3>
              <p className="text-sm text-gray-600">
                긴급: {validationAlerts.criticalCount} • 높음: {validationAlerts.highPriorityCount}
              </p>
            </div>
            <button
              onClick={() => validationAlerts.fetchAlerts(undefined, leagueId)}
              disabled={validationAlerts.loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {validationAlerts.loading ? '조회 중...' : '알림 새로고침'}
            </button>
          </div>

          {validationAlerts.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{validationAlerts.error}</p>
            </div>
          )}

          {validationAlerts.alerts.length > 0 ? (
            <div className="space-y-3">
              {validationAlerts.alerts
                .filter(alert => !alert.resolved)
                .sort((a, b) => {
                  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return severityOrder[a.severity] - severityOrder[b.severity];
                })
                .map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`border rounded-lg p-4 ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                      alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">{alert.team_name}</span>
                        </div>
                        <p className="text-gray-900 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.created_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <button
                        onClick={() => validationAlerts.markResolved(alert.id)}
                        className="ml-4 text-sm text-gray-600 hover:text-gray-800"
                      >
                        해결됨으로 표시
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              현재 활성화된 알림이 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LineupValidationDashboard;