import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  fetchTeamFromDB,
  fetchTeamStandingsData,
  fetchTeamEventsData,
  fetchEventLiveData,
  fetchTeamFormGuide,
  fetchTeamUpcomingEventsData,
  fetchTeamRecentEventsData,
  fetchPlayersByTeam,
  type PlayerLite,
} from "@/lib/api";
import type { TeamFromDB, TeamStandings, EventFromDB, EventLiveData, FormResult } from "@/domain/types";
import TeamLineup from "@/components/TeamLineup";
import TeamRoster from "@/components/TeamRoster";
import CrestImg from "@/app/components/CrestImg";

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
  } = useQuery<TeamFromDB | null>({
    queryKey: ["team-db", teamIdParam],
    queryFn: () => fetchTeamFromDB(teamIdParam),
    enabled: !!teamIdParam,
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch team standings
  const { data: standingsData } = useQuery<TeamStandings | null>({
    queryKey: ["team-standings-db", teamData?.idLeague, teamData?.strTeam],
    queryFn: () => fetchTeamStandingsData(teamData!.idLeague, CURRENT_SEASON, teamData!.strTeam),
    enabled: !!teamData,
    retry: 2,
  });

  // Fetch players
  const {
    data: players,
    isLoading: playersLoading
  } = useQuery<PlayerLite[]>({
    queryKey: ["team-players-db", teamIdParam],
    queryFn: () => fetchPlayersByTeam(Number(teamIdParam)),
    enabled: !!teamIdParam,
    retry: 2,
  });

  // Fetch all events for the team
  const {
    data: allEvents,
    isLoading: eventsLoading
  } = useQuery<EventFromDB[]>({
    queryKey: ["team-events-db", teamData?.strTeam],
    queryFn: () => fetchTeamEventsData(teamData!.strTeam, CURRENT_SEASON),
    enabled: !!teamData,
    retry: 2,
  });

  // Fetch form guide
  const { data: formGuide } = useQuery<FormResult[]>({
    queryKey: ["team-form-db", teamData?.strTeam],
    queryFn: () => fetchTeamFormGuide(teamData!.strTeam, CURRENT_SEASON, 5),
    enabled: !!teamData,
  });

  // Fetch upcoming events
  const { data: upcomingEvents } = useQuery<EventFromDB[]>({
    queryKey: ["team-upcoming-db", teamData?.strTeam],
    queryFn: () => fetchTeamUpcomingEventsData(teamData!.strTeam, CURRENT_SEASON, 5),
    enabled: !!teamData,
  });

  // Fetch recent events
  const { data: recentEvents } = useQuery<EventFromDB[]>({
    queryKey: ["team-recent-db", teamData?.strTeam],
    queryFn: () => fetchTeamRecentEventsData(teamData!.strTeam, CURRENT_SEASON, 5),
    enabled: !!teamData,
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

  const leagueName = teamData.idLeague === '4689' ? 'K리그1' : 'K리그2';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header Section */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <CrestImg
              src={teamData.strBadge}
              alt={teamData.strTeam}
              size={80}
              className="rounded-lg shadow-lg"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{teamData.strTeam}</h1>
              <div className="flex items-center gap-4 text-white/70">
                <span>{teamData.strCountry}</span>
                <span>•</span>
                <span>{leagueName}</span>
                {standingsData?.intRank && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400 font-semibold">
                      {standingsData.intRank}위
                    </span>
                  </>
                )}
              </div>
            </div>
            {standingsData && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {standingsData.intPoints}pts
                </div>
                <div className="text-white/70">
                  {standingsData.intWin}승 {standingsData.intDraw}무 {standingsData.intLoss}패
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
            <TeamRoster idTeam={teamIdParam} teamName={teamData.strTeam} />

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
                    const isHome = event.strHomeTeam === teamData.strTeam;
                    const opponentName = isHome ? event.strAwayTeam : event.strHomeTeam;
                    const teamScore = isHome ? event.intHomeScore : event.intAwayScore;
                    const oppScore = isHome ? event.intAwayScore : event.intHomeScore;

                    let result: FormResult;
                    if (teamScore! > oppScore!) result = 'W';
                    else if (teamScore! < oppScore!) result = 'L';
                    else result = 'D';

                    return (
                      <div key={event.idEvent} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white ${getResultColor(result)}`}>
                            {result}
                          </div>
                          <span className="text-white/60 text-sm w-16">
                            {formatDate(event.dateEvent)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {isHome ? 'vs' : '@'} {opponentName}
                            </span>
                          </div>
                        </div>
                        <div className="text-white font-bold">
                          {event.intHomeScore}-{event.intAwayScore}
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
                    const isHome = event.strHomeTeam === teamData.strTeam;
                    const opponentName = isHome ? event.strAwayTeam : event.strHomeTeam;

                    return (
                      <div key={event.idEvent} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-white/60 text-sm w-16">
                            {formatDate(event.dateEvent)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {isHome ? 'vs' : '@'} {opponentName}
                            </span>
                          </div>
                        </div>
                        <div className="text-white/60 text-sm">
                          Round {event.intRound}
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
                    <span className="text-white font-bold">{standingsData.intRank}위</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">경기 수</span>
                    <span className="text-white font-bold">{standingsData.intPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">승점</span>
                    <span className="text-white font-bold">{standingsData.intPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">승 / 무 / 패</span>
                    <span className="text-white font-bold">
                      {standingsData.intWin} / {standingsData.intDraw} / {standingsData.intLoss}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">득실</span>
                    <span className="text-white font-bold">
                      {standingsData.intGoalsFor} - {standingsData.intGoalsAgainst}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">득실차</span>
                    <span className={`font-bold ${standingsData.intGoalDifference! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {standingsData.intGoalDifference! >= 0 ? '+' : ''}{standingsData.intGoalDifference}
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
                  {standingsData.intPlayedHome !== null && standingsData.intPlayedAway !== null && (
                    <div className="pt-3 border-t border-white/10">
                      <div className="text-sm text-white/70 mb-2">홈 / 원정</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded p-2">
                          <div className="text-xs text-white/60 mb-1">홈</div>
                          <div className="text-white text-sm font-bold">
                            {standingsData.intWinHome}승 {standingsData.intDrawHome}무 {standingsData.intLossHome}패
                          </div>
                        </div>
                        <div className="bg-white/5 rounded p-2">
                          <div className="text-xs text-white/60 mb-1">원정</div>
                          <div className="text-white text-sm font-bold">
                            {standingsData.intWinAway}승 {standingsData.intDrawAway}무 {standingsData.intLossAway}패
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Club Info */}
            <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                🏟️ 클럽 정보
              </h2>
              <div className="space-y-3 text-sm">
                {teamData.strStadium && (
                  <div>
                    <div className="text-white/60 mb-1">홈 경기장</div>
                    <div className="text-white font-medium">{teamData.strStadium}</div>
                    {teamData.intStadiumCapacity && (
                      <div className="text-white/50 text-xs mt-1">
                        수용 인원: {teamData.intStadiumCapacity.toLocaleString()}명
                      </div>
                    )}
                  </div>
                )}

                {teamData.strStadiumLocation && (
                  <div>
                    <div className="text-white/60 mb-1">위치</div>
                    <div className="text-white">{teamData.strStadiumLocation}</div>
                  </div>
                )}

                {/* Social Media Links */}
                {(teamData.strFacebook || teamData.strTwitter || teamData.strInstagram || teamData.strYoutube) && (
                  <div className="pt-3 border-t border-white/10">
                    <div className="text-white/60 mb-2">소셜 미디어</div>
                    <div className="flex flex-wrap gap-2">
                      {teamData.strFacebook && (
                        <a
                          href={teamData.strFacebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          Facebook
                        </a>
                      )}
                      {teamData.strTwitter && (
                        <a
                          href={teamData.strTwitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          Twitter
                        </a>
                      )}
                      {teamData.strInstagram && (
                        <a
                          href={teamData.strInstagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          Instagram
                        </a>
                      )}
                      {teamData.strYoutube && (
                        <a
                          href={teamData.strYoutube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          YouTube
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {teamData.strDescriptionKR && (
                  <div className="pt-3 border-t border-white/10">
                    <div className="text-white/60 mb-2">클럽 소개</div>
                    <div className="text-white/80 text-xs leading-relaxed">
                      {teamData.strDescriptionKR}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
