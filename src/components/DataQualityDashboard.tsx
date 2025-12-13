import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Settings, RefreshCw } from 'lucide-react';

interface QualityMetrics {
  overall_score: number;
  jersey_accuracy: number;
  data_completeness: number;
  last_update: string;
  total_players: number;
  validated_players: number;
  pending_corrections: number;
}

interface JerseyMismatch {
  player_id: number;
  player_name: string;
  team_name: string;
  db_jersey: number | null;
  api_jersey: number | null;
  confidence: number;
  status: 'pending' | 'corrected' | 'flagged';
}

interface TransferAlert {
  id: number;
  type: 'departure' | 'arrival' | 'retirement';
  player_name: string;
  team_name: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

const DataQualityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [jerseyMismatches, setJerseyMismatches] = useState<JerseyMismatch[]>([]);
  const [transferAlerts, setTransferAlerts] = useState<TransferAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'jerseys' | 'transfers' | 'settings'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedTeam]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Mock data - replace with actual API calls
      setMetrics({
        overall_score: 93.1,
        jersey_accuracy: 95.2,
        data_completeness: 87.4,
        last_update: new Date().toISOString(),
        total_players: 1000,
        validated_players: 931,
        pending_corrections: 12
      });

      setJerseyMismatches([
        {
          player_id: 1,
          player_name: '김민재',
          team_name: '전북 현대 모터스',
          db_jersey: 3,
          api_jersey: 19,
          confidence: 0.95,
          status: 'pending'
        },
        {
          player_id: 2,
          player_name: '이강인',
          team_name: 'FC 서울',
          db_jersey: 22,
          api_jersey: 18,
          confidence: 0.88,
          status: 'flagged'
        }
      ]);

      setTransferAlerts([
        {
          id: 1,
          type: 'arrival',
          player_name: '브루노 올리베이라',
          team_name: '강원 FC',
          confidence: 0.92,
          priority: 'high',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          type: 'departure',
          player_name: '박주호',
          team_name: '울산 현대',
          confidence: 0.86,
          priority: 'medium',
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-600 dark:text-green-400';
    if (score >= 85) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 95) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 85) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
    }
  };

  const handleAutoCorrect = async (mismatch: JerseyMismatch) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setJerseyMismatches(prev => 
        prev.map(item => 
          item.player_id === mismatch.player_id 
            ? { ...item, status: 'corrected' as const, db_jersey: item.api_jersey }
            : item
        )
      );
    } catch (error) {
      console.error('Auto-correction failed:', error);
    }
  };

  const handleTransferReview = async (alertId: number, _action: 'approve' | 'dismiss') => {
    try {
      setTransferAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Transfer review failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg font-medium">데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">데이터 품질 대시보드</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">K리그 선수 데이터 정확성 모니터링</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">전체 팀</option>
            <option value="jeonbuk">전북 현대 모터스</option>
            <option value="seoul">FC 서울</option>
            <option value="ulsan">울산 현대</option>
          </select>
          <button 
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {(
            [
              { id: 'overview', label: '개요', icon: TrendingUp },
              { id: 'jerseys', label: '등번호 검증', icon: CheckCircle },
              { id: 'transfers', label: '이적 알림', icon: AlertTriangle },
              { id: 'settings', label: '설정', icon: Settings }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quality Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div className={`p-6 rounded-lg border ${getScoreBgColor(metrics?.overall_score || 0)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">전체 품질 점수</p>
                  <p className={`text-3xl font-bold ${getScoreColor(metrics?.overall_score || 0)}`}>
                    {metrics?.overall_score.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className={`w-8 h-8 ${getScoreColor(metrics?.overall_score || 0)}`} />
              </div>
            </div>

            <div className={`p-6 rounded-lg border ${getScoreBgColor(metrics?.jersey_accuracy || 0)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">등번호 정확도</p>
                  <p className={`text-3xl font-bold ${getScoreColor(metrics?.jersey_accuracy || 0)}`}>
                    {metrics?.jersey_accuracy.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className={`w-8 h-8 ${getScoreColor(metrics?.jersey_accuracy || 0)}`} />
              </div>
            </div>

            <div className={`p-6 rounded-lg border ${getScoreBgColor(metrics?.data_completeness || 0)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">데이터 완성도</p>
                  <p className={`text-3xl font-bold ${getScoreColor(metrics?.data_completeness || 0)}`}>
                    {metrics?.data_completeness.toFixed(1)}%
                  </p>
                </div>
                <Users className={`w-8 h-8 ${getScoreColor(metrics?.data_completeness || 0)}`} />
              </div>
            </div>

            <div className="p-6 rounded-lg border bg-blue-100 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">수정 대기</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {metrics?.pending_corrections}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">상태 요약</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">전체 선수:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{metrics?.total_players}명</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">검증된 선수:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{metrics?.validated_players}명</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">마지막 업데이트:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {new Date(metrics?.last_update || '').toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Jersey Validation Tab */}
      {activeTab === 'jerseys' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">등번호 불일치 항목</h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoCorrectEnabled}
                  onChange={(e) => setAutoCorrectEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">자동 수정 활성화</span>
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      선수명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      팀
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      DB 등번호
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      API 등번호
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      신뢰도
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {jerseyMismatches.map((mismatch) => (
                    <tr key={mismatch.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {mismatch.player_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {mismatch.team_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        #{mismatch.db_jersey || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        #{mismatch.api_jersey || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {(mismatch.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          mismatch.status === 'corrected' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : mismatch.status === 'flagged'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {mismatch.status === 'corrected' ? '수정됨' : 
                           mismatch.status === 'flagged' ? '검토중' : '대기중'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {mismatch.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAutoCorrect(mismatch)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              자동수정
                            </button>
                            <button className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
                              플래그
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Alerts Tab */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">이적 감지 알림</h3>
          
          <div className="grid gap-4">
            {transferAlerts.map((alert) => (
              <div key={alert.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                      {alert.priority === 'high' ? '높음' : alert.priority === 'medium' ? '보통' : '낮음'}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{alert.player_name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {alert.team_name} • {alert.type === 'arrival' ? '영입' : alert.type === 'departure' ? '이적' : '은퇴'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      신뢰도: {(alert.confidence * 100).toFixed(1)}%
                    </span>
                    <button
                      onClick={() => handleTransferReview(alert.id, 'approve')}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleTransferReview(alert.id, 'dismiss')}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
                    >
                      무시
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">시스템 설정</h3>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">자동화 설정</h4>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">높은 신뢰도 등번호 자동 수정 (90% 이상)</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">이적 알림 자동 생성</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">실시간 데이터 동기화</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">알림 설정</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">최소 신뢰도 임계값</label>
                  <input 
                    type="range" 
                    min="50" 
                    max="100" 
                    defaultValue="80" 
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>50%</span>
                    <span>80%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">데이터 동기화</h4>
              <div className="space-y-3">
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  전체 데이터 동기화 실행
                </button>
                <button className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  증분 동기화 실행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataQualityDashboard;