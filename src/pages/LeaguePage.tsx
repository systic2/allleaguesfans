// src/pages/LeaguePage.tsx
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import EnhancedFixturesSection from "@/components/EnhancedFixturesSection";
import { 
  fetchLeagueBySlug, 
  fetchLeagueStandings, 
  fetchLeagueStats,
  fetchUpcomingFixtures,
  fetchTopScorers,
  fetchTopAssists,
  fetchHistoricalChampions,
  type LeagueDetail, 
  type TeamStanding,
  type LeagueStats,
  type UpcomingFixture,
  type TopScorer,
  type TopAssist,
  type HistoricalChampion,
} from "@/lib/api";

function LoadingState() {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-700 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-6">
                  <div className="h-4 bg-slate-700 rounded w-24 mb-3"></div>
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-8 bg-slate-700 rounded"></div>
                    ))}
                  </div>
                </div>
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

function LeagueHeader({ league, stats }: { league: LeagueDetail; stats?: LeagueStats }) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{league.name}</h1>
          <div className="flex items-center space-x-6 text-slate-400">
            {league.country && (
              <span className="text-sm">{league.country}</span>
            )}
            <span className="text-sm">{league.season} 시즌</span>
            {stats && (
              <>
                <span className="text-sm">팀: {stats.total_teams}개</span>
                <span className="text-sm">총 골: {stats.total_goals}골</span>
                <span className="text-sm">경기당 평균: {stats.avg_goals_per_match}골</span>
              </>
            )}
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

function UpcomingFixturesCard({ fixtures }: { fixtures: UpcomingFixture[] }) {
  if (fixtures.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">최근 경기</h3>
        <p className="text-slate-400 text-sm">최근 경기가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">최근 경기</h3>
      <div className="space-y-3">
        {fixtures.map((fixture) => (
          <div key={fixture.id} className="flex items-center justify-between p-3 bg-slate-700 rounded">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {fixture.home_team.logo_url && (
                  <img src={fixture.home_team.logo_url} alt="" className="w-5 h-5 object-contain" />
                )}
                <span className="text-white text-sm">{fixture.home_team.name}</span>
              </div>
              <span className="text-slate-400 text-xs">vs</span>
              <div className="flex items-center space-x-2">
                {fixture.away_team.logo_url && (
                  <img src={fixture.away_team.logo_url} alt="" className="w-5 h-5 object-contain" />
                )}
                <span className="text-white text-sm">{fixture.away_team.name}</span>
              </div>
            </div>
            <div className="text-slate-400 text-xs">
              {new Date(fixture.date_utc).toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric'
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopPlayersCard({ scorers, assists }: { scorers: TopScorer[]; assists: TopAssist[] }) {
  const [activeTab, setActiveTab] = useState<'scorers' | 'assists'>('scorers');

  const currentData = activeTab === 'scorers' ? scorers : assists;
  const isEmpty = currentData.length === 0;

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      {/* Tab Headers */}
      <div className="flex border-b border-slate-700 mb-4">
        <button
          onClick={() => setActiveTab('scorers')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'scorers'
              ? 'text-white border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          득점왕
        </button>
        <button
          onClick={() => setActiveTab('assists')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'assists'
              ? 'text-white border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          도움왕
        </button>
      </div>

      {/* Content */}
      {isEmpty ? (
        <p className="text-slate-400 text-sm">
          {activeTab === 'scorers' ? '득점 기록이 없습니다.' : '도움 기록이 없습니다.'}
        </p>
      ) : (
        <div className="space-y-3">
          {currentData.map((player, index) => (
            <div key={`${player.player_name}-${player.team_name}`} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-600 text-black' : 'bg-slate-600 text-white'}
                `}>
                  {index + 1}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{player.player_name}</div>
                  <div className="text-slate-400 text-xs">{player.team_name}</div>
                </div>
              </div>
              <div className={`font-bold ${activeTab === 'scorers' ? 'text-green-400' : 'text-blue-400'}`}>
                {activeTab === 'scorers' ? (player as TopScorer).goals : (player as TopAssist).assists}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoricalChampionsCard({ champions }: { champions: HistoricalChampion[] }) {
  if (champions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">역대 우승팀</h3>
        <p className="text-slate-400 text-sm">우승 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">역대 우승팀</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {champions.map((champion) => (
          <div key={champion.season_year} className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              {champion.champion_logo && (
                <img 
                  src={champion.champion_logo} 
                  alt={champion.champion_name}
                  className="w-5 h-5 object-contain"
                />
              )}
              <span className="text-white text-sm">{champion.champion_name}</span>
            </div>
            <span className="text-slate-400 text-sm">{champion.season_year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueStatsCard({ stats }: { stats: LeagueStats }) {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">리그 통계</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.total_teams}</div>
          <div className="text-slate-400 text-xs">팀</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.total_goals}</div>
          <div className="text-slate-400 text-xs">총 골</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.total_matches}</div>
          <div className="text-slate-400 text-xs">경기</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.avg_goals_per_match}</div>
          <div className="text-slate-400 text-xs">경기당 골</div>
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

  const { data: stats } = useQuery({
    queryKey: ["leagueStats", league?.id],
    queryFn: () => fetchLeagueStats(league!.id),
    enabled: !!league?.id,
  });

  const { data: upcomingFixtures = [] } = useQuery({
    queryKey: ["upcomingFixtures", league?.id],
    queryFn: () => fetchUpcomingFixtures(league!.id),
    enabled: !!league?.id,
  });

  const { data: topScorers = [] } = useQuery({
    queryKey: ["topScorers", league?.id],
    queryFn: () => fetchTopScorers(league!.id),
    enabled: !!league?.id,
  });

  const { data: topAssists = [] } = useQuery({
    queryKey: ["topAssists", league?.id],
    queryFn: () => fetchTopAssists(league!.id),
    enabled: !!league?.id,
  });

  const { data: champions = [] } = useQuery({
    queryKey: ["historicalChampions", league?.id],
    queryFn: () => fetchHistoricalChampions(league!.id),
    enabled: !!league?.id,
  });

  if (leagueLoading) return <LoadingState />;
  
  if (leagueError || !league) {
    return <ErrorState message="리그 정보를 불러올 수 없습니다." />;
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <LeagueHeader league={league} stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 순위표 */}
          <div className="lg:col-span-2">
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

          {/* 오른쪽: 사이드바 정보 */}
          <div className="space-y-6">
            {stats && <LeagueStatsCard stats={stats} />}
            <EnhancedFixturesSection 
              leagueId={league.id} 
              season={league.season} 
              upcomingFixtures={upcomingFixtures} 
            />
            <TopPlayersCard scorers={topScorers} assists={topAssists} />
            <HistoricalChampionsCard champions={champions} />
          </div>
        </div>
      </div>
    </div>
  );
}