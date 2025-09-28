// src/pages/LeaguePage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import RoundBasedFixturesSection from "@/components/RoundBasedFixturesSection";
import TheSportsDBFixturesSection from "@/components/TheSportsDBFixturesSection";
import StandingsSection from "@/components/EnhancedStandingsSection";
import { 
  fetchLeagueBySlug, 
  fetchLeagueStandings, 
  fetchLeagueStats,
  fetchTopScorers,
  fetchTopAssists,
  fetchHistoricalChampions,
  type LeagueDetail,
  type LeagueStats,
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
  // Calculate expected total matches for full season
  const expectedMatchesPerRound = stats.total_teams ? (stats.total_teams / 2) : 6;
  const currentRound = 31; // User mentioned round 31 in progress
  const expectedTotalMatches = Math.floor(expectedMatchesPerRound * currentRound);
  const dataCompleteness = expectedTotalMatches > 0 ? (stats.total_matches / expectedTotalMatches * 100) : 0;

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">리그 통계</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
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
          <div className="text-slate-400 text-xs">완료된 경기</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.avg_goals_per_match}</div>
          <div className="text-slate-400 text-xs">경기당 골</div>
        </div>
      </div>
      
      {/* Data limitation notice */}
      <div className="bg-slate-700 rounded-lg p-3 border-l-4 border-yellow-500">
        <div className="text-yellow-400 text-sm font-medium mb-1">
          ⚠️ 데이터 제한 안내
        </div>
        <div className="text-slate-300 text-xs space-y-1">
          <div>• 현재 데이터: {stats.total_matches}경기 (최근 라운드만)</div>
          <div>• 31라운드 예상: ~{expectedTotalMatches}경기</div>
          <div>• 데이터 완성도: {dataCompleteness.toFixed(1)}%</div>
          <div className="text-slate-400 mt-2">
            K League API 한계로 전체 시즌 데이터 제공 불가
          </div>
        </div>
      </div>
    </div>
  );
}

function FixturesToggle({ 
  useTheSportsDB, 
  setUseTheSportsDB 
}: { 
  useTheSportsDB: boolean; 
  setUseTheSportsDB: (value: boolean) => void; 
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white text-sm font-medium">경기 정보 소스</h3>
          <p className="text-slate-400 text-xs mt-1">
            {useTheSportsDB ? 'TheSportsDB 실시간 데이터' : '내부 데이터베이스'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setUseTheSportsDB(false)}
            className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
              !useTheSportsDB
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            데이터베이스
          </button>
          <button
            onClick={() => setUseTheSportsDB(true)}
            className={`px-3 py-2 text-xs font-medium rounded transition-colors ${
              useTheSportsDB
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            TheSportsDB
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const { slug } = useParams<{ slug: string }>();
  const [useTheSportsDB, setUseTheSportsDB] = useState(
    // In test environment, default to false to avoid network calls
    // Also check for vitest environment variable
    import.meta.env.MODE === 'test' || import.meta.env.VITEST ? false : true
  );

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
          {/* 왼쪽: 하이브리드 순위표 */}
          <div className="lg:col-span-2">
            <StandingsSection 
              standings={standings}
              isLoading={standingsLoading}
              error={standingsError}
              leagueId={league.id}
              season={league.season}
            />
          </div>

          {/* 오른쪽: 사이드바 정보 */}
          <div className="space-y-6">
            {stats && <LeagueStatsCard stats={stats} />}
            
            {/* Fixtures Section with Toggle */}
            <FixturesToggle 
              useTheSportsDB={useTheSportsDB} 
              setUseTheSportsDB={setUseTheSportsDB} 
            />
            
            {useTheSportsDB ? (
              <TheSportsDBFixturesSection 
                leagueId={league.id}
              />
            ) : (
              <RoundBasedFixturesSection 
                leagueId={league.id}
                season={league.season}
              />
            )}
            
            <TopPlayersCard scorers={topScorers} assists={topAssists} />
            <HistoricalChampionsCard champions={champions} />
          </div>
        </div>
      </div>
    </div>
  );
}