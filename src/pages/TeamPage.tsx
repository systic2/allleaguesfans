import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { 
  fetchPlayersByTeam, 
  fetchTeamDetails, 
  fetchTeamFixtures, 
  fetchTeamStatistics,
  type PlayerLite, 
  type TeamDetails, 
  type TeamFixture, 
  type TeamStatistics 
} from "@/lib/api";
import { shouldRedirectTeamId, getTeamIdErrorMessage } from "@/lib/team-id-mapping";
import TeamLineup from "@/components/TeamLineup";
import CrestImg from "@/app/components/CrestImg";
import UpcomingFixtures from "@/components/UpcomingFixtures";

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

export default function TeamPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const originalTeamId = Number(id);
  const currentSeason = 2025;
  const [redirecting, setRedirecting] = useState(false);

  // Check for team ID redirect and handle it
  useEffect(() => {
    const redirectInfo = shouldRedirectTeamId(originalTeamId);
    
    if (redirectInfo.shouldRedirect && redirectInfo.newTeamId) {
      setRedirecting(true);
      console.log(`🔄 Redirecting team ${originalTeamId} → ${redirectInfo.newTeamId}`);
      
      // Show brief message then redirect
      setTimeout(() => {
        navigate(`/teams/${redirectInfo.newTeamId}`, { replace: true });
      }, 2000);
    }
  }, [originalTeamId, navigate]);

  // Use redirected team ID if available, otherwise use original
  const redirectInfo = shouldRedirectTeamId(originalTeamId);
  const teamId = redirectInfo.newTeamId || originalTeamId;

  // Enhanced queries with better error handling
  const { 
    data: teamDetails, 
    isLoading: teamLoading, 
    error: teamError 
  } = useQuery<TeamDetails | null>({
    queryKey: ["team-details", teamId],
    queryFn: () => fetchTeamDetails(teamId, currentSeason),
    enabled: Number.isFinite(teamId) && teamId > 0,
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { 
    data: players, 
    isLoading: playersLoading 
  } = useQuery<PlayerLite[]>({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchPlayersByTeam(teamId),
    enabled: Number.isFinite(teamId) && teamId > 0,
    retry: 2,
  });

  const { 
    data: fixtures, 
    isLoading: fixturesLoading 
  } = useQuery<TeamFixture[]>({
    queryKey: ["team-fixtures", teamId],
    queryFn: () => fetchTeamFixtures(teamId, currentSeason, 20), // Increased to ensure 5 completed matches
    enabled: Number.isFinite(teamId) && teamId > 0,
    retry: 2,
  });

  const { 
    data: statistics, 
    isLoading: statisticsLoading 
  } = useQuery<TeamStatistics | null>({
    queryKey: ["team-statistics", teamId],
    queryFn: () => fetchTeamStatistics(teamId, currentSeason),
    enabled: Number.isFinite(teamId) && teamId > 0,
    retry: 2,
  });

  // Show redirect message if redirecting
  if (redirecting && redirectInfo.shouldRedirect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-white mb-4">팀 페이지 이동 중</h1>
          <p className="text-white/70 mb-6">{redirectInfo.message}</p>
          <p className="text-sm text-white/50">
            팀 ID {originalTeamId} → {redirectInfo.newTeamId}
          </p>
        </div>
      </div>
    );
  }

  // Invalid team ID check
  if (!Number.isFinite(teamId) || teamId <= 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">잘못된 팀 ID</h1>
          <p className="text-white/70 mb-6">올바른 팀 페이지로 이동해주세요.</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }

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
  if (!teamDetails) {
    const errorMessage = getTeamIdErrorMessage(originalTeamId);
    const isKnownOldId = shouldRedirectTeamId(originalTeamId).shouldRedirect;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold text-white mb-4">팀을 찾을 수 없습니다</h1>
          <p className="text-white/70 mb-6">{errorMessage}</p>
          
          {!isKnownOldId && (
            <div className="bg-black/20 rounded-lg p-4 mb-6 border border-white/10">
              <p className="text-sm text-white/60 mb-3">💡 도움말:</p>
              <ul className="text-sm text-white/70 text-left space-y-1">
                <li>• 검색 기능을 사용해 팀을 찾아보세요</li>
                <li>• 리그 페이지에서 팀 목록을 확인하세요</li>
                <li>• 팀 ID는 2745-2768 범위에 있습니다</li>
              </ul>
            </div>
          )}
          
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
          
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-white/40 mt-4">
              Debug: teamId={teamId}, originalId={originalTeamId}
            </p>
          )}
        </div>
      </div>
    );
  }



  const getResultColor = (result: 'W' | 'D' | 'L' | null) => {
    switch (result) {
      case 'W': return 'bg-green-600';
      case 'D': return 'bg-yellow-600';
      case 'L': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header Section - FM Style */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <CrestImg 
              src={teamDetails.logo_url} 
              alt={teamDetails.name}
              size={80}
              className="rounded-lg shadow-lg"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{teamDetails.name}</h1>
              <div className="flex items-center gap-4 text-white/70">
                <span>{teamDetails.country}</span>
                <span>•</span>
                <span>K리그1</span>
                {teamDetails.current_position && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400 font-semibold">
                      {teamDetails.current_position}위
                    </span>
                  </>
                )}
                {teamDetails.founded && (
                  <>
                    <span>•</span>
                    <span>설립 {teamDetails.founded}년</span>
                  </>
                )}
              </div>
            </div>
            {statistics && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {statistics.points}pts
                </div>
                <div className="text-white/70">
                  {statistics.wins}승 {statistics.draws}무 {statistics.losses}패
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
                  teamId={teamId}
                  players={players ?? []}
                />
              </section>
            )}

            {/* Recent Fixtures */}
            {fixturesLoading ? (
              <LoadingSection title="📅 최근 경기 결과" />
            ) : fixtures && fixtures.filter(f => f.result !== null).length > 0 ? (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📅 최근 경기 결과
                </h2>
                <div className="space-y-3">
                  {fixtures
                    .filter((fixture) => fixture.result !== null) // Only show completed matches
                    .slice(0, 5) // Show 5 completed matches
                    .map((fixture) => (
                    <div key={fixture.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white ${getResultColor(fixture.result)}`}>
                          {fixture.result || '-'}
                        </div>
                        <span className="text-white/60 text-sm w-16">
                          {formatDate(fixture.date_utc)}
                        </span>
                        <div className="flex items-center gap-2">
                          <CrestImg src={fixture.opponent_logo} alt={fixture.opponent_name} size={20} />
                          <span className="text-white font-medium">
                            {fixture.is_home ? 'vs' : '@'} {fixture.opponent_name}
                          </span>
                        </div>
                      </div>
                      <div className="text-white font-bold">
                        {fixture.home_goals !== null && fixture.away_goals !== null 
                          ? `${fixture.home_goals}-${fixture.away_goals}`
                          : fixture.status_short
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Upcoming Fixtures */}
            <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                🗓️ 예정된 경기
              </h2>
              <div className="[&>div]:!bg-transparent [&>div]:!shadow-none [&>div]:!border-0 [&>div]:!p-0">
                <UpcomingFixtures 
                  teamId={teamId} 
                  title="" 
                  limit={5}
                  className="!bg-transparent !shadow-none !border-0 !p-0"
                />
              </div>
            </section>

            {/* Squad List */}
            <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                👥 선수 명단 ({(players ?? []).length}명)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(players ?? []).map((player) => (
                  <div key={player.id} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <CrestImg
                        src={player.photo_url}
                        alt={player.name}
                        size={32}
                        className="rounded-full"
                      />
                      <div>
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-white/60 text-sm">
                          {player.position ?? "포지션 미정"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Statistics */}
          <div className="space-y-6">
            {/* Current Season Stats */}
            {statisticsLoading ? (
              <LoadingSection title="📊 2025 시즌 기록" />
            ) : statistics ? (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📊 2025 시즌 기록
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{statistics.position}</div>
                      <div className="text-white/60 text-sm">리그 순위</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">{statistics.points}</div>
                      <div className="text-white/60 text-sm">승점</div>
                    </div>
                  </div>
                  
                  <div className="border-t border-white/10 pt-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">{statistics.wins}</div>
                        <div className="text-white/60 text-xs">승</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-400">{statistics.draws}</div>
                        <div className="text-white/60 text-xs">무</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-400">{statistics.losses}</div>
                        <div className="text-white/60 text-xs">패</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/60">득점</span>
                        <span className="text-green-400 font-bold">{statistics.goals_for}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">실점</span>
                        <span className="text-red-400 font-bold">{statistics.goals_against}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">득실차</span>
                        <span className={`font-bold ${statistics.goal_difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {statistics.goal_difference >= 0 ? '+' : ''}{statistics.goal_difference}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">경기당 득점</span>
                        <span className="text-white">{statistics.avg_goals_scored}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">경기당 실점</span>
                        <span className="text-white">{statistics.avg_goals_conceded}</span>
                      </div>
                    </div>
                  </div>

                  {statistics.form_last_5 && (
                    <div className="border-t border-white/10 pt-4">
                      <div className="text-white/60 text-sm mb-2">최근 5경기</div>
                      <div className="flex gap-1">
                        {statistics.form_last_5.split('').slice(0, 5).map((result, index) => (
                          <div key={index} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white ${getResultColor(result as 'W' | 'D' | 'L')}`}>
                            {result}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* Club Info */}
            <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">
                🏟️ 구단 정보
              </h3>
              <div className="space-y-3 text-sm">
                {teamDetails.venue_name && (
                  <div className="flex justify-between">
                    <span className="text-white/60">홈구장</span>
                    <span className="text-white">{teamDetails.venue_name}</span>
                  </div>
                )}
                {teamDetails.venue_capacity && (
                  <div className="flex justify-between">
                    <span className="text-white/60">수용인원</span>
                    <span className="text-white">{teamDetails.venue_capacity.toLocaleString()}명</span>
                  </div>
                )}
                {teamDetails.venue_city && (
                  <div className="flex justify-between">
                    <span className="text-white/60">연고지</span>
                    <span className="text-white">{teamDetails.venue_city}</span>
                  </div>
                )}
                {teamDetails.founded && (
                  <div className="flex justify-between">
                    <span className="text-white/60">창단</span>
                    <span className="text-white">{teamDetails.founded}년</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">국가</span>
                  <span className="text-white">{teamDetails.country}</span>
                </div>
              </div>
            </section>

            {/* Home/Away Record */}
            {statisticsLoading ? (
              <LoadingSection title="🏠 홈/원정 기록" />
            ) : statistics ? (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">
                  🏠 홈/원정 기록
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-white/60 text-sm mb-2">홈 경기</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">{statistics.home_record.wins}승</span>
                      <span className="text-yellow-400">{statistics.home_record.draws}무</span>
                      <span className="text-red-400">{statistics.home_record.losses}패</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-2">원정 경기</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">{statistics.away_record.wins}승</span>
                      <span className="text-yellow-400">{statistics.away_record.draws}무</span>
                      <span className="text-red-400">{statistics.away_record.losses}패</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
