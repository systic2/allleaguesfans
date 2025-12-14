import { Link } from "react-router-dom";
import type { MatchWithTeams } from "@/lib/thesportsdb-api";

export default function FMFixtures({ fixtures }: { fixtures: MatchWithTeams[] }) {
  if (!fixtures || fixtures.length === 0) {
    return <div className="p-4 text-xs text-gray-400">예정된 경기가 없습니다.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#232323] overflow-hidden">
      <div className="overflow-y-auto h-full custom-scrollbar">
        <table className="w-full text-xs text-gray-300">
          <tbody className="divide-y divide-[#333]">
            {fixtures.map((match) => {
              const date = new Date(match.date);
              const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              const dateStr = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });
              
              const isFinished = ['FINISHED', 'FT', 'AET', 'PEN'].includes(match.status);
              const isLive = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(match.status);
              const isPostponed = ['POSTPONED', 'SUSP', 'INT'].includes(match.status);

              return (
                <tr key={match.id} className="hover:bg-[#383838] transition-colors">
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap w-20 text-right pr-4 border-r border-[#333]">
                    <div>{dateStr}</div>
                    <div className="text-[10px] opacity-70">{timeStr}</div>
                  </td>
                  <td className="px-3 py-2 w-full">
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <Link to={`/teams/${match.homeTeamId}`} className="flex-1 flex items-center justify-end gap-2 text-right hover:text-white group">
                        <span className="truncate">{match.homeTeam?.name || `Team ${match.homeTeamId}`}</span>
                        {match.homeTeam?.badgeUrl && (
                          <img src={match.homeTeam.badgeUrl} alt="" className="w-5 h-5 object-contain opacity-80 group-hover:opacity-100" />
                        )}
                      </Link>
                      
                      {/* Score / VS / Status */}
                      <div className={`px-2 text-center min-w-[60px] font-bold mx-3 py-1 rounded border ${
                        isLive 
                          ? 'bg-red-900/30 text-red-400 border-red-800 animate-pulse' 
                          : 'bg-[#1a1a1a] text-white border-[#333]'
                      }`}>
                        {(isFinished || isLive) && match.homeScore !== null && match.homeScore !== undefined ? (
                          <span>
                            {match.homeScore} - {match.awayScore}
                          </span>
                        ) : isPostponed ? (
                           <span className="text-yellow-500 text-[10px]">연기됨</span>
                        ) : (
                          <span className="text-gray-600 text-[10px]">VS</span>
                        )}
                      </div>

                      {/* Away Team */}
                      <Link to={`/teams/${match.awayTeamId}`} className="flex-1 flex items-center justify-start gap-2 text-left hover:text-white group">
                        {match.awayTeam?.badgeUrl && (
                          <img src={match.awayTeam.badgeUrl} alt="" className="w-5 h-5 object-contain opacity-80 group-hover:opacity-100" />
                        )}
                        <span className="truncate">{match.awayTeam?.name || `Team ${match.awayTeamId}`}</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}