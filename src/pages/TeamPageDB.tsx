import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, Calendar, BarChart3 } from "lucide-react";
import {
  fetchTeamDetails,
  fetchTeamStandingsData,
  fetchPlayersByTeam,
  fetchTeamFormGuide,
  type TeamDetails,
  type TeamPlayer,
} from "@/lib/api";
import type { Standing } from "@/types/domain";
import { MatchWithTeams, fetchTeamFixtures as fetchTeamFixturesTSDB } from "@/lib/thesportsdb-api";
import TeamLineup from "@/components/TeamLineup";
import TeamRoster from "@/components/TeamRoster";
import CrestImg from "@/app/components/CrestImg";
import FMSubNav from "@/components/FMSubNav";

// Types
type FormResult = 'W' | 'D' | 'L';

const CURRENT_SEASON = '2025';

// Helper Components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  );
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
  const teamIdParam = id;
  
  const currentTab = searchParams.get("tab") || "overview";

  // --- Queries ---
  const { data: teamData, isLoading: teamLoading, error: teamError } = useQuery<TeamDetails | null>({
    queryKey: ["team-db", teamIdParam],
    queryFn: () => fetchTeamDetails(teamIdParam),
    enabled: !!teamIdParam,
    staleTime: 5 * 60 * 1000,
  });

  const { data: standingsData } = useQuery<Standing | null>({
    queryKey: ["team-standings-db", teamData?.currentLeagueId, teamData?.name],
    queryFn: () => fetchTeamStandingsData(teamData!.currentLeagueId!, CURRENT_SEASON, teamData!.name),
    enabled: !!teamData?.currentLeagueId && !!teamData?.name,
  });

  const { data: players, isLoading: playersLoading } = useQuery<TeamPlayer[]>({
    queryKey: ["team-players-db", teamIdParam],
    queryFn: () => fetchPlayersByTeam(teamIdParam),
    enabled: !!teamIdParam,
  });

  const { data: teamFixtures, isLoading: fixturesLoading } = useQuery<{ upcoming: MatchWithTeams[]; recent: MatchWithTeams[] }>({
    queryKey: ["team-fixtures-tsdb", teamIdParam, CURRENT_SEASON],
    queryFn: () => fetchTeamFixturesTSDB(teamIdParam),
    enabled: !!teamIdParam,
  });

  const { data: formGuide } = useQuery<FormResult[]>({
    queryKey: ["team-form-db", teamIdParam],
    queryFn: () => fetchTeamFormGuide(teamIdParam, CURRENT_SEASON, 5),
    enabled: !!teamIdParam,
  });

  // --- Helper Functions ---
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // --- State Handling ---
  if (teamLoading) return <LoadingSpinner />;
  if (teamError || !teamData) return (
    <div className="flex flex-col items-center justify-center py-20 text-white">
      <h2 className="text-2xl font-bold mb-4">팀을 찾을 수 없습니다.</h2>
      <button onClick={() => navigate('/')} className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 transition-colors">홈으로</button>
    </div>
  );

  return (
    <div className="text-white font-sans">
      {/* Header Section */}
      <div className="flex items-center gap-6 p-6 bg-[#1b1b1b]">
        <CrestImg
          src={teamData.badgeUrl}
          alt={teamData.name}
          size={80}
          className="rounded-lg shadow-lg drop-shadow-2xl"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{teamData.name}</h1>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            {teamData.currentLeagueId && (
              <span className="bg-white/10 px-2 py-0.5 rounded">{teamData.currentLeagueId === '4689' ? 'K리그1' : 'K리그2'}</span>
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
        <div className="flex items-center gap-8">
          {standingsData && (
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-bold text-white leading-none">
                {standingsData.points}<span className="text-sm font-normal text-white/50 ml-1">pts</span>
              </div>
              <div className="text-white/50 text-xs mt-1">
                {standingsData.wins}승 {standingsData.draws}무 {standingsData.losses}패
              </div>
            </div>
          )}
          
          <div className="flex flex-col items-end">
            <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Recent Form</span>
            <div className="flex gap-1">
              {formGuide?.map((res, i) => <ResultBadge key={i} result={res} />) || <span className="text-slate-600 text-xs">No Data</span>}
            </div>
          </div>
        </div>
      </div>

      {/* FM Sub Navigation */}
      <FMSubNav type="team" basePath={`/teams/${teamIdParam}`} />

      {/* Main Content Area */}
      <div className="p-6 bg-[#1b1b1b] min-h-screen">
        
        {/* --- OVERVIEW TAB --- */}
        {currentTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {/* Club Profile Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <LayoutDashboard className="w-3 h-3" /> Club Profile
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white/50 text-xs uppercase">Full Name</p>
                  <p className="text-white font-medium">{teamData.name}</p>
                </div>
                {teamData.strStadium && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Stadium</p>
                    <p className="text-white font-medium">{teamData.strStadium}</p>
                  </div>
                )}
                {teamData.intFormedYear && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Founded</p>
                    <p className="text-white font-medium">{teamData.intFormedYear}</p>
                  </div>
                )}
                {teamData.currentLeagueId && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">League</p>
                    <p className="text-white font-medium">{teamData.currentLeagueId === '4689' ? 'K리그1' : 'K리그2'}</p>
                  </div>
                )}
                {standingsData?.rank && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Current Position</p>
                    <p className="text-white font-medium">{standingsData.rank}위</p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Match Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Next Match
              </h3>
              {teamFixtures?.upcoming[0] ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center w-full justify-between">
                    <div className="flex flex-col items-center w-1/3">
                      <div className="w-16 h-16 bg-white/5 rounded-full mb-2 flex items-center justify-center p-2">
                         <CrestImg src={teamFixtures.upcoming[0].homeTeam?.badgeUrl} alt={teamFixtures.upcoming[0].homeTeam?.name || 'Home Team'} size={48} />
                      </div> 
                      <span className="font-bold text-sm text-center truncate w-full">{teamFixtures.upcoming[0].homeTeam?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-bold text-white/30">VS</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      <div className="w-16 h-16 bg-white/5 rounded-full mb-2 flex items-center justify-center p-2">
                         <CrestImg src={teamFixtures.upcoming[0].awayTeam?.badgeUrl} alt={teamFixtures.upcoming[0].awayTeam?.name || 'Away Team'} size={48} />
                      </div> 
                      <span className="font-bold text-sm text-center truncate w-full">{teamFixtures.upcoming[0].awayTeam?.name || 'Unknown'}</span>
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
                <BarChart3 className="w-3 h-3" /> Recent Results
              </h3>
              <div className="space-y-2">
                {teamFixtures?.recent.slice(0, 5).map(match => { // Changed to slice(0, 5)
                  const opponent = match.homeTeamId === teamIdParam ? match.awayTeam : match.homeTeam;
                  const opponentName = opponent?.name || 'Unknown';
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

            {/* Squad Snapshot */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <Users className="w-3 h-3" /> Key Players
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {players?.slice(0, 4).map(player => (
                  <div key={player.idPlayer} className="bg-white/5 border border-white/5 p-4 rounded-lg flex flex-col items-center text-center hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 bg-white/10 rounded-full mb-3 flex items-center justify-center text-white/50">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm truncate w-full text-white">{player.strPlayer}</span>
                    <span className="text-xs text-white/50 mt-0.5">{player.strPosition}</span>
                    <div className="mt-3 text-[10px] font-mono bg-black/40 px-2 py-1 rounded text-purple-300 w-full">
                      {player.goals ? `${player.goals} Goals` : 'No Stats'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compact Team Lineup */}
            {players && players.length > 0 && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
                <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                  <LayoutDashboard className="w-3 h-3" /> Formation
                </h3>
                <TeamLineup teamId={Number(teamIdParam)} players={players || []} compact={true} />
              </div>
            )}

            {/* Key Staff & Facilities Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <Users className="w-3 h-3" /> Staff & Facilities
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white/50 text-xs uppercase">Manager</p>
                  <p className="text-white font-medium">홍길동 (Placeholder)</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase">Assistant Manager</p>
                  <p className="text-white font-medium">이순신 (Placeholder)</p>
                </div>
                {teamData.strStadium && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Stadium</p>
                    <p className="text-white font-medium">{teamData.strStadium}</p>
                  </div>
                )}
                <div>
                  <p className="text-white/50 text-xs uppercase">Training Ground</p>
                  <p className="text-white font-medium">Excellent (Placeholder)</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase">Youth Academy</p>
                  <p className="text-white font-medium">Good (Placeholder)</p>
                </div>
              </div>
            </div>

            {/* Mini League Table Card */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 shadow-sm col-span-1">
              <h3 className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider flex items-center gap-2">
                <BarChart3 className="w-3 h-3" /> League Standing
              </h3>
              <div className="space-y-3">
                {teamData.currentLeagueId && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">League</p>
                    <p className="text-white font-medium">{teamData.currentLeagueId === '4689' ? 'K리그1' : 'K리그2'}</p>
                  </div>
                )}
                {standingsData?.rank && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Current Rank</p>
                    <p className="text-white font-medium">{standingsData.rank}위</p>
                  </div>
                )}
                {standingsData?.points && (
                  <div>
                    <p className="text-white/50 text-xs uppercase">Points</p>
                    <p className="text-white font-medium">{standingsData.points} pts</p>
                  </div>
                )}
                <div className="mt-4 text-center text-white/50 text-xs italic border-t border-white/10 pt-3">
                  Nearby teams and full league table coming soon.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- SQUAD TAB --- */}
        {currentTab === 'squad' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Team Lineup */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="text-purple-500 w-5 h-5" /> Formation
                </h3>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-white/70 font-medium">
                  {players?.length || 0} Players
                </span>
              </div>
              <TeamLineup teamId={Number(teamIdParam)} players={players || []} />
            </div>
            
            {/* Full Roster List */}
            <TeamRoster idTeam={teamIdParam} teamName={teamData.name} />
          </div>
        )}

        {/* --- FIXTURES TAB --- */}
        {currentTab === 'fixtures' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/5 font-bold flex items-center gap-2 text-white">
                <Calendar className="text-purple-500 w-5 h-5" /> Match Schedule
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-white/40 uppercase bg-black/20">
                    <tr>
                      <th className="px-6 py-3 font-bold tracking-wider">Date</th>
                      <th className="px-6 py-3 font-bold tracking-wider">Opponent</th>
                      <th className="px-6 py-3 font-bold tracking-wider text-center">Result/Time</th>
                      <th className="px-6 py-3 font-bold tracking-wider">Venue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {/* Upcoming */}
                    {teamFixtures?.upcoming.map(match => (
                      <tr key={match.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-white/90">{formatDate(match.date)}</td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          {match.homeTeamId === teamIdParam ? (
                            <>
                              <span className="text-white/50 text-xs font-bold bg-white/10 px-1.5 py-0.5 rounded">VS</span>
                              <span className="text-white font-medium">{match.awayTeam?.name || 'Unknown'}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-white/50 text-xs font-bold bg-white/10 px-1.5 py-0.5 rounded">@</span>
                              <span className="text-white font-medium">{match.homeTeam?.name || 'Unknown'}</span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{formatTime(match.date)}</td>
                        <td className="px-6 py-4 text-white/50 truncate max-w-xs">{match.venueName}</td>
                      </tr>
                    ))}
                    {/* Recent */}
                    {teamFixtures?.recent.map(match => (
                      <tr key={match.id} className="hover:bg-white/5 transition-colors bg-white/5">
                        <td className="px-6 py-4 font-medium text-white/60">{formatDate(match.date)}</td>
                        <td className="px-6 py-4 flex items-center gap-3 text-white/60">
                          {match.homeTeamId === teamIdParam ? (
                            <>
                              <span className="text-white/30 text-xs font-bold bg-white/5 px-1.5 py-0.5 rounded">VS</span>
                              <span>{match.awayTeam?.name || 'Unknown'}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-white/30 text-xs font-bold bg-white/5 px-1.5 py-0.5 rounded">@</span>
                              <span>{match.homeTeam?.name || 'Unknown'}</span>
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
                <BarChart3 className="text-purple-500" /> Season Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs uppercase font-bold">Games</span>
                  <div className="text-3xl font-bold mt-1 text-white">{standingsData.gamesPlayed}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs uppercase font-bold">Wins</span>
                  <div className="text-3xl font-bold mt-1 text-green-400">{standingsData.wins}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs uppercase font-bold">Goals</span>
                  <div className="text-3xl font-bold mt-1 text-blue-400">{standingsData.goalsFor}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <span className="text-white/40 text-xs uppercase font-bold">Diff</span>
                  <div className="text-3xl font-bold mt-1 text-purple-400">{standingsData.goalDifference}</div>
                </div>
              </div>
              
              {/* Detailed Table Placeholder */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <h4 className="text-white/40 text-sm font-bold mb-4 uppercase">Detailed Breakdown</h4>
                <div className="bg-black/40 rounded-lg p-8 text-center border border-white/5 border-dashed">
                  <BarChart3 className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Advanced performance metrics will be available soon.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}