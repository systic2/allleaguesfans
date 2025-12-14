import type { TopScorer, TopAssist } from "@/lib/api";

type StatItem = {
  rank: number;
  name: string;
  team: string;
  value: string | number;
  subValue?: string | number; // e.g. appearances
};

function StatCard({ title, items }: { title: string, items: StatItem[] }) {
  return (
    <div className="flex flex-col bg-[#2b2b2b] border border-[#1e1e1e] h-full">
      <div className="px-3 py-1.5 bg-gradient-to-r from-[#3a3a3a] to-[#2b2b2b] border-b border-[#1e1e1e] flex justify-between">
        <h4 className="text-[11px] font-bold text-gray-200">{title}</h4>
        <span className="text-[10px] text-gray-500 cursor-pointer hover:text-white">더보기 »</span>
      </div>
      <div className="flex-1">
        <table className="w-full text-[11px]">
          <tbody className="divide-y divide-[#333]">
            {items.slice(0, 5).map((item, idx) => (
              <tr key={idx} className="hover:bg-[#383838]">
                <td className="px-2 py-1 w-6 text-center text-gray-500">{item.rank}</td>
                <td className="px-2 py-1">
                  <div className="text-gray-200 font-medium truncate max-w-[100px]">{item.name}</div>
                  <div className="text-gray-500 text-[10px] truncate max-w-[100px]">{item.team}</div>
                </td>
                <td className="px-3 py-1 text-right font-bold text-white bg-[#252525]">
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
  const goalItems: StatItem[] = scorers.map((p, i) => ({
    rank: i + 1,
    name: p.player_name,
    team: p.team_name,
    value: p.goals
  }));

  const assistItems: StatItem[] = assists.map((p, i) => ({
    rank: i + 1,
    name: p.player_name,
    team: p.team_name,
    value: p.assists
  }));

  // Mock Rating Data (since API doesn't provide bulk ratings yet)
  const ratingItems: StatItem[] = scorers.slice(0, 5).map((p, i) => ({
    rank: i + 1,
    name: p.player_name,
    team: p.team_name,
    value: (7.8 - i * 0.1).toFixed(2)
  }));

  // Mock Clean Sheets (using random top teams for visual)
  const cleanSheetItems: StatItem[] = [
    { rank: 1, name: "GK 1", team: goalItems[0]?.team || "Team A", value: 12 },
    { rank: 2, name: "GK 2", team: goalItems[1]?.team || "Team B", value: 10 },
    { rank: 3, name: "GK 3", team: goalItems[2]?.team || "Team C", value: 9 },
  ];

  return (
    <div className="grid grid-cols-4 gap-1 h-full">
      <StatCard title="평균 평점 >" items={ratingItems} />
      <StatCard title="경기 MVP >" items={ratingItems} /> {/* Mock using ratings */}
      <StatCard title="득점 >" items={goalItems} />
      <StatCard title="도움 >" items={assistItems} />
    </div>
  );
}
