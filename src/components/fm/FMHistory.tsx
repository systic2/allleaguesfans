import type { HistoricalChampion } from "@/lib/api";

export default function FMHistory({ history }: { history: HistoricalChampion[] }) {
  if (!history || history.length === 0) {
    return <div className="p-4 text-xs text-gray-400">기록 없음</div>;
  }

  return (
    <table className="w-full text-[11px] text-gray-300">
      <tbody className="divide-y divide-[#333]">
        {history.map((record) => (
          <tr key={record.season_year} className="hover:bg-[#383838] transition-colors">
            <td className="px-3 py-1.5 flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center bg-yellow-600/20 rounded-full text-yellow-500 text-[10px]">★</span>
              <span className="text-white font-medium">{record.champion_name}</span>
            </td>
            <td className="px-3 py-1.5 text-right text-gray-500 font-mono">
              {record.season_year}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
