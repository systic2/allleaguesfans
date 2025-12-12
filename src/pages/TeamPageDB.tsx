import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, BarChart3, ChevronLeft } from "lucide-react";
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

// Types
type FormResult = 'W' | 'D' | 'L';
type TabType = 'overview' | 'squad' | 'fixtures' | 'stats';

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
  const teamIdParam = id;
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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
  if (teamLoading) return <div className="min-h-screen bg-slate-900"><LoadingSpinner /></div>;
  if (teamError || !teamData) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">팀을 찾을 수 없습니다.</h2>
        <button onClick={() => navigate('/')} className="bg-purple-600 px-4 py-2 rounded">홈으로</button>
      </div>
    </div>
  );

  const leagueName = teamData.currentLeagueId === '4689' ? 'K리그1' : teamData.currentLeagueId === '4822' ? 'K리그2' : 'Unknown League';

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3 cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => navigate('/')}>
          <ChevronLeft className="w-5 h-5 text-slate-400" />
          <span className="font-bold text-lg tracking-tight">ALL LEAGUES</span>
        </div>
        
        <div className="p-6 flex flex-col items-center border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
          <CrestImg src={teamData.badgeUrl} alt={teamData.name} size={100} className="drop-shadow-2xl mb-4" />
          <h1 className="text-xl font-bold text-center leading-tight">{teamData.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{leagueName}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'overview', label: '개요 (Overview)', icon: LayoutDashboard },
            { id: 'squad', label: '선수단 (Squad)', icon: Users },
            { id: 'fixtures', label: '일정 (Fixtures)', icon: Calendar },
            { id: 'stats', label: '통계 (Stats)', icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          Data provided by TheSportsDB & API-Football
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header (Mobile & Info Bar) */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4 md:hidden">
             {/* Mobile Crest */}
             <CrestImg src={teamData.badgeUrl} alt={teamData.name} size={32} />
             <span className="font-bold truncate">{teamData.name}</span>
          </div>
          
          {/* Status Bar */}
          <div className="flex items-center gap-6 ml-auto text-sm">
            {standingsData && (
              <>
                <div className="flex flex-col items-end">
                  <span className="text-slate-400 text-xs uppercase">League Pos</span>
                  <span className="font-bold text-lg text-purple-400">{standingsData.rank}위</span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="flex flex-col items-end">
                  <span className="text-slate-400 text-xs uppercase">Points</span>
                  <span className="font-bold text-lg">{standingsData.points}</span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
              </>
            )}
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs uppercase mb-1">Form</span>
              <div className="flex gap-1">
                {formGuide?.map((res, i) => <ResultBadge key={i} result={res} />) || <span className="text-slate-600">-</span>}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
          <div className="max-w-6xl mx-auto">
            
            {/* --- OVERVIEW TAB --- */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                {/* Next Match Card */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-wider">Next Match</h3>
                  {teamFixtures?.upcoming[0] ? (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-center w-1/3">
                        <div className="w-16 h-16 bg-slate-800 rounded-full mb-2 flex items-center justify-center overflow-hidden">
                           {teamFixtures.upcoming[0].homeTeam?.badgeUrl ? <img src={teamFixtures.upcoming[0].homeTeam.badgeUrl} alt="" className="w-full h-full object-contain" /> : <div className="w-8 h-8 bg-slate-700 rounded-full"/>}
                        </div> 
                        <span className="font-bold text-sm text-center truncate w-full">{teamFixtures.upcoming[0].homeTeam?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-slate-500">VS</span>
                        <span className="text-xs text-purple-400 mt-1">{formatDate(teamFixtures.upcoming[0].date)}</span>
                        <span className="text-xs text-slate-500">{formatTime(teamFixtures.upcoming[0].date)}</span>
                      </div>
                      <div className="flex flex-col items-center w-1/3">
                        <div className="w-16 h-16 bg-slate-800 rounded-full mb-2 flex items-center justify-center overflow-hidden">
                           {teamFixtures.upcoming[0].awayTeam?.badgeUrl ? <img src={teamFixtures.upcoming[0].awayTeam.badgeUrl} alt="" className="w-full h-full object-contain" /> : <div className="w-8 h-8 bg-slate-700 rounded-full"/>}
                        </div> 
                        <span className="font-bold text-sm text-center truncate w-full">{teamFixtures.upcoming[0].awayTeam?.name || 'Unknown'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 py-4 text-center">예정된 경기가 없습니다.</p>
                  )}
                </div>

                {/* Recent Results Summary */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-wider">Recent Results</h3>
                  <div className="space-y-3">
                    {teamFixtures?.recent.slice(0, 3).map(match => (
                      <div key={match.id} className="flex justify-between items-center bg-slate-950/50 p-3 rounded hover:bg-slate-800 transition-colors cursor-default">
                        <div className="flex items-center gap-3">
                          <ResultBadge result={
                            match.homeScore === match.awayScore ? 'D' :
                            (match.homeTeamId === teamIdParam && match.homeScore! > match.awayScore!) || (match.awayTeamId === teamIdParam && match.awayScore! > match.homeScore!) ? 'W' : 'L'
                          } />
                          <span className="text-sm text-slate-300">vs {match.homeTeamId === teamIdParam ? (match.awayTeam?.name || 'Unknown') : (match.homeTeam?.name || 'Unknown')}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-200">{match.homeScore} - {match.awayScore}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Player / Top Scorer (Placeholder for now, using roster snippet) */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm lg:col-span-2">
                  <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-wider">Squad Snapshot</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {players?.slice(0, 4).map(player => (
                      <div key={player.idPlayer} className="bg-slate-950 p-4 rounded-lg flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-slate-800 rounded-full mb-2 flex items-center justify-center text-slate-500">
                          <Users className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-sm truncate w-full">{player.strPlayer}</span>
                        <span className="text-xs text-slate-500">{player.strPosition}</span>
                        <div className="mt-2 text-xs font-mono bg-slate-900 px-2 py-1 rounded text-purple-300">
                          {player.goals ? `${player.goals} Goals` : 'No Stats'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- SQUAD TAB --- */}
            {activeTab === 'squad' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Users className="text-purple-500" /> First Team Squad
                    </h3>
                    <span className="text-sm text-slate-500">{players?.length || 0} Players</span>
                  </div>
                  <TeamLineup teamId={Number(teamIdParam)} players={players || []} />
                </div>
                <TeamRoster idTeam={teamIdParam} teamName={teamData.name} />
              </div>
            )}

            {/* --- FIXTURES TAB --- */}
            {activeTab === 'fixtures' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-4 bg-slate-800 border-b border-slate-700 font-bold flex items-center gap-2">
                    <Calendar className="text-purple-500 w-5 h-5" /> Schedule
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Opponent</th>
                        <th className="px-6 py-3 text-center">Result/Time</th>
                        <th className="px-6 py-3">Venue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {/* Upcoming */}
                      {teamFixtures?.upcoming.map(match => (
                        <tr key={match.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{formatDate(match.date)}</td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            {match.homeTeamId === teamIdParam ? (
                              <>vs <span className="text-slate-200">{match.awayTeam?.name || 'Unknown'}</span></>
                            ) : (
                              <>@ <span className="text-slate-200">{match.homeTeam?.name || 'Unknown'}</span></>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-slate-400">{formatTime(match.date)}</td>
                          <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{match.venueName}</td>
                        </tr>
                      ))}
                      {/* Recent (merged for simple view, normally separated) */}
                      {teamFixtures?.recent.map(match => (
                        <tr key={match.id} className="hover:bg-slate-800/50 transition-colors bg-slate-900/30">
                          <td className="px-6 py-4 font-medium text-slate-400">{formatDate(match.date)}</td>
                          <td className="px-6 py-4 flex items-center gap-2 text-slate-400">
                            {match.homeTeamId === teamIdParam ? (
                              <>vs <span>{match.awayTeam?.name || 'Unknown'}</span></>
                            ) : (
                              <>@ <span>{match.homeTeam?.name || 'Unknown'}</span></>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded font-bold text-xs ${
                              match.homeScore === match.awayScore ? 'bg-yellow-900/50 text-yellow-500' :
                              (match.homeTeamId === teamIdParam && match.homeScore! > match.awayScore!) || (match.awayTeamId === teamIdParam && match.awayScore! > match.homeScore!) ? 'bg-green-900/50 text-green-500' : 'bg-red-900/50 text-red-500'
                            }`}>
                              {match.homeScore} - {match.awayScore}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{match.venueName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- STATS TAB --- */}
            {activeTab === 'stats' && standingsData && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <BarChart3 className="text-purple-500" /> Season Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <span className="text-slate-500 text-xs uppercase font-bold">Games Played</span>
                      <div className="text-3xl font-bold mt-1 text-white">{standingsData.gamesPlayed}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <span className="text-slate-500 text-xs uppercase font-bold">Wins</span>
                      <div className="text-3xl font-bold mt-1 text-green-400">{standingsData.wins}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <span className="text-slate-500 text-xs uppercase font-bold">Goals Scored</span>
                      <div className="text-3xl font-bold mt-1 text-blue-400">{standingsData.goalsFor}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-lg">
                      <span className="text-slate-500 text-xs uppercase font-bold">Goal Diff</span>
                      <div className="text-3xl font-bold mt-1 text-purple-400">{standingsData.goalDifference}</div>
                    </div>
                  </div>
                  
                  {/* Detailed Table Placeholder */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    <h4 className="text-slate-400 text-sm font-bold mb-4 uppercase">Performance Details</h4>
                    <div className="bg-slate-950/50 rounded p-4 text-center text-slate-500">
                      Detailed seasonal performance charts coming soon...
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}