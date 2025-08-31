import { useMemo } from "react";
import {
  Trophy,
  CalendarDays,
  Users2,
  ShieldHalf,
  ChevronRight,
  Target,
  Activity,
  HeartPulse,
  Dumbbell,
  ChevronDown,
} from "lucide-react";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

// 🔰 참고: 이 페이지는 FM24 'SAS' 스킨의 패널 구성을 웹으로 재해석한 레이아웃 샘플입니다.
// - 좌측: 전술/라인업 (피치 + 벤치)
// - 우측: 선수단 표 (컨디션/기여도/모랄 등 요약)
// - 하단: 순위표/최근 폼/다가오는 일정 미니 패널
// 실제 데이터 연동 전까지는 목업 데이터를 사용합니다.

export default function SasInspiredDashboard() {
  useDocumentTitle("대시보드");
  return (
    <div className="space-y-4">
      <HeaderBar />
      <TabBar />

      {/* 메인 그리드 */}
      <div className="grid xl:grid-cols-[3fr_2fr] gap-4">
        <TacticsPanel />
        <SquadPanel />
      </div>

      {/* 하단 패널 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <StandingsMini />
        <FormMini />
        <FixturesMini />
      </div>
    </div>
  );
}

function Card(props: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20 shadow-xl ${
        props.className ?? ""
      }`}
    >
      {(props.title || props.right) && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold tracking-tight">{props.title}</h3>
          {props.right}
        </header>
      )}
      <div className="p-4">{props.children}</div>
    </section>
  );
}

function HeaderBar() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20 shadow-xl p-4 flex items-center gap-4">
      <div className="size-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 grid place-items-center font-extrabold">
        ALFS
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold leading-tight">Seoul City FC</div>
        <div className="text-xs opacity-70">
          K League 1 · 1위 · 승 18 무 4 패 3 · 득실 +27
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <QuickStat
          icon={<Trophy className="size-4" />}
          label="우승 확률"
          value="42%"
        />
        <QuickStat
          icon={<Users2 className="size-4" />}
          label="연봉 총액"
          value="€45M"
        />
        <QuickStat
          icon={<Target className="size-4" />}
          label="포메이션"
          value="4-2-3-1"
        />
        <button className="rounded-xl bg-blue-500/90 hover:bg-blue-500 text-white px-3 py-2 text-sm inline-flex items-center gap-2">
          경기 준비 <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2 text-xs opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold -mt-0.5">{value}</div>
    </div>
  );
}

function TabBar() {
  const tabs = ["개요", "선수단", "전술", "일정", "스카우팅", "분석"];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20 shadow-xl px-2">
      <div className="flex items-center overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm rounded-xl m-1 whitespace-nowrap ${
              i === 2
                ? "bg-blue-500/20 ring-1 ring-inset ring-blue-400 text-blue-200"
                : "hover:bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto px-2 text-xs opacity-70 flex items-center gap-2">
          <span>시즌: 2025</span>
          <ChevronDown className="size-3" />
        </div>
      </div>
    </div>
  );
}

function TacticsPanel() {
  // 피치 좌표(%) – 4-2-3-1 기본
  const positions = useMemo(
    () => [
      { name: "GK", x: 50, y: 94 },
      { name: "RB", x: 82, y: 76 },
      { name: "RCB", x: 66, y: 78 },
      { name: "LCB", x: 34, y: 78 },
      { name: "LB", x: 18, y: 76 },
      { name: "DMR", x: 63, y: 62 },
      { name: "DML", x: 37, y: 62 },
      { name: "AMR", x: 78, y: 44 },
      { name: "AMC", x: 50, y: 40 },
      { name: "AML", x: 22, y: 44 },
      { name: "ST", x: 50, y: 24 },
    ],
    []
  );

  const bench = ["GK", "DF", "DF", "MF", "MF", "WF", "ST"];

  return (
    <Card
      title="전술 / 라인업"
      right={<div className="text-xs opacity-70">4-2-3-1 · 균형</div>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* 피치 */}
        <div className="relative rounded-2xl overflow-hidden border border-lime-500/30 bg-[#0a3d11] shadow-inner min-h-[520px]">
          <PitchDecoration />
          {positions.map((p, idx) => (
            <PlayerDot
              key={idx}
              label={p.name}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          ))}
        </div>

        {/* 팀 지시/요약 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-medium mb-2">팀 지시</div>
            <ul className="text-xs space-y-1 opacity-90">
              <li>빌드업: 후방에서 짧게</li>
              <li>프레스: 중간 블록</li>
              <li>템포: 보통 · 폭: 좁게</li>
              <li>수비 라인: 보통 · 트랩: 해제</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 gap-2">
            <MiniBar
              label="컨디션"
              value={86}
              icon={<HeartPulse className="size-4" />}
            />
            <MiniBar
              label="매치 피트니스"
              value={72}
              icon={<Activity className="size-4" />}
            />
            <MiniBar
              label="훈련 강도"
              value={64}
              icon={<Dumbbell className="size-4" />}
            />
            <MiniBar
              label="사기"
              value={91}
              icon={<ShieldHalf className="size-4" />}
            />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <CalendarDays className="size-4" /> 다음 경기
            </div>
            <div className="text-xs opacity-90">
              8월 31일(토) · vs Jeonbuk (H) · FA Cup 8강
            </div>
          </div>
        </div>
      </div>

      {/* 벤치 */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-medium mb-2">교체 명단</div>
        <div className="flex flex-wrap gap-2">
          {bench.map((b, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-lg bg-white/10 text-xs border border-white/10"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PitchDecoration() {
  return (
    <>
      {/* 중앙선/서클 */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[2px] bg-lime-300/60" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-28 rounded-full border border-lime-300/60" />
      {/* 박스 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[68%] h-28 border border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[68%] h-28 border border-lime-300/60" />
      {/* 페널티 아크 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[112px] w-24 h-12 rounded-b-full border-x border-b border-lime-300/60" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[112px] w-24 h-12 rounded-t-full border-x border-t border-lime-300/60" />
    </>
  );
}

function PlayerDot({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      <div className="grid place-items-center size-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border border-white/20 shadow-md">
        <div className="text-[10px] font-bold">{label}</div>
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 mb-1 opacity-80">
        {icon}
        {label}
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="mt-1 opacity-80">{value}%</div>
    </div>
  );
}

function SquadPanel() {
  const rows = [
    {
      name: "Kim Seung-gyu",
      pos: "GK",
      cond: 92,
      form: "7.14",
      morale: "좋음",
    },
    {
      name: "Kim Young-gwon",
      pos: "DC",
      cond: 86,
      form: "7.06",
      morale: "보통",
    },
    {
      name: "Lim Sang-hyub",
      pos: "DL",
      cond: 80,
      form: "6.92",
      morale: "좋음",
    },
    {
      name: "Park Yong-woo",
      pos: "DM",
      cond: 74,
      form: "7.03",
      morale: "매우 좋음",
    },
    {
      name: "Lee Kang-in",
      pos: "AMC",
      cond: 88,
      form: "7.44",
      morale: "매우 좋음",
    },
    {
      name: "Hwang Hee-chan",
      pos: "ST",
      cond: 84,
      form: "7.20",
      morale: "좋음",
    },
  ];

  return (
    <Card title="선수단">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs opacity-70">
              <th className="py-2 pr-2">선수</th>
              <th className="py-2 pr-2">포지션</th>
              <th className="py-2 pr-2 w-32">컨디션</th>
              <th className="py-2 pr-2">최근 폼</th>
              <th className="py-2 pr-2">사기</th>
            </tr>
          </thead>
          <tbody className="align-middle">
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-white/10">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-md bg-white/10 grid place-items-center text-[10px]">
                      {r.pos}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="py-2 pr-2 opacity-80">{r.pos}</td>
                <td className="py-2 pr-2">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden w-32">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      style={{ width: `${r.cond}%` }}
                    />
                  </div>
                </td>
                <td className="py-2 pr-2 opacity-80">{r.form}</td>
                <td className="py-2 pr-2 opacity-80">{r.morale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StandingsMini() {
  const rows = [
    { t: 1, team: "Seoul City", pts: 59 },
    { t: 2, team: "Jeonbuk", pts: 56 },
    { t: 3, team: "Ulsan", pts: 52 },
    { t: 4, team: "Pohang", pts: 49 },
    { t: 5, team: "Daegu", pts: 44 },
  ];
  return (
    <Card title="리그 순위">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs opacity-70">
            <th className="py-1">#</th>
            <th className="py-1">팀</th>
            <th className="py-1 text-right">승점</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.t} className="border-t border-white/10">
              <td className="py-1">{r.t}</td>
              <td className="py-1">{r.team}</td>
              <td className="py-1 text-right font-medium">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function FormMini() {
  const forms = ["W", "D", "W", "W", "L"];
  return (
    <Card title="최근 폼">
      <div className="flex items-center gap-2">
        {forms.map((f, i) => (
          <span
            key={i}
            className={`px-3 py-1 rounded-lg border text-xs ${
              f === "W"
                ? "bg-emerald-500/20 border-emerald-400/40"
                : f === "D"
                ? "bg-yellow-500/20 border-yellow-400/40"
                : "bg-rose-500/20 border-rose-400/40"
            }`}
          >
            {f}
          </span>
        ))}
      </div>
    </Card>
  );
}

function FixturesMini() {
  const fixtures = [
    { d: "08.31", vs: "Jeonbuk", h: true },
    { d: "09.03", vs: "Pohang", h: false },
    { d: "09.10", vs: "Ulsan", h: true },
  ];
  return (
    <Card title="다가오는 일정">
      <ul className="text-sm space-y-2">
        {fixtures.map((f, i) => (
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
    </Card>
  );
}
