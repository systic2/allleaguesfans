import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayersByTeam } from "../lib/api";
import type { Player } from "../lib/types";
import { Shield, CalendarDays, Users2 } from "lucide-react";

export default function TeamPage() {
  const { teamId = "" } = useParams();
  const {
    data: players,
    isLoading,
    error,
  } = useQuery<Player[], Error>({
    queryKey: ["players", teamId],
    queryFn: () => fetchPlayersByTeam(teamId),
    enabled: !!teamId,
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg grid place-items-center bg-blue-500/30 ring-1 ring-inset ring-blue-400/40">
          <Shield className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">팀 홈</div>
          <div className="text-xs opacity-70">클럽 정보 · 라인업 · 일정</div>
        </div>
      </div>

      {/* 상단 2열: 라인업 / 팀 요약 */}
      <div className="grid xl:grid-cols-[3fr_2fr] gap-4">
        <Card
          title="전술 / 라인업"
          right={<span className="text-xs opacity-70">4-2-3-1</span>}
        >
          <Pitch
            players={(players ?? [])
              .slice(0, 11)
              .map((p, i) => ({ label: p.position || "PL", order: i }))}
          />
        </Card>

        <Card title="팀 요약">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <KeyVal k="감독" v="—" />
            <KeyVal k="구단 가치" v="—" />
            <KeyVal k="스폰서" v="—" />
            <KeyVal k="스타디움" v={players?.[0]?.team_name ?? "—"} />
            <KeyVal k="리그" v="—" />
            <KeyVal k="연봉 총액" v="—" />
          </div>

          <div className="mt-4 h-px bg-white/10" />
          <div className="mt-4">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <CalendarDays className="size-4" /> 다가오는 경기
            </div>
            <ul className="text-sm space-y-2">
              {[
                { d: "08.31", vs: "Jeonbuk", h: true },
                { d: "09.03", vs: "Pohang", h: false },
                { d: "09.10", vs: "Ulsan", h: true },
              ].map((f, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="opacity-80">{f.d}</span>
                  <span className="font-medium">
                    {f.h ? "vs" : "@"} {f.vs}
                  </span>
                  <button className="text-xs px-2 py-1 rounded-md bg-white/10 border border-white/10 hover:bg-white/15">
                    미리보기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* 하단: 선수단 미리보기 테이블 */}
      <Card title="선수단">
        {isLoading && <div className="opacity-80 text-sm">로딩…</div>}
        {error && (
          <div className="text-red-400 text-sm">에러: {error.message}</div>
        )}
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-70">
                <th className="py-2 pr-2">선수</th>
                <th className="py-2 pr-2">포지션</th>
                <th className="py-2 pr-2">나이</th>
                <th className="py-2 pr-2">국적</th>
                <th className="py-2 pr-2 text-right">프로필</th>
              </tr>
            </thead>
            <tbody className="align-middle">
              {(players ?? []).map((p) => (
                <tr key={p.id} className="border-t border-white/10">
                  <td className="py-2 pr-2 font-medium">{p.name}</td>
                  <td className="py-2 pr-2 opacity-80">{p.position ?? "—"}</td>
                  <td className="py-2 pr-2 opacity-80">{p.age ?? "—"}</td>
                  <td className="py-2 pr-2 opacity-80">
                    {p.nationality ?? "—"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Link
                      to={`/players/${p.id}`}
                      className="text-xs px-2 py-1 rounded-md bg-white/10 border border-white/10 hover:bg-white/15"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
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
function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="opacity-70">{k}</div>
      <div className="font-semibold mt-0.5">{v}</div>
    </div>
  );
}

// 간단 피치 표시 (11명 배치)
function Pitch({ players }: { players: { label: string; order: number }[] }) {
  // 고정 4-2-3-1 좌표
  const coords = [
    { x: 50, y: 94 },
    { x: 82, y: 76 },
    { x: 66, y: 78 },
    { x: 34, y: 78 },
    { x: 18, y: 76 },
    { x: 63, y: 62 },
    { x: 37, y: 62 },
    { x: 78, y: 44 },
    { x: 50, y: 40 },
    { x: 22, y: 44 },
    { x: 50, y: 24 },
  ];
  return (
    <div className="relative rounded-2xl overflow-hidden border border-lime-500/30 bg-[#0a3d11] shadow-inner min-h-[420px]">
      <PitchDecoration />
      {players.slice(0, 11).map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${coords[i].x}%`,
            top: `${coords[i].y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="grid place-items-center size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-white/20 shadow-md">
            <div className="text-[10px] font-bold">{p.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
function PitchDecoration() {
  return (
    <>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[2px] bg-lime-300/60" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-24 rounded-full border border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[68%] h-24 border border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[68%] h-24 border border-lime-300/60" />
    </>
  );
}
