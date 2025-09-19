import { Link } from 'react-router-dom';
import type { TeamStanding } from '@/lib/api';

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
  /** Standings data from database for detailed display */
  standings: TeamStanding[] | undefined;
  /** Loading state for database standings */
  isLoading: boolean;
  /** Error state for database standings */
  error: Error | null;
  /** Additional CSS classes for styling */
  className?: string;
}

/**
 * Database-based standings table component with Korean UI
 * @param standings - Array of team standings from database
 */
function StandingsTable({ standings }: { standings: TeamStanding[] }) {
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
              <td className={`px-4 py-3 text-center text-sm font-medium ${
                team.goals_diff > 0 ? 'text-green-400' : 
                team.goals_diff < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {team.goals_diff > 0 ? '+' : ''}{team.goals_diff}
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
 * Main Standings Section component
 */
export default function StandingsSection({ 
  standings,
  isLoading,
  error,
  className = ''
}: StandingsSectionProps) {
  
  return (
    <div className={`bg-slate-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-white text-lg font-semibold">순위표</h2>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <StandingsLoading />
        ) : error ? (
          <StandingsError message="순위표를 불러올 수 없습니다." />
        ) : standings && standings.length > 0 ? (
          <StandingsTable standings={standings} />
        ) : (
          <div className="text-center py-12">
            <div className="text-slate-400">
              이 리그의 순위표 정보가 없습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}