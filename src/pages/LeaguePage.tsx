import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamsByLeague } from "../lib/api";
import type { Team } from "../lib/types";
import { Trophy, Newspaper, CalendarDays } from "lucide-react";

export default function LeaguePage() {
  const { leagueId = "" } = useParams();
  const {
    data: teams,
    isLoading,
    error,
  } = useQuery<Team[], Error>({
    queryKey: ["teams", leagueId],
    queryFn: () => fetchTeamsByLeague(leagueId),
    enabled: !!leagueId,
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg grid place-items-center bg-blue-500/30 ring-1 ring-inset ring-blue-400/40">
          <Trophy className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">리그 홈</div>
          <div className="text-xs opacity-70">순위 · 뉴스 · 일정 요약</div>
        </div>
      </div>

      {/* 본문: 3열 */}
      <div className="grid xl:grid-cols-3 gap-4">
        {/* 순위표 */}
        <Card title="리그 순위">
          {isLoading && <div className="opacity-80 text-sm">로딩…</div>}
          {error && (
            <div className="text-red-400 text-sm">에러: {error.message}</div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-70">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">팀</th>
                <th className="py-1 pr-2 text-right">승점</th>
                <th className="py-1 pr-2 text-right">최근</th>
              </tr>
            </thead>
            <tbody>
              {(teams ?? [])
                .map((t) => ({ ...t, pts: t.points ?? 0 })) // points 없으면 0
                .sort((a, b) => b.pts - a.pts)
                .map((t, i) => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="py-1 pr-2">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <Link to={`/teams/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-1 pr-2 text-right font-medium">
                      {t.pts || "—"}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {/* 최근 폼 목업 */}
                      <FormPills
                        seq={["W", "D", "W", "W", "L"].slice(0, (i % 5) + 1)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        {/* 뉴스 피드 (목업) */}
        <Card
          title="뉴스"
          right={
            <span className="text-xs opacity-70 flex items-center gap-1">
              <Newspaper className="size-4" /> 30분 전
            </span>
          }
        >
          <ul className="space-y-3 text-sm">
            {[
              "수원 삼성 블루윙즈, 원정 10경기 무패 행진 달성",
              "울산, 컵대회 8강 진출… 다음 상대는 전북",
              "서울, 부상자 복귀 임박 소식",
              "대전, 고감도 압박으로 수비 안정화",
            ].map((t, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                {t}
              </li>
            ))}
          </ul>
        </Card>

        {/* 일정/기록 (목업) */}
        <Card
          title="다가오는 일정"
          right={<CalendarDays className="size-4 opacity-80" />}
        >
          <ul className="text-sm space-y-2">
            {[
              { d: "08.31", m: "Jeonbuk", h: true },
              { d: "09.03", m: "Pohang", h: false },
              { d: "09.10", m: "Ulsan", h: true },
            ].map((f, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="opacity-80">{f.d}</span>
                <span className="font-medium">
                  {f.h ? "vs" : "@"} {f.m}
                </span>
                <button className="text-xs px-2 py-1 rounded-md bg-white/10 border border-white/10 hover:bg-white/15">
                  미리보기
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 h-px bg-white/10" />

          <div className="mt-4">
            <div className="text-sm font-medium mb-2">기록</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="최다 득점" value="K.주찬 (12)" />
              <Stat label="최다 도움" value="김동우 (6)" />
              <Stat label="무실점" value="조현우 (6)" />
              <Stat label="연승" value="수원 (4)" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  right,
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

function FormPills({ seq }: { seq: ("W" | "D" | "L")[] }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      {seq.map((s, i) => (
        <span
          key={i}
          className={`px-2 py-0.5 rounded-md text-[11px] border ${
            s === "W"
              ? "bg-emerald-500/20 border-emerald-400/40"
              : s === "D"
              ? "bg-yellow-500/20 border-yellow-400/40"
              : "bg-rose-500/20 border-rose-400/40"
          }`}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="opacity-70">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
