import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayer } from "../lib/api";
import type { Player } from "../lib/types";

export default function PlayerPage() {
  const { playerId = "" } = useParams();
  const { data, isLoading, error } = useQuery<Player, Error>({
    queryKey: ["player", playerId],
    queryFn: () => fetchPlayer(playerId),
    enabled: !!playerId,
  });

  if (isLoading) return <p className="opacity-80">로딩…</p>;
  if (error)
    return (
      <pre className="text-red-400 whitespace-pre-wrap">
        에러: {error.message}
      </pre>
    );
  if (!data) return <p>선수를 찾을 수 없습니다.</p>;

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-md p-4">
        <div className="text-xl font-semibold">{data.name}</div>
        <div className="opacity-80 text-sm mt-1">
          {data.position ?? "-"} · {data.nationality ?? "-"}
        </div>
      </div>
      <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 shadow-md p-4">
        <ul className="text-sm space-y-2">
          <li>
            나이: <span className="opacity-80">{data.age ?? "-"}</span>
          </li>
          <li>
            신장: <span className="opacity-80">{data.height_cm ?? "-"} cm</span>
          </li>
          <li>
            체중: <span className="opacity-80">{data.weight_kg ?? "-"} kg</span>
          </li>
          <li>
            주발:{" "}
            <span className="opacity-80">{data.preferred_foot ?? "-"}</span>
          </li>
          <li>
            이적가치(€):{" "}
            <span className="opacity-80">{data.market_value_eur ?? "-"}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
