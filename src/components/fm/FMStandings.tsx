import { Link } from "react-router-dom";
import type { TeamStanding } from "@/lib/api";

function FormBadge({ result }: { result: string }) {
  let color = "bg-gray-500 text-gray-200";
  let text = "-";
  
  if (result === 'W') {
    color = "bg-green-600 text-white border border-green-500";
    text = "승";
  } else if (result === 'D') {
    color = "bg-yellow-600 text-white border border-yellow-500";
    text = "무";
  } else if (result === 'L') {
    color = "bg-red-600 text-white border border-red-500";
    text = "패";
  }

  return (
    <div 
      className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${color}`} 
      title={result === 'W' ? '승리' : result === 'D' ? '무승부' : '패배'}
    >
      {text}
    </div>
  );
}

export default function FMStandings({ standings }: { standings: TeamStanding[] }) {
  if (!standings || standings.length === 0) {
    return <div className="p-4 text-xs text-gray-400">데이터 없음</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300 min-w-[600px]">
        <thead className="bg-[#232323] text-gray-400 sticky top-0 font-bold uppercase tracking-wider">
          <tr className="text-center">
            <th className="px-2 py-2 text-left whitespace-nowrap w-10">순위</th>
            <th className="px-2 py-2 text-left whitespace-nowrap">구단</th>
            <th className="px-1 py-2 whitespace-nowrap w-10" title="경기 수">경기</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="승리">승</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="무승부">무</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="패배">패</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="득점">득</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="실점">실</th>
            <th className="px-1 py-2 whitespace-nowrap w-8" title="득실차">차</th>
            <th className="px-2 py-2 whitespace-nowrap w-12 font-extrabold text-white" title="승점">승점</th>
            <th className="px-2 py-2 text-center whitespace-nowrap w-32">최근 5경기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#333]">
          {standings.map((team) => (
            <tr key={team.team_id} className="hover:bg-[#383838] transition-colors h-8">
              <td className={`px-2 py-1 text-center font-mono ${team.rank <= 4 ? 'text-green-400 font-bold' : ''}`}>
                {team.rank}
              </td>
              <td className="px-2 py-1 font-medium text-white truncate max-w-[140px]">
                <Link to={`/teams/${team.team_id}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                  {team.crest_url && (
                    <img src={team.crest_url} alt="" className="w-5 h-5 object-contain" />
                  )}
                  <span className="truncate">{team.team_name}</span>
                </Link>
              </td>
              <td className="px-1 py-1 text-center">{team.played}</td>
              <td className="px-1 py-1 text-center text-gray-400">{team.win}</td>
              <td className="px-1 py-1 text-center text-gray-400">{team.draw}</td>
              <td className="px-1 py-1 text-center text-gray-400">{team.lose}</td>
              <td className="px-1 py-1 text-center">{team.goals_for}</td>
              <td className="px-1 py-1 text-center text-gray-400">{team.goals_against}</td>
              <td className={`px-1 py-1 text-center ${team.goals_diff > 0 ? 'text-green-400' : team.goals_diff < 0 ? 'text-red-400' : ''}`}>
                {team.goals_diff > 0 ? `+${team.goals_diff}` : team.goals_diff}
              </td>
              <td className="px-2 py-1 text-center font-bold text-white bg-[#2a2a2a] border-x border-[#333]">
                {team.points}
              </td>
              <td className="px-2 py-1">
                <div className="flex justify-center gap-1">
                  {team.form ? team.form.split('').slice(0, 5).map((r, i) => (
                    <FormBadge key={i} result={r} />
                  )) : <span className="text-gray-600 text-[10px]">-</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
