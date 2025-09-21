import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
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
import TeamLineup from "@/components/TeamLineup";
import CrestImg from "@/app/components/CrestImg";
import UpcomingFixtures from "@/components/UpcomingFixtures";


export default function TeamPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const teamId = Number(id);
  const currentSeason = 2025;

  const { data: teamDetails } = useQuery<TeamDetails | null>({
    queryKey: ["team-details", teamId],
    queryFn: () => fetchTeamDetails(teamId, currentSeason),
    enabled: Number.isFinite(teamId) && teamId > 0,
  });

  const { data: players } = useQuery<PlayerLite[]>({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchPlayersByTeam(teamId),
    enabled: Number.isFinite(teamId) && teamId > 0,
  });

  const { data: fixtures } = useQuery<TeamFixture[]>({
    queryKey: ["team-fixtures", teamId],
    queryFn: () => fetchTeamFixtures(teamId, currentSeason, 8),
    enabled: Number.isFinite(teamId) && teamId > 0,
  });

  const { data: statistics } = useQuery<TeamStatistics | null>({
    queryKey: ["team-statistics", teamId],
    queryFn: () => fetchTeamStatistics(teamId, currentSeason),
    enabled: Number.isFinite(teamId) && teamId > 0,
  });

  if (!teamDetails) {
    return (
      <div className="p-6">
        <div className="text-white/70">팀 정보를 불러오는 중...</div>
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
            <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                🔥 선발 라인업
              </h2>
              <TeamLineup 
                teamId={teamId}
                players={players ?? []}
              />
            </section>

            {/* Recent Fixtures */}
            {fixtures && fixtures.length > 0 && (
              <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">
                  📅 최근 경기 결과
                </h2>
                <div className="space-y-3">
                  {fixtures.slice(0, 6).map((fixture) => (
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
            )}

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
            {statistics && (
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
            )}

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
            {statistics && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
