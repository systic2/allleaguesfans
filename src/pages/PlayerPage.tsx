import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayer, type PlayerLite } from "@/lib/api";
import SmallPitch from "@/app/components/SmallPitch";

export default function PlayerPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const playerId = Number(id);

  const { data } = useQuery<PlayerLite | null>({
    queryKey: ["player", playerId],
    queryFn: () => fetchPlayer(playerId),
    enabled: Number.isFinite(playerId) && playerId > 0,
  });

  const player = data;
  if (!player) return <div className="p-6">선수를 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <img
          src={player.photo_url ?? "/player-fallback.svg"}
          alt={player.name}
          className="w-20 h-20 rounded-full object-cover"
        />
        <div>
          <div className="text-xl font-semibold">{player.name}</div>
          <div className="text-sm text-white/60">{player.position ?? "—"}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">포지션</h2>
        <SmallPitch mainPos={player.position ?? ""} />
      </section>
    </div>
  );
}
