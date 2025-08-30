import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamsByLeague } from "../lib/api";
import type { Team } from "../lib/types";

export default function LeaguePage() {
  const { leagueId = "" } = useParams();
  const { data, isLoading, error } = useQuery<Team[], Error>({
    queryKey: ["teams", leagueId],
    queryFn: () => fetchTeamsByLeague(leagueId),
    enabled: !!leagueId,
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
      <h1 className="text-2xl font-semibold mb-4">팀</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {data?.map((t) => (
          <Link
            key={t.id}
            to={`/teams/${t.id}`}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-md p-4"
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-xs opacity-70 mt-1">{t.stadium ?? "-"}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
