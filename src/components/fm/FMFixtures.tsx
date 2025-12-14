import { Link } from "react-router-dom";
import type { MatchWithTeams } from "@/lib/thesportsdb-api";

export default function FMFixtures({ fixtures }: { fixtures: MatchWithTeams[] }) {
  if (!fixtures || fixtures.length === 0) {
    return <div className="p-4 text-xs text-gray-400">예정된 경기가 없습니다.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#232323]">
      <table className="w-full text-[11px] text-gray-300">
        <tbody className="divide-y divide-[#333]">
          {fixtures.map((match) => {
            const date = new Date(match.date);
            const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });
            
            const isFinished = ['FINISHED', 'FT', 'AET', 'PEN'].includes(match.status);
            const isLive = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(match.status);

            return (
              <tr key={match.id} className="hover:bg-[#383838] transition-colors">
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap w-20 text-right pr-4 border-r border-[#333]">
                  <div>{dateStr}</div>
                  <div className="text-[10px] opacity-70">{timeStr}</div>
                </td>
                <td className="px-3 py-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <Link to={`/teams/${match.homeTeamId}`} className="flex-1 text-right hover:text-white truncate">
                      {match.homeTeam?.name || match.homeTeamId}
                    </Link>
                    
                    <div className="px-3 text-center min-w-[40px] font-bold text-white bg-[#1a1a1a] mx-2 py-0.5 rounded">
                      {(isFinished || isLive) && match.homeScore !== null && match.homeScore !== undefined ? (
                        <span className={isLive ? "text-red-500 animate-pulse" : ""}>
                          {match.homeScore} - {match.awayScore}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-[10px]">VS</span>
                      )}
                    </div>

                    <Link to={`/teams/${match.awayTeamId}`} className="flex-1 text-left hover:text-white truncate">
                      {match.awayTeam?.name || match.awayTeamId}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
