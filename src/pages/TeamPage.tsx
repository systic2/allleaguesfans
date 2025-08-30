import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayersByTeam } from "../lib/api";
import type { Player } from "../lib/types";

export default function TeamPage() {
  const { teamId = "" } = useParams();
  const { data, isLoading, error } = useQuery<Player[], Error>({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayersByTeam(teamId),
    enabled: !!teamId,
  });

  if (isLoading) return <p className="opacity-80">로딩…</p>;
  if (error)
    return (
      <pre className="text-red-400 whitespace-pre-wrap">
        에러: {error.message}
      </pre>
    );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">선수</h1>
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead className="text-left">
          <tr>
            <th className="px-2 py-1 opacity-70">이름</th>
            <th className="px-2 py-1 opacity-70">포지션</th>
            <th className="px-2 py-1 opacity-70">나이</th>
            <th className="px-2 py-1 opacity-70">국적</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.id} className="rounded-xl overflow-hidden">
              <td className="px-2">
                <Link
                  to={`/players/${p.id}`}
                  className="block rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-sm px-3 py-2"
                >
                  {p.name}
                </Link>
              </td>
              <td className="px-2">{p.position ?? "-"}</td>
              <td className="px-2">{p.age ?? "-"}</td>
              <td className="px-2">{p.nationality ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
