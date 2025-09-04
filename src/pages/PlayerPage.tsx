import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayer } from "../lib/api";
import type { Player } from "../lib/types";
import { User2 } from "lucide-react";

type Attr = { k: string; v: number };

export default function PlayerPage() {
  const { playerId = "" } = useParams();
  const {
    data: player,
    isLoading,
    error,
  } = useQuery<Player, Error>({
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
  if (!player) return <p>선수를 찾을 수 없습니다.</p>;

  // 능력치 목업(데이터 없을 경우 6~15 범위로 가벼운 샘플)
  const tech: Attr[] = attrs([
    "개인기",
    "드리블",
    "마무리",
    "패스",
    "크로스",
    "퍼스트터치",
  ]);
  const ment: Attr[] = attrs([
    "결정력",
    "위치선정",
    "대담성",
    "예측력",
    "집중력",
    "시야",
  ]);
  const phys: Attr[] = attrs([
    "가속도",
    "속력",
    "민첩성",
    "점프",
    "체력",
    "균형",
  ]);

  return (
    <div className="space-y-4">
      {/* 헤더: 카드 + 기본 정보 */}
      <div className="grid lg:grid-cols-[2fr_3fr_2fr] gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-16 rounded-xl bg-white/10 grid place-items-center">
              <User2 className="size-8 opacity-80" />
            </div>
            <div>
              <div className="text-xl font-semibold">{player.name}</div>
              <div className="text-sm opacity-80">
                {player.position ?? "—"} · {player.nationality ?? "—"} ·{" "}
                {(() => {
                  const b = (player as any).birth_date as string | undefined;
                  if (!b) return "—";
                  const d = new Date(b);
                  if (Number.isNaN(d.getTime())) return "—";
                  const now = new Date();
                  let age = now.getFullYear() - d.getFullYear();
                  const m = now.getMonth() - d.getMonth();
                  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
                  return `${age}세`;
                })()}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mt-4">
            <KeyVal k="키" v={fmt((player as any).height_cm, "cm")} />
            <KeyVal k="몸무게" v={fmt((player as any).weight_kg, "kg")} />
            <KeyVal k="주발" v={(player as any).foot ?? "—"} />
            <KeyVal k="가치(€)" v="—" />
          </div>
        </Card>

        {/* 능력치 그리드 */}
        <Card title="능력치">
          <div className="grid md:grid-cols-3 gap-4">
            <AttrCol title="기술" data={tech} />
            <AttrCol title="정신" data={ment} />
            <AttrCol title="운동능력" data={phys} />
          </div>
        </Card>

        {/* 포지션/역할 · 간단 레이더 느낌 */}
        <Card title="포지션 / 역할">
          <SmallPitch mainPos={player.position ?? ""} />
          <div className="mt-3 text-xs opacity-80">
            주 포지션 기준 배치(참고용)
          </div>
        </Card>
      </div>

      {/* 시즌 기록(목업) */}
      <Card title="시즌 기록">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-70">
                <th className="py-2 pr-2">대회</th>
                <th className="py-2 pr-2 text-right">경기</th>
                <th className="py-2 pr-2 text-right">골</th>
                <th className="py-2 pr-2 text-right">도움</th>
                <th className="py-2 pr-2 text-right">평점</th>
              </tr>
            </thead>
            <tbody>
              {[
                { comp: "리그", gp: 18, g: 7, a: 4, r: "7.22" },
                { comp: "컵대회", gp: 4, g: 2, a: 1, r: "7.10" },
                { comp: "합계", gp: 22, g: 9, a: 5, r: "7.19" },
              ].map((r) => (
                <tr key={r.comp} className="border-t border-white/10">
                  <td className="py-2 pr-2">{r.comp}</td>
                  <td className="py-2 pr-2 text-right">{r.gp}</td>
                  <td className="py-2 pr-2 text-right">{r.g}</td>
                  <td className="py-2 pr-2 text-right">{r.a}</td>
                  <td className="py-2 pr-2 text-right">{r.r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function attrs(keys: string[]): Attr[] {
  // 간단한 결정적 수치 생성(이름 해시 기반)
  function hash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  return keys.map((k, i) => ({ k, v: 6 + (hash(k + i) % 10) })); // 6~15
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 shadow-xl p-4">
      {title && <div className="text-sm font-semibold mb-3">{title}</div>}
      {children}
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

function AttrCol({ title, data }: { title: string; data: Attr[] }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      <ul className="space-y-2">
        {data.map((a) => (
          <li key={a.k} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="opacity-80">{a.k}</span>
              <span className="font-semibold">{a.v}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                style={{ width: `${(a.v / 20) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SmallPitch({ mainPos }: { mainPos: string }) {
  const pos = (mainPos || "").toUpperCase();
  // 간단 매핑: 포지션 문자열에 따라 마커 위치 조정
  const map: Record<string, { x: number; y: number }> = {
    GK: { x: 50, y: 90 },
    DF: { x: 50, y: 70 },
    CB: { x: 50, y: 70 },
    RB: { x: 75, y: 70 },
    LB: { x: 25, y: 70 },
    DM: { x: 50, y: 58 },
    CM: { x: 50, y: 50 },
    RM: { x: 72, y: 50 },
    LM: { x: 28, y: 50 },
    AM: { x: 50, y: 38 },
    RW: { x: 75, y: 38 },
    LW: { x: 25, y: 38 },
    ST: { x: 50, y: 24 },
    FW: { x: 50, y: 24 },
  };
  const p = map[pos] || { x: 50, y: 50 };

  return (
    <div className="relative rounded-xl overflow-hidden border border-lime-500/30 bg-[#0a3d11] shadow-inner h-48">
      {/* 데코 */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[2px] bg-lime-300/60" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-16 rounded-full border border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[80%] h-16 border border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[80%] h-16 border border-lime-300/60" />

      {/* 메인 포지션 마커 */}
      <div
        className="absolute size-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-white/20 shadow"
        style={{
          left: `${p.x}%`,
          top: `${p.y}%`,
          transform: "translate(-50%, -50%)",
        }}
        title={mainPos}
      />
    </div>
  );
}

function fmt(v?: number | null, unit?: string) {
  if (v == null) return "—";
  return unit ? `${v} ${unit}` : `${v}`;
}
