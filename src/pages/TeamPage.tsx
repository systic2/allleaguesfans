import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayersByTeam, type PlayerLite } from "@/lib/api";
import SmallPitch from "@/app/components/SmallPitch";
import CrestImg from "@/app/components/CrestImg";

export default function TeamPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const teamId = Number(id);

  const { data } = useQuery<PlayerLite[]>({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchPlayersByTeam(teamId),
    enabled: Number.isFinite(teamId) && teamId > 0,
  });

  const players: PlayerLite[] = data ?? [];
  const lineup = players
    .slice(0, 11)
    .map((p, i) => ({ label: p.position ?? "PL", order: i }));

  return (
    <div className="p-6 space-y-6">
      <section>
        <h1 className="text-xl font-semibold mb-3">선발 예상</h1>
        <SmallPitch items={lineup} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">선수 목록</h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {players.map((p) => (
            <li key={p.id} className="border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <CrestImg
                  src={p.photo_url}
                  alt={p.name}
                  size={40}
                  className="rounded-full object-cover"
                />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-white/60">
                    {p.position ?? "—"}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
