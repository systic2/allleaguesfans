import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLeagueTable,
  fetchSeasonTeams,
  type LeagueTableRow,
  type TeamLite,
} from "@/features/season/api";

export default function LeaguePage() {
  const { slug = "" } = useParams<{ slug: string }>();

  const {
    data: table,
    isLoading: loadingTable,
    error: errTable,
  } = useQuery<LeagueTableRow[]>({
    queryKey: ["league-table", slug],
    queryFn: () => fetchLeagueTable(slug),
  });

  const {
    data: teams,
    isLoading: loadingTeams,
    error: errTeams,
  } = useQuery<TeamLite[]>({
    queryKey: ["league-teams", slug],
    queryFn: () => fetchSeasonTeams(slug),
  });

  if (loadingTable || loadingTeams) return <div className="p-6">로딩중…</div>;
  if (errTable || errTeams)
    return <div className="p-6 text-red-400">에러가 발생했어요.</div>;

  const rows = table ?? [];

  return (
    <div className="p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-3">순위표</h1>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">팀</th>
                <th className="py-2 pr-3 text-right">경기</th>
                <th className="py-2 pr-3 text-right">승</th>
                <th className="py-2 pr-3 text-right">무</th>
                <th className="py-2 pr-3 text-right">패</th>
                <th className="py-2 pr-3 text-right">득</th>
                <th className="py-2 pr-3 text-right">실</th>
                <th className="py-2 pr-3 text-right">득실</th>
                <th className="py-2 pr-3 text-right">승점</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} className="border-t border-white/10">
                  <td className="py-2 pr-3 w-10">{r.position}</td>
                  <td className="py-2 pr-3">
                    <Link
                      to={`/teams/${r.team.id}`}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <img
                        src={r.team.crest_url ?? "/logo-fallback.svg"}
                        alt={r.team.name}
                        className="w-6 h-6 object-contain"
                      />
                      <span>{r.team.name}</span>
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right">{r.played}</td>
                  <td className="py-2 pr-3 text-right">{r.win}</td>
                  <td className="py-2 pr-3 text-right">{r.draw}</td>
                  <td className="py-2 pr-3 text-right">{r.loss}</td>
                  <td className="py-2 pr-3 text-right">{r.gf}</td>
                  <td className="py-2 pr-3 text-right">{r.ga}</td>
                  <td className="py-2 pr-3 text-right">{r.gd}</td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">참가 팀</h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(teams ?? []).map((t) => (
            <li key={t.id} className="border border-white/10 rounded-xl p-3">
              <Link
                to={`/teams/${t.id}`}
                className="flex items-center gap-3 hover:underline"
              >
                <img
                  src={t.crest_url ?? "/logo-fallback.svg"}
                  alt={t.name}
                  className="w-8 h-8 object-contain"
                />
                <span>{t.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
