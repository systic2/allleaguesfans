import type { TopScorer, TopAssist } from "@/lib/api";
import { useTeamName } from "@/hooks/useTeamName";

type StatItem = {
  rank: number;
  name: string;
  team: string;
  value: string | number;
  subValue?: string | number; // e.g. appearances
};

function StatCard({ title, items }: { title: string, items: StatItem[] }) {
  return (
    <div className="flex flex-col bg-panel border border-line h-full">
      <div className="px-3 py-1.5 bg-gradient-to-r from-raised to-panel border-b border-line flex justify-between">
        <h4 className="text-[11px] font-bold text-gray-200">{title}</h4>
        <span className="text-xs text-gray-500 cursor-pointer hover:text-white">더보기 »</span>
      </div>
      <div className="flex-1">
        <table className="w-full text-[11px]">
          <tbody className="divide-y divide-line">
            {items.slice(0, 5).map((item, idx) => (
              <tr key={idx} className="hover:bg-raised">
                <td className="px-2 py-1 w-6 text-center text-gray-500">{item.rank}</td>
                <td className="px-2 py-1">
                  <div className="text-gray-200 font-medium truncate max-w-[100px]">{item.name}</div>
                  <div className="text-gray-500 text-xs truncate max-w-[100px]">{item.team}</div>
                </td>
                <td className="px-3 py-1 text-right font-bold text-white bg-panel">
                  {item.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FMPlayerStats({ scorers, assists }: { scorers: TopScorer[], assists: TopAssist[] }) {
  const teamName = useTeamName();
  const goalItems: StatItem[] = scorers.map((p, i) => ({
    rank: i + 1,
    name: p.player_name,
    team: teamName(p.team_id, p.team_name),
    value: p.goals
  }));

  const assistItems: StatItem[] = assists.map((p, i) => ({
    rank: i + 1,
    name: p.player_name,
    team: teamName(p.team_id, p.team_name),
    value: p.assists
  }));

  return (
    <div className="grid grid-cols-2 gap-1">
      <StatCard title="득점 >" items={goalItems} />
      <StatCard title="도움 >" items={assistItems} />
    </div>
  );
}
