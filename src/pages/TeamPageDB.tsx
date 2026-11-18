import { Link, useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, Calendar, BarChart3, Trophy, MapPin } from "lucide-react";
import {
  fetchTeamDetails,
  fetchTeamStandingsData,
  fetchPlayersByTeam,
  fetchTeamFormGuide,
  fetchTeamTrophyCount,
  fetchNearbyStandings,
  type TeamDetails,
  type TeamPlayer,
  type TeamStanding,
} from "@/lib/api";
import { leagueNameKo, leagueSlugFor, seasonLabel } from "@/lib/leagues";
import type { Standing } from "@/types/domain";
import { MatchWithTeams, fetchTeamFixtures as fetchTeamFixturesTSDB } from "@/lib/thesportsdb-api";
import SquadTable from "@/components/SquadTable";
import { squadPlayers } from "@/lib/squad";
import CrestImg from "@/app/components/CrestImg";
import SubTabs from "@/components/SubTabs";
import NotFound from "@/app/components/NotFound";
import FavoriteButton from "@/components/FavoriteButton";
import { getCurrentSeasonForFormat } from "@/lib/season";
import { useTeamName } from "@/hooks/useTeamName";

// Types
type FormResult = 'W' | 'D' | 'L';

const FALLBACK_SEASON = String(new Date().getFullYear());

const TEAM_TABS = [
  { key: "overview", label: "개요" },
  { key: "squad", label: "선수단" },
  { key: "fixtures", label: "일정" },
  { key: "stats", label: "통계" },
];

function leagueLabel(idLeague: string): string {
  return leagueNameKo(leagueSlugFor(idLeague)) ?? idLeague;
}

// Helper Components
function LoadingSpinner() {
  return <div className="p-10 text-center text-ink/70">로딩중…</div>;
}

function ResultBadge({ result }: { result: FormResult }) {
  const colors = {
    'W': 'bg-green-500',
    'D': 'bg-yellow-500',
    'L': 'bg-red-500'
  };
  return (
    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-black ${colors[result]}`}>
      {result}
    </div>
  );
}

export default function TeamPageDB() {
  const { id = "0" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamName = useTeamName();
  const teamIdParam = id;
  
  // 알 수 없는 ?tab= 값은 빈 화면 대신 개요를 보여준다
  const requestedTab = searchParams.get("tab");
  const currentTab = TEAM_TABS.some(t => t.key === requestedTab) ? requestedTab! : "overview";

  // --- Queries ---
  const { data: teamData, isLoading: teamLoading, error: teamError } = useQuery<TeamDetails | null>({
    queryKey: ["team-db", teamIdParam],
    queryFn: () => fetchTeamDetails(teamIdParam),
    enabled: !!teamIdParam,
    staleTime: 5 * 60 * 1000,
  });
  // 팀이 속한 리그의 최근 시즌 (K리그는 달력 연도, 유럽은 시즌 시작 연도)
  const currentSeason = teamData?.currentSeason ?? FALLBACK_SEASON;
  // 우승 횟수에서 빼야 하는 '진행 중' 시즌은 팀의 마지막 시즌이 아니라 리그의 현재 시즌이다
  // (해체된 팀은 마지막 시즌도 끝난 시즌이라 그 우승을 세야 한다)
  const inProgressSeason = getCurrentSeasonForFormat(
    teamData?.currentLeagueId === '4689' || teamData?.currentLeagueId === '4822' ? 'single' : 'split'
  ).dbValue;

  const { data: standingsData } = useQuery<Standing | null>({
    queryKey: ["team-standings-db", teamData?.currentLeagueId, teamData?.name, currentSeason],
    queryFn: () => fetchTeamStandingsData(teamData!.currentLeagueId!, currentSeason, teamData!.name),
    enabled: !!teamData?.currentLeagueId && !!teamData?.name,
  });

  const { data: players } = useQuery<TeamPlayer[]>({
    queryKey: ["team-players-db", teamIdParam, currentSeason],
    queryFn: () => fetchPlayersByTeam(teamIdParam, currentSeason),
    enabled: !!teamIdParam && !!teamData,
  });

  const { data: teamFixtures } = useQuery<{ upcoming: MatchWithTeams[]; recent: MatchWithTeams[] }>({
    queryKey: ["team-fixtures-tsdb", teamIdParam],
    queryFn: () => fetchTeamFixturesTSDB(teamIdParam),
    enabled: !!teamIdParam,
  });

  const { data: formGuide } = useQuery<FormResult[]>({
    queryKey: ["team-form-db", teamIdParam, currentSeason],
    queryFn: () => fetchTeamFormGuide(teamIdParam, currentSeason, 5),
    enabled: !!teamIdParam && !!teamData,
  });

  const { data: trophyCount } = useQuery<number>({
    queryKey: ["team-trophies-db", teamIdParam, inProgressSeason],
    queryFn: () => fetchTeamTrophyCount(teamIdParam, inProgressSeason),
    enabled: !!teamIdParam && !!teamData && currentTab === 'overview',
    staleTime: 60 * 60 * 1000,
  });

  const { data: nearbyStandings, isLoading: isLoadingNearbyStandings } = useQuery<TeamStanding[]>({
    queryKey: ["team-nearby-standings-db", teamData?.currentLeagueId, teamIdParam, currentSeason],
    queryFn: () => fetchNearbyStandings(teamData!.currentLeagueId!, currentSeason, teamIdParam),
    enabled: !!teamData?.currentLeagueId && !!teamIdParam && currentTab === 'overview',
  });

  // --- Helper Functions ---
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const topScorers = squadPlayers(players ?? [])
    .filter((p) => p.goals !== null && p.goals > 0)
    .sort((a, b) => b.goals! - a.goals! || a.strPlayer.localeCompare(b.strPlayer, 'ko'))
    .slice(0, 5);

  // --- State Handling ---
  if (teamLoading) return <LoadingSpinner />;
  if (teamError || !teamData) return <NotFound message="팀을 찾을 수 없습니다." />;

  return (
    <div className="text-white font-sans">
      {/* Header Section */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4 sm:p-6 bg-sunken">
        <CrestImg
          src={teamData.badgeUrl}
          alt={teamData.name}
          size={80}
          className="rounded-lg shadow-lg drop-shadow-2xl"
        />
        <div className="flex-1 min-w-48">
          <h1 className="text-3xl font-bold text-white tracking-tight">{teamData.nameKorean || teamData.name}</h1>
          {teamData.nameKorean && <p className="text-white/50 text-sm mb-2">{teamData.name}</p>}
          <div className="mb-2">
            <FavoriteButton item={{ type: "team", id: String(teamData.id), name: teamData.nameKorean || teamData.name, image: teamData.badgeUrl ?? null }} />
          </div>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            {teamData.currentLeagueId && (
              <span className="bg-white/10 px-2 py-0.5 rounded">{leagueLabel(teamData.currentLeagueId)}</span>
            )}
            {standingsData?.rank && (
              <>
                <span className="w-1 h-1 bg-white/30 rounded-full"></span>
                <span className="text-yellow-400 font-semibold text-lg">
                  {standingsData.rank}위
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Top Right Stats */}
        <div className="flex items-center gap-8 ml-auto">
          {standingsData && (
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-bold text-white leading-none">
                {standingsData.points ?? '-'}<span className="text-sm font-normal text-white/50 ml-1">점</span>
              </div>
              <div className="text-white/50 text-xs mt-1">
                {standingsData.wins ?? '-'}승 {standingsData.draws ?? '-'}무 {standingsData.losses ?? '-'}패
              </div>
            </div>
          )}
          
          <div className="flex flex-col items-end">
            <span className="text-white/40 text-[10px] font-bold tracking-wider mb-1">최근 5경기</span>
            <div className="flex gap-1">
              {formGuide?.map((res, i) => <ResultBadge key={i} result={res} />) || <span className="text-white/40 text-xs">기록 없음</span>}
            </div>
          </div>
        </div>
      </div>

      <SubTabs tabs={TEAM_TABS} defaultKey="overview" />

      {/* Main Content Area */}
      <div className="p-6 bg-sunken min-h-screen">
        
        {/* --- OVERVIEW TAB --- */}
        {currentTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {/* Club Profile Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <LayoutDashboard className="w-3 h-3" /> 구단 정보
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white/50 text-xs ">이름</p>
                  <p className="text-white font-medium">{teamData.nameKorean || teamData.name}</p>
                </div>
                {teamData.strStadium && (
                  <div>
                    <p className="text-white/50 text-xs ">홈구장</p>
                    <p className="text-white font-medium">{teamData.strStadium}</p>
                  </div>
                )}
                {teamData.intFormedYear && (
                  <div>
                    <p className="text-white/50 text-xs ">창단</p>
                    <p className="text-white font-medium">{teamData.intFormedYear}</p>
                  </div>
                )}
                {teamData.currentLeagueId && (
                  <div>
                    <p className="text-white/50 text-xs ">리그</p>
                    <p className="text-white font-medium">{leagueLabel(teamData.currentLeagueId)}</p>
                  </div>
                )}
                {standingsData?.rank && (
                  <div>
                    <p className="text-white/50 text-xs ">현재 순위</p>
                    <p className="text-white font-medium">{standingsData.rank}위</p>
                  </div>
                )}
                {!!trophyCount && trophyCount > 0 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-yellow-500" /> 리그 우승
                    </p>
                    <p className="text-yellow-400 font-bold">{trophyCount}회</p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Match Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <Calendar className="w-3 h-3" /> 다음 경기
              </h3>
              {teamFixtures?.upcoming[0] ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center w-full justify-between">
                    <div className="flex flex-col items-center w-1/3">
                      <div className="w-16 h-16 bg-white/5 rounded-full mb-2 flex items-center justify-center p-2">
                         <CrestImg src={teamFixtures.upcoming[0].homeTeam?.badgeUrl} alt={teamFixtures.upcoming[0].homeTeam?.name || 'Home Team'} size={48} />
                      </div> 
                      <span className="font-bold text-sm text-center truncate w-full">{teamName(teamFixtures.upcoming[0].homeTeamId, teamFixtures.upcoming[0].homeTeam?.name || 'Unknown')}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-bold text-white/30">VS</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      <div className="w-16 h-16 bg-white/5 rounded-full mb-2 flex items-center justify-center p-2">
                         <CrestImg src={teamFixtures.upcoming[0].awayTeam?.badgeUrl} alt={teamFixtures.upcoming[0].awayTeam?.name || 'Away Team'} size={48} />
                      </div> 
                      <span className="font-bold text-sm text-center truncate w-full">{teamName(teamFixtures.upcoming[0].awayTeamId, teamFixtures.upcoming[0].awayTeam?.name || 'Unknown')}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-purple-400 font-bold">{formatDate(teamFixtures.upcoming[0].date)}</span>
                    <br />
                    <span className="text-xs text-white/50">{formatTime(teamFixtures.upcoming[0].date)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-white/30 py-8 text-center text-sm">예정된 경기가 없습니다.</p>
              )}
            </div>

            {/* Recent Results Summary */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <BarChart3 className="w-3 h-3" /> 최근 경기
              </h3>
              <div className="space-y-2">
                {teamFixtures?.recent.slice(0, 5).map(match => { // Changed to slice(0, 5)
                  const opponentId = match.homeTeamId === teamIdParam ? match.awayTeamId : match.homeTeamId;
                  const opponent = match.homeTeamId === teamIdParam ? match.awayTeam : match.homeTeam;
                  const opponentName = teamName(opponentId, opponent?.name || 'Unknown');
                  const opponentBadge = opponent?.badgeUrl;

                  return (
                    <div key={match.id} className="flex justify-between items-center bg-white/5 p-3 rounded hover:bg-white/10 transition-colors cursor-default border border-white/5">
                      <div className="flex items-center gap-2">
                        <ResultBadge result={
                          match.homeScore === match.awayScore ? 'D' :
                          (match.homeTeamId === teamIdParam && match.homeScore! > match.awayScore!) || (match.awayTeamId === teamIdParam && match.awayScore! > match.homeScore!) ? 'W' : 'L'
                        } />
                        {opponentBadge && (
                          <CrestImg src={opponentBadge} alt={opponentName} size={20} className="rounded-full" />
                        )}
                        <span className="text-sm text-white/80">{opponentName}</span>
                      </div>
                      <span className="font-mono font-bold text-white">{match.homeScore} - {match.awayScore}</span>
                    </div>
                  );
                })}
                {(!teamFixtures?.recent || teamFixtures.recent.length === 0) && (
                  <p className="text-white/30 py-4 text-center text-sm">최근 경기 기록이 없습니다.</p>
                )}
              </div>
            </div>

            {/* 팀 내 득점 (기록이 연결된 선수만) */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold mb-4 tracking-wider flex items-center gap-2">
                <Users className="w-3 h-3" /> 팀 내 득점
              </h3>
              {topScorers.length > 0 ? (
                <ol className="space-y-2">
                  {topScorers.map((player) => (
                    <li key={player.idPlayer} className="flex items-center justify-between gap-2 text-sm">
                      <Link to={`/players/${player.idPlayer}`} className="truncate text-white/90 hover:text-accent hover:underline">{player.strPlayer}</Link>
                      <span className="shrink-0 font-mono text-white">{player.goals}골</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-white/30 py-4 text-center text-sm">이 명단과 연결된 득점 기록이 없습니다.</p>
              )}
            </div>

            {/* Club Info Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <MapPin className="w-3 h-3" /> 구단 소개
              </h3>
              {teamData.strEquipment && (
                <img src={teamData.strEquipment} alt={`${teamData.name} kit`} className="h-20 mx-auto mb-4 object-contain" />
              )}
              <div className="space-y-3">
                {teamData.strLocation && (
                  <div>
                    <p className="text-white/50 text-xs ">연고지</p>
                    <p className="text-white font-medium">{teamData.strLocation}</p>
                  </div>
                )}
                {!!teamData.intStadiumCapacity && (
                  <div>
                    <p className="text-white/50 text-xs ">수용 인원</p>
                    <p className="text-white font-medium">{teamData.intStadiumCapacity.toLocaleString()}명</p>
                  </div>
                )}
                {teamData.strWebsite && (
                  <div>
                    <p className="text-white/50 text-xs ">웹사이트</p>
                    <a
                      href={teamData.strWebsite.startsWith('http') ? teamData.strWebsite : `https://${teamData.strWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 font-medium hover:underline break-all"
                    >
                      {teamData.strWebsite}
                    </a>
                  </div>
                )}
                {teamData.strDescriptionEN && (
                  <div>
                    <p className="text-white/50 text-xs ">소개 (영문)</p>
                    <p className="text-white/70 text-xs leading-relaxed line-clamp-4">{teamData.strDescriptionEN}</p>
                  </div>
                )}
                {!teamData.strLocation && !teamData.intStadiumCapacity && !teamData.strWebsite && !teamData.strDescriptionEN && !teamData.strEquipment && (
                  <p className="text-white/30 text-xs italic">아직 등록된 구단 정보가 없습니다.</p>
                )}
              </div>
            </div>

            {/* Mini League Table Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <BarChart3 className="w-3 h-3" /> 주변 순위
              </h3>
              {isLoadingNearbyStandings ? (
                <p className="text-white/30 py-8 text-center text-sm">로딩중…</p>
              ) : nearbyStandings && nearbyStandings.length > 0 ? (
                <div className="space-y-1">
                  {nearbyStandings.map((row) => (
                    <div
                      key={row.team_id}
                      className={`flex items-center justify-between px-2 py-1.5 rounded text-sm ${
                        String(row.team_id) === teamIdParam ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white/50 w-4 text-right shrink-0">{row.rank}</span>
                        <span className={`truncate ${String(row.team_id) === teamIdParam ? 'text-white font-semibold' : 'text-white/80'}`}>
                          {teamName(row.team_id, row.team_name)}
                        </span>
                      </div>
                      <span className="text-white/60 font-mono text-xs shrink-0">{row.points ?? '-'}점</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/30 py-8 text-center text-sm">순위 정보가 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {/* --- SQUAD TAB --- */}
        {currentTab === 'squad' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {players === undefined
              ? <p className="p-10 text-center text-ink/70">로딩중…</p>
              : <SquadTable players={players} leagueId={teamData.currentLeagueId} seasonLabel={teamData.currentLeagueId ? seasonLabel(teamData.currentLeagueId, currentSeason) : currentSeason} />}
          </div>
        )}

        {/* --- FIXTURES TAB --- */}
        {currentTab === 'fixtures' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/5 font-bold flex items-center gap-2 text-white">
                <Calendar className="text-purple-500 w-5 h-5" /> 경기 일정
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-white/40 uppercase bg-black/20">
                    <tr>
                      <th className="px-6 py-3 font-bold tracking-wider">날짜</th>
                      <th className="px-6 py-3 font-bold tracking-wider">상대</th>
                      <th className="px-6 py-3 font-bold tracking-wider text-center">결과·시간</th>
                      <th className="px-6 py-3 font-bold tracking-wider">경기장</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {/* Upcoming */}
                    {teamFixtures?.upcoming.map(match => (
                      <tr
                        key={match.id}
                        onClick={() => navigate(`/matches/${match.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/matches/${match.id}`); } }}
                        tabIndex={0}
                        role="link"
                        className="hover:bg-white/5 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset"
                      >
                        <td className="px-6 py-4 font-medium text-white/90">{formatDate(match.date)}</td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          {match.homeTeamId === teamIdParam ? (
                            <>
                              <span className="text-white/50 text-xs font-bold bg-white/10 px-1.5 py-0.5 rounded">VS</span>
                              <span className="text-white font-medium">{teamName(match.awayTeamId, match.awayTeam?.name || 'Unknown')}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-white/50 text-xs font-bold bg-white/10 px-1.5 py-0.5 rounded">@</span>
                              <span className="text-white font-medium">{teamName(match.homeTeamId, match.homeTeam?.name || 'Unknown')}</span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{formatTime(match.date)}</td>
                        <td className="px-6 py-4 text-white/50 truncate max-w-xs">{match.venueName}</td>
                      </tr>
                    ))}
                    {/* Recent */}
                    {teamFixtures?.recent.map(match => (
                      <tr
                        key={match.id}
                        onClick={() => navigate(`/matches/${match.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/matches/${match.id}`); } }}
                        tabIndex={0}
                        role="link"
                        className="hover:bg-white/5 transition-colors bg-white/5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 focus:ring-inset"
                      >
                        <td className="px-6 py-4 font-medium text-white/60">{formatDate(match.date)}</td>
                        <td className="px-6 py-4 flex items-center gap-3 text-white/60">
                          {match.homeTeamId === teamIdParam ? (
                            <>
                              <span className="text-white/30 text-xs font-bold bg-white/5 px-1.5 py-0.5 rounded">VS</span>
                              <span>{teamName(match.awayTeamId, match.awayTeam?.name || 'Unknown')}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-white/30 text-xs font-bold bg-white/5 px-1.5 py-0.5 rounded">@</span>
                              <span>{teamName(match.homeTeamId, match.homeTeam?.name || 'Unknown')}</span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded font-bold text-xs ${
                            match.homeScore === match.awayScore ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                            (match.homeTeamId === teamIdParam && match.homeScore! > match.awayScore!) || (match.awayTeamId === teamIdParam && match.awayScore! > match.homeScore!) ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'
                          }`}>
                            {match.homeScore} - {match.awayScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white/40 truncate max-w-xs">{match.venueName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- STATS TAB --- */}
        {currentTab === 'stats' && standingsData && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-black/20 rounded-xl border border-white/5 p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                <BarChart3 className="text-purple-500" /> 시즌 기록
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs font-bold">경기</span>
                  <div className="text-3xl font-bold mt-1 text-white">{standingsData.gamesPlayed ?? '-'}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs font-bold">승</span>
                  <div className="text-3xl font-bold mt-1 text-green-400">{standingsData.wins ?? '-'}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs font-bold">득점</span>
                  <div className="text-3xl font-bold mt-1 text-blue-400">{standingsData.goalsFor ?? '-'}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs font-bold">득실차</span>
                  <div className="text-3xl font-bold mt-1 text-purple-400">{standingsData.goalDifference ?? '-'}</div>
                </div>
              </div>
              
            </div>
          </div>
        )}

      </div>
    </div>
  );
}