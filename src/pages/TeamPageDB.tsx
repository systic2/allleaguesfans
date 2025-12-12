import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchTeamDetails,
  fetchTeamStandingsData,
  fetchPlayersByTeam,
  fetchTeamFormGuide, // ADDED fetchTeamFormGuide
  type TeamDetails,
  type TeamPlayer,
} from "@/lib/api";
import type { Standing } from "@/types/domain"; // ADD new Standing
import { MatchWithTeams, fetchTeamFixtures as fetchTeamFixturesTSDB } from "@/lib/thesportsdb-api"; // ADD MatchWithTeams and fetchTeamFixturesTSDB
import TeamLineup from "@/components/TeamLineup";
import TeamRoster from "@/components/TeamRoster";
import CrestImg from "@/app/components/CrestImg";

// Move FormResult definition here or import from shared utility if it exists
type FormResult = 'W' | 'D' | 'L';

const CURRENT_SEASON = '2025';

// Loading component for consistent loading states
function LoadingSection({ title }: { title: string }) {
  return (
    <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
      <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
        {title}
      </h2>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-white/10 rounded w-3/4"></div>
        <div className="h-4 bg-white/10 rounded w-1/2"></div>
        <div className="h-4 bg-white/10 rounded w-2/3"></div>
      </div>
    </section>
  );
}

export default function TeamPageDB() {
  const { id = "0" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const teamIdParam = id; // TheSportsDB idTeam (e.g., "138107")

  // Fetch team data from teams table
  const {
    data: teamData,
    isLoading: teamLoading,
    error: teamError
  } = useQuery<TeamDetails | null>({
    queryKey: ["team-db", teamIdParam],
    queryFn: () => fetchTeamDetails(teamIdParam),
    enabled: !!teamIdParam,
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch team standings
  const { data: standingsData } = useQuery<Standing | null>({
    queryKey: ["team-standings-db", teamData?.currentLeagueId, teamData?.name],
    queryFn: () => fetchTeamStandingsData(teamData!.currentLeagueId!, CURRENT_SEASON, teamData!.name),
    enabled: !!teamData,
    retry: 2,
  });

  // Fetch players
  const {
    data: players,
    isLoading: playersLoading
  } = useQuery<TeamPlayer[]>({
    queryKey: ["team-players-db", teamIdParam],
    queryFn: () => fetchPlayersByTeam(teamIdParam),
    enabled: !!teamIdParam,
    retry: 2,
  });

  // Fetch team fixtures (upcoming and recent)
  const {
    data: teamFixtures,
    isLoading: fixturesLoading,
    error: fixturesError,
  } = useQuery<{ upcoming: MatchWithTeams[]; recent: MatchWithTeams[] }>({
    queryKey: ["team-fixtures-tsdb", teamIdParam, CURRENT_SEASON],
    queryFn: () => fetchTeamFixturesTSDB(teamIdParam),
    enabled: !!teamIdParam,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const upcomingEvents = teamFixtures?.upcoming || [];
  const recentEvents = teamFixtures?.recent || [];
  const eventsLoading = fixturesLoading; // Consolidate loading state
  const eventsError = fixturesError; // Consolidate error state

  // Fetch form guide
  const { data: formGuide } = useQuery<FormResult[]>({
    queryKey: ["team-form-db", teamIdParam],
    queryFn: () => fetchTeamFormGuide(teamIdParam, CURRENT_SEASON, 5),
    enabled: !!teamIdParam,
  });

  // Error state
  if (teamError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">팀 정보 로딩 오류</h1>
          <p className="text-white/70 mb-6">팀 정보를 불러오는 중 오류가 발생했습니다.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors mr-3"
          >
            다시 시도
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-32 bg-white/10 rounded-xl mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="h-64 bg-white/10 rounded-xl"></div>
                <div className="h-48 bg-white/10 rounded-xl"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-white/10 rounded-xl"></div>
                <div className="h-32 bg-white/10 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No team data found
  if (!teamData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold text-white mb-4">팀을 찾을 수 없습니다</h1>
          <p className="text-white/70 mb-6">요청하신 팀 정보가 데이터베이스에 없습니다.</p>

          <div className="space-x-3">
            <button
              onClick={() => navigate('/search')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              팀 검색
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getResultColor = (result: FormResult) => {
    switch (result) {
      case 'W': return 'bg-green-600';
      case 'D': return 'bg-yellow-600';
      case 'L': return 'bg-red-600';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const leagueName = teamData.currentLeagueId === '4689' ? 'K리그1' : 'K리그2';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header Section */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <CrestImg
              src={teamData.badgeUrl}
              alt={teamData.name}
              size={80}
              className="rounded-lg shadow-lg"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{teamData.name}</h1>
              <div className="flex items-center gap-4 text-white/70">
                {standingsData?.leagueId && (
                  <span>{standingsData.leagueId === '4689' ? 'K리그1' : 'K리그2'}</span>
                )}
                {standingsData?.rank && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400 font-semibold">
                      {standingsData.rank}위
                    </span>
                  </>
                )}
              </div>
            </div>
            {standingsData && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {standingsData.points}pts
                </div>
                <div className="text-white/70">
                  {standingsData.wins}승 {standingsData.draws}무 {standingsData.losses}패
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Squad Section */}
            {playersLoading ? (
              <LoadingSection title="🔥 선발 라인업" />
            ) : (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  🔥 선발 라인업
                </h2>
                <TeamLineup
                  teamId={Number(teamIdParam)}
                  players={players ?? []}
                />
              </section>
            )}

            {/* Team Roster Section */}
            <TeamRoster idTeam={teamIdParam} teamName={teamData.name} />

            {/* Recent Fixtures */}
            {eventsLoading ? (
              <LoadingSection title="📅 최근 경기 결과" />
            ) : recentEvents && recentEvents.length > 0 ? (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📅 최근 경기 결과
                </h2>
                <div className="space-y-3">
                  {recentEvents.map((event) => {
                    const isHome = event.homeTeamId === teamIdParam; // ADDED missing definition
                    const opponentName = isHome ? event.awayTeam?.name : event.homeTeam?.name;
                    const teamScore = isHome ? event.homeScore : event.awayScore;
                    const oppScore = isHome ? event.awayScore : event.homeScore;

                    let result: FormResult;
                    if (teamScore! > oppScore!) result = 'W';
                    else if (teamScore! < oppScore!) result = 'L';
                    else result = 'D';

                    return (
                      <div key={event.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white ${getResultColor(result)}`}>
                            {result}
                          </div>
                          <span className="text-white/60 text-sm w-16">
                            {formatDate(event.date)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {isHome ? 'vs' : '@'} {opponentName}
                            </span>
                          </div>
                        </div>
                        <div className="text-white font-bold">
                          {event.homeScore}-{event.awayScore}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Upcoming Fixtures */}
            {upcomingEvents && upcomingEvents.length > 0 && (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📆 예정 경기
                </h2>
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const isHome = event.homeTeamId === teamIdParam;
                    const opponentName = isHome ? event.awayTeam?.name : event.homeTeam?.name;

                    return (
                      <div key={event.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-white/60 text-sm w-16">
                            {formatDate(event.date)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {isHome ? 'vs' : '@'} {opponentName}
                            </span>
                          </div>
                        </div>
                        <div className="text-white/60 text-sm">
                          Round {event.round}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Statistics Card */}
            {standingsData && (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📊 시즌 통계
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/70">순위</span>
                    <span className="text-white font-bold">{standingsData.rank}위</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">경기 수</span>
                    <span className="text-white font-bold">{standingsData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">승점</span>
                    <span className="text-white font-bold">{standingsData.points}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">승 / 무 / 패</span>
                    <span className="text-white font-bold">
                      {standingsData.wins} / {standingsData.draws} / {standingsData.losses}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">득실</span>
                    <span className="text-white font-bold">
                      {standingsData.goalsFor} - {standingsData.goalsAgainst}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">득실차</span>
                    <span className={`font-bold ${standingsData.goalDifference! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {standingsData.goalDifference! >= 0 ? '+' : ''}{standingsData.goalDifference}
                    </span>
                  </div>

                  {/* Form Guide */}
                  {formGuide && formGuide.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <span className="text-white/70 text-sm">최근 폼</span>
                      <div className="flex gap-1 mt-2">
                        {formGuide.map((result, idx) => (
                          <div
                            key={idx}
                            className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getResultColor(result)}`}
                          >
                            {result}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Home/Away Record */}

                </div>
              </section>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
