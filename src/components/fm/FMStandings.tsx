import { Link } from "react-router-dom";
import type { TeamStanding } from "@/lib/api";

function FormDot({ result }: { result: string }) {
  let color = "bg-gray-500";
  if (result === 'W') color = "bg-green-500";
  else if (result === 'D') color = "bg-yellow-500";
  else if (result === 'L') color = "bg-red-500";

  return <div className={`w-2 h-2 rounded-full ${color}`} title={result} />;
}

export default function FMStandings({ standings }: { standings: TeamStanding[] }) {
  if (!standings || standings.length === 0) {
    return <div className="p-4 text-xs text-gray-400">데이터 없음</div>;
  }

  return (
    <table className="w-full text-[11px] text-gray-300">
      <thead className="bg-[#232323] text-gray-400 sticky top-0">
        <tr>
          <th className="px-2 py-1 text-left w-8">순위</th>
          <th className="px-2 py-1 text-left">구단</th>
          <th className="px-1 py-1 text-center w-6">경기</th>
          <th className="px-1 py-1 text-center w-6">승</th>
          <th className="px-1 py-1 text-center w-6">무</th>
          <th className="px-1 py-1 text-center w-6">패</th>
          <th className="px-1 py-1 text-center w-6">득</th>
          <th className="px-1 py-1 text-center w-6">실</th>
          <th className="px-1 py-1 text-center w-6">차</th>
          <th className="px-1 py-1 text-center w-8 font-bold text-white">승점</th>
          <th className="px-2 py-1 text-center w-16">최근 5경기</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#333]">
        {standings.map((team) => (
          <tr key={team.team_id} className="hover:bg-[#383838] transition-colors">
            <td className={`px-2 py-1 ${team.rank <= 4 ? 'bg-green-900/20 text-green-400' : ''}`}>
              {team.rank}
            </td>
            <td className="px-2 py-1 font-medium text-white truncate max-w-[120px]">
              <Link to={`/teams/${team.team_id}`} className="flex items-center gap-2 hover:underline decoration-1 underline-offset-2">
                {team.crest_url && <img src={team.crest_url} alt="" className="w-4 h-4 object-contain" />}
                {team.team_name}
              </Link>
            </td>
            <td className="px-1 py-1 text-center">{team.played}</td>
            <td className="px-1 py-1 text-center text-gray-400">{team.win}</td>
            <td className="px-1 py-1 text-center text-gray-400">{team.draw}</td>
            <td className="px-1 py-1 text-center text-gray-400">{team.lose}</td>
            <td className="px-1 py-1 text-center">{team.goals_for}</td>
            <td className="px-1 py-1 text-center text-gray-400">{team.goals_against}</td>
            <td className="px-1 py-1 text-center">{team.goals_diff}</td>
            <td className="px-1 py-1 text-center font-bold text-white bg-[#2a2a2a]">{team.points}</td>
            <td className="px-2 py-1">
              <div className="flex justify-center gap-1">
                {team.form ? team.form.split('').slice(0, 5).map((r, i) => (
                  <FormDot key={i} result={r} />
                )) : <span className="text-gray-600">-</span>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
