import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TeamStanding } from '@/lib/api';
import { fetchEnhancedLeagueStandings, type EnhancedTeamStanding } from '@/lib/enhanced-standings-api'; // Fixed API with league mapping

/**
 * Standings Section Component
 * 
 * Displays standings information with Korean UI
 * 
 * Features:
 * - Responsive design with consistent styling
 * - Korean language support for UI text
 * - Comprehensive error handling and loading states
 */
interface StandingsSectionProps {
  /** Standings data from database for detailed display (legacy support) */
  standings?: TeamStanding[] | undefined;
  /** Loading state for database standings (legacy support) */
  isLoading?: boolean;
  /** Error state for database standings (legacy support) */
  error?: Error | null;
  /** League slug for enhanced standings (preferred) - e.g., 'k-league-1', 'k-league-2' */
  leagueSlug?: string;
  /** Legacy league ID support - will be converted to slug */
  leagueId?: number;
  /** Season year */
  season?: number;
  /** Additional CSS classes for styling */
  className?: string;
}

/**
 * Enhanced standings table component with computed recent form
 * @param standings - Array of team standings (enhanced or regular)
 */
function StandingsTable({ standings }: { standings: (TeamStanding | EnhancedTeamStanding)[] }) {
  return (
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
            <th className="text-center px-4 py-3 font-medium">득점</th>
            <th className="text-center px-4 py-3 font-medium">실점</th>
            <th className="text-center px-4 py-3 font-medium">득실차</th>
            <th className="text-center px-4 py-3 font-medium">승점</th>
            <th className="text-center px-4 py-3 font-medium">최근경기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {standings.map((team, index) => (
            <tr 
              key={team.team_id} 
              className={`
                hover:bg-slate-700/50 transition-colors
                ${index < 3 ? 'bg-green-900/10' : ''}
                ${index >= standings.length - 3 ? 'bg-red-900/10' : ''}
              `}
            >
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <span className={`
                    text-sm font-medium
                    ${index < 3 ? 'text-green-400' : ''}
                    ${index >= standings.length - 3 ? 'text-red-400' : 'text-white'}
                  `}>
                    {team.rank}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Link 
                  to={`/teams/${team.team_id}`}
                  className="flex items-center hover:text-blue-400 transition-colors"
                >
                  {team.crest_url && (
                    <img 
                      src={team.crest_url} 
                      alt={team.team_name}
                      className="w-6 h-6 mr-3 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <div className="text-white font-medium text-sm">
                      {team.team_name}
                    </div>
                    {team.short_name && (
                      <div className="text-slate-400 text-xs">
                        {team.short_name}
                      </div>
                    )}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-center text-white text-sm">
                {team.played}
              </td>
              <td className="px-4 py-3 text-center text-green-400 text-sm font-medium">
                {team.win}
              </td>
              <td className="px-4 py-3 text-center text-yellow-400 text-sm font-medium">
                {team.draw}
              </td>
              <td className="px-4 py-3 text-center text-red-400 text-sm font-medium">
                {team.lose}
              </td>
              {/* Goals For */}
              <td className="px-4 py-3 text-center text-blue-400 text-sm font-medium">
                {team.goals_for}
              </td>
              {/* Goals Against */}
              <td className="px-4 py-3 text-center text-orange-400 text-sm font-medium">
                {team.goals_against}
              </td>
              {/* Goal Difference */}
              <td className={`px-4 py-3 text-center text-sm font-medium ${
                team.goals_diff > 0 ? 'text-green-400' : 
                team.goals_diff < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {team.goals_diff > 0 ? '+' : ''}{team.goals_diff}
              </td>
              <td className="px-4 py-3 text-center text-white text-sm font-bold">
                {team.points}
              </td>
              {/* Recent Form - Enhanced Display */}
              <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center space-y-1">
                  {team.form && team.form.length > 0 ? (
                    <>
                      <div className="flex justify-center space-x-1">
                        {team.form.split('').slice(-5).map((result, idx) => (
                          <div
                            key={idx}
                            className={`
                              w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold
                              ${result === 'W' ? 'bg-green-500' : ''}
                              ${result === 'D' ? 'bg-yellow-500' : ''}
                              ${result === 'L' ? 'bg-red-500' : ''}
                            `}
                            title={`${result === 'W' ? '승리' : result === 'D' ? '무승부' : '패배'}`}
                          >
                            {result}
                          </div>
                        ))}
                      </div>
                      {'form_details' in team && team.form_details && (
                        <div className="text-xs text-slate-400">
                          {team.form_details.wins}승 {team.form_details.draws}무 {team.form_details.losses}패
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">
                      데이터 없음
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Loading state component for standings
 */
function StandingsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-slate-700 rounded"></div>
      {[...Array(12)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-700 rounded"></div>
      ))}
    </div>
  );
}

/**
 * Error state component for standings
 */
function StandingsError({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-red-400 mb-2">❌ 오류 발생</div>
      <div className="text-slate-400 text-sm">{message}</div>
    </div>
  );
}

/**
 * Main Enhanced Standings Section component
 */
export default function StandingsSection({ 
  standings,
  isLoading,
  error,
  leagueSlug,
  leagueId,
  season = 2025,
  className = ''
}: StandingsSectionProps) {
  
  // Convert legacy leagueId to slug if needed (backward compatibility)
  const effectiveLeagueSlug = leagueSlug || (leagueId ? 
    (leagueId === 4001 || leagueId === 1 ? 'k-league-1' : 
     leagueId === 4002 || leagueId === 2 ? 'k-league-2' : 
     `league-${leagueId}`) : undefined);
  
  // Use enhanced API if slug is available, otherwise use legacy props
  const { 
    data: enhancedStandings, 
    isLoading: enhancedLoading, 
    error: enhancedError 
  } = useQuery({
    queryKey: ["enhancedStandings", effectiveLeagueSlug, season],
    queryFn: () => fetchEnhancedLeagueStandings(effectiveLeagueSlug!, season),
    enabled: !!effectiveLeagueSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Determine which data to use
  const finalStandings = effectiveLeagueSlug ? enhancedStandings : standings;
  const finalLoading = effectiveLeagueSlug ? enhancedLoading : (isLoading ?? false);
  const finalError = effectiveLeagueSlug ? enhancedError : error;
  const isEnhanced = !!effectiveLeagueSlug && !!enhancedStandings;

  return (
    <div className={`bg-slate-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-lg font-semibold">순위표</h2>
          {isEnhanced && (
            <div className="text-slate-400 text-sm">
              최근경기 데이터 포함 ✨
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {finalLoading ? (
          <StandingsLoading />
        ) : finalError ? (
          <StandingsError message="순위표를 불러올 수 없습니다." />
        ) : finalStandings && finalStandings.length > 0 ? (
          <StandingsTable standings={finalStandings} />
        ) : (
          <div className="text-center py-12">
            <div className="text-slate-400">
              이 리그의 순위표 정보가 없습니다.
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Information Footer */}
      {isEnhanced && finalStandings && finalStandings.length > 0 && (
        <div className="bg-slate-750 px-6 py-3 border-t border-slate-600">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <div>
              득점/실점: 팀별 공격력과 수비력 | 최근경기: 최근 5경기 승무패 기록
            </div>
            <div>
              🟢 상위권 | 🔴 하위권
            </div>
          </div>
        </div>
      )}
    </div>
  );
}