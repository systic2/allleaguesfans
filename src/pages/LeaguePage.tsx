// src/pages/LeaguePage.tsx (상세)
import { Link, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Newspaper, CalendarDays } from "lucide-react";
import {
  getSeasonId,
  listLeagueTable,
  type LeagueTableRow,
} from "@/features/season/api";
import LogoImg from "@/components/LogoImg"; // 또는 "@/app/components/LogoImg"

type LeagueSlug = "kleague1" | "kleague2";
const isSlug = (v: any): v is LeagueSlug =>
  v === "kleague1" || v === "kleague2";
const YEAR = 2025;

export default function LeaguePage() {
  const { leagueId } = useParams();
  const slug: LeagueSlug = isSlug(leagueId) ? leagueId : "kleague1";

  // slug -> seasonId
  const seasonQ = useQuery({
    queryKey: ["seasonId", slug, YEAR],
    queryFn: () => getSeasonId(slug, YEAR),
  });

  // seasonId가 준비되기 전에는 절대 쿼리 날리지 않음 (중요)
  const tableQ = useQuery<LeagueTableRow[], Error>({
    queryKey: ["leagueTable", seasonQ.data],
    queryFn: () => listLeagueTable(seasonQ.data as string),
    enabled: !!seasonQ.data, // ✅ 여기로 "undefined" eq 방지
  });

  if (leagueId && !isSlug(leagueId)) {
    return <Navigate to="/leagues/kleague1" replace />;
  }

  const isLoading = seasonQ.isLoading || tableQ.isLoading;
  const error = seasonQ.error || tableQ.error;
  const rows = tableQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg grid place-items-center bg-blue-500/30 ring-1 ring-inset ring-blue-400/40">
          <Trophy className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">
            리그 홈 ({slug === "kleague2" ? "K리그2" : "K리그1"})
          </div>
          <div className="text-xs opacity-70">순위 · 뉴스 · 일정 요약</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Section title="리그 순위">
          {isLoading && <div className="opacity-80 text-sm">로딩…</div>}
          {error && (
            <div className="text-red-400 text-sm">
              에러: {String(error.message)}
            </div>
          )}
          {!isLoading && !error && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs opacity-70">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">팀</th>
                  <th className="py-1 pr-2 text-right">경기</th>
                  <th className="py-1 pr-2 text-right">득실</th>
                  <th className="py-1 pr-2 text-right">승점</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.team_id} className="border-t border-white/10">
                    <td className="py-1 pr-2">{r.position}</td>
                    <td className="py-1 pr-2">
                      <Link
                        to={`/teams/${r.team_id}`}
                        className="hover:underline flex items-center gap-2"
                      >
                        <LogoImg
                          src={r.crest_url}
                          alt={r.team_name}
                          className="w-6 h-6 object-contain"
                        />
                        <span>{r.team_name}</span>
                      </Link>
                    </td>
                    <td className="py-1 pr-2 text-right">{r.played ?? "—"}</td>
                    <td className="py-1 pr-2 text-right">
                      {r.gd >= 0 ? `+${r.gd}` : r.gd}
                    </td>
                    <td className="py-1 pr-2 text-right font-medium">
                      {r.points ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="뉴스"
          right={
            <span className="text-xs opacity-70 flex items-center gap-1">
              <Newspaper className="size-4" /> 30분 전
            </span>
          }
        >
          {/* ...목업 유지... */}
        </Section>

        <Section
          title="다가오는 일정"
          right={<CalendarDays className="size-4 opacity-80" />}
        >
          {/* ...목업 유지... */}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 shadow-xl">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
