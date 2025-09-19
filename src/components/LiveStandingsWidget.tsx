import { useState, useEffect } from 'react';
import { fetchStandingsProxy, type StandingTeam } from '@/lib/api-football-proxy';

/**
 * Live Standings Widget Component
 * 
 * A custom implementation of live standings data from API-Football
 * that displays real-time standings information with auto-refresh
 */
interface LiveStandingsWidgetProps {
  /** League ID (K League 1: 292, K League 2: 293) */
  leagueId: number;
  /** Season year (e.g., 2025) */
  season: number;
  /** Additional CSS classes for styling */
  className?: string;
}

// StandingData는 이제 api-football-proxy.ts에서 StandingTeam으로 정의됨

// APIResponse는 더 이상 필요하지 않음 (프록시 API 사용)

export default function LiveStandingsWidget({ 
  leagueId, 
  season, 
  className = '' 
}: LiveStandingsWidgetProps) {
  const [standings, setStandings] = useState<StandingTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStandings = async () => {
    try {
      console.log('🔄 프록시를 통한 순위표 데이터 요청 중...', { leagueId, season });
      setLoading(true);
      
      const standingsData = await fetchStandingsProxy(leagueId, season);
      
      setStandings(standingsData);
      setError(null);
      setLastUpdate(new Date());
      console.log('✅ 순위표 데이터 로드 완료:', standingsData.length, '팀');
    } catch (err) {
      console.error('❌ 순위표 로드 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 및 15초마다 자동 새로고침
  useEffect(() => {
    fetchStandings();
    
    const interval = setInterval(() => {
      fetchStandings();
    }, 15000); // 15초마다 새로고침

    return () => clearInterval(interval);
  }, [leagueId, season]);

  // 프록시 API를 사용하므로 API 키 체크 불필요

  // 에러가 발생한 경우
  if (error) {
    return (
      <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">❌ 오류 발생</div>
          <div className="text-slate-400 text-sm">{error}</div>
          <button 
            onClick={fetchStandings}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <div className="text-slate-400 text-sm mt-3">실시간 순위표를 로드하는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-slate-400 text-sm">실시간 업데이트</span>
        </div>
        <div className="text-slate-500 text-xs">
          마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
        </div>
      </div>

      {/* 순위표 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-750">
            <tr className="text-slate-300 text-sm">
              <th className="text-left px-4 py-3 font-medium">순위</th>
              <th className="text-left px-4 py-3 font-medium">팀</th>
              <th className="text-center px-4 py-3 font-medium">경기</th>
              <th className="text-center px-4 py-3 font-medium">승</th>
              <th className="text-center px-4 py-3 font-medium">무</th>
              <th className="text-center px-4 py-3 font-medium">패</th>
              <th className="text-center px-4 py-3 font-medium">득실차</th>
              <th className="text-center px-4 py-3 font-medium">승점</th>
              <th className="text-center px-4 py-3 font-medium">최근경기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {standings.map((team, index) => (
              <tr 
                key={team.team.id} 
                className={`
                  hover:bg-slate-700/50 transition-colors
                  ${index < 6 ? 'bg-green-900/10' : ''}
                  ${index >= standings.length - 3 ? 'bg-red-900/10' : ''}
                `}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <span className={`
                      text-sm font-medium
                      ${index < 6 ? 'text-green-400' : ''}
                      ${index >= standings.length - 3 ? 'text-red-400' : 'text-white'}
                    `}>
                      {team.rank}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <img 
                      src={team.team.logo} 
                      alt={team.team.name}
                      className="w-6 h-6 mr-3 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <div className="text-white font-medium text-sm">
                        {team.team.name}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {team.description}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-white text-sm">
                  {team.all.played}
                </td>
                <td className="px-4 py-3 text-center text-green-400 text-sm font-medium">
                  {team.all.win}
                </td>
                <td className="px-4 py-3 text-center text-yellow-400 text-sm font-medium">
                  {team.all.draw}
                </td>
                <td className="px-4 py-3 text-center text-red-400 text-sm font-medium">
                  {team.all.lose}
                </td>
                <td className={`px-4 py-3 text-center text-sm font-medium ${
                  team.goalsDiff > 0 ? 'text-green-400' : 
                  team.goalsDiff < 0 ? 'text-red-400' : 'text-white'
                }`}>
                  {team.goalsDiff > 0 ? '+' : ''}{team.goalsDiff}
                </td>
                <td className="px-4 py-3 text-center text-white text-sm font-bold">
                  {team.points}
                </td>
                <td className="px-4 py-3 text-center">
                  {team.form && (
                    <div className="flex justify-center space-x-1">
                      {team.form.split('').slice(-5).map((result, idx) => (
                        <div
                          key={idx}
                          className={`
                            w-4 h-4 rounded-full text-xs flex items-center justify-center text-white font-bold
                            ${result === 'W' ? 'bg-green-500' : ''}
                            ${result === 'D' ? 'bg-yellow-500' : ''}
                            ${result === 'L' ? 'bg-red-500' : ''}
                          `}
                        >
                          {result}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 푸터 */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Powered by API-Football</span>
          <span>15초마다 자동 업데이트</span>
        </div>
      </div>
    </div>
  );
}