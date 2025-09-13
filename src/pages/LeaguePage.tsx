// src/pages/LeaguePage.tsx
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  fetchLeagueBySlug, 
  fetchLeagueStandings, 
  type LeagueDetail, 
  type TeamStanding 
} from "@/lib/api";

function LoadingState() {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-64 mb-6"></div>
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
          <h2 className="text-red-400 text-lg font-semibold mb-2">오류 발생</h2>
          <p className="text-red-300">{message}</p>
        </div>
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-white text-lg font-semibold">순위표</h2>
      </div>
      
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
    </div>
  );
}

function LeagueHeader({ league }: { league: LeagueDetail }) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{league.name}</h1>
          <div className="flex items-center space-x-4 text-slate-400">
            {league.country && (
              <span className="text-sm">{league.country}</span>
            )}
            <span className="text-sm">{league.season} 시즌</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-sm">리그 ID</div>
          <div className="text-white font-mono">{league.id}</div>
        </div>
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: league, isLoading: leagueLoading, error: leagueError } = useQuery({
    queryKey: ["league", slug],
    queryFn: () => fetchLeagueBySlug(slug!),
    enabled: !!slug,
  });

  const { data: standings, isLoading: standingsLoading, error: standingsError } = useQuery({
    queryKey: ["standings", league?.id],
    queryFn: () => fetchLeagueStandings(league!.id),
    enabled: !!league?.id,
  });

  if (leagueLoading) return <LoadingState />;
  
  if (leagueError || !league) {
    return <ErrorState message="리그 정보를 불러올 수 없습니다." />;
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <LeagueHeader league={league} />

        {standingsLoading ? (
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-slate-700 rounded w-32"></div>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        ) : standingsError ? (
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="text-red-400">순위표를 불러올 수 없습니다.</div>
          </div>
        ) : standings && standings.length > 0 ? (
          <StandingsTable standings={standings} />
        ) : (
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="text-slate-400 text-center">
              이 리그의 순위표 정보가 없습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}