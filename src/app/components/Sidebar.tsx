// src/app/components/Sidebar.tsx
import { NavLink, Link } from "react-router-dom";
import {
  Home,
  Mail,
  Users,
  Goal,
  CalendarDays,
  Trophy,
  BarChart3,
  Binoculars,
  ArrowLeftRight,
  Dumbbell,
  HeartPulse,
  Building2,
  Target,
  Wallet,
  UserCog,
  GraduationCap,
  Search,
} from "lucide-react";

type Item = {
  label: string;
  icon: React.ReactNode;
  to?: string; // 링크가 있으면 NavLink, 없으면 '준비 중'
  end?: boolean;
};

function NavItem({ item }: { item: Item }) {
  if (!item.to) {
    return (
      <div
        title="준비 중"
        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-400/80 cursor-not-allowed border border-transparent
                   hover:border-white/10"
      >
        <span className="opacity-90">{item.icon}</span>
        <span className="text-sm font-medium">{item.label}</span>
      </div>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 px-3 py-2 rounded-xl transition border border-transparent",
          "hover:bg-white/10 hover:border-white/10",
          isActive
            ? "bg-blue-500/20 ring-1 ring-inset ring-blue-400 text-blue-200"
            : "text-gray-200",
        ].join(" ")
      }
    >
      <span className="opacity-90">{item.icon}</span>
      <span className="text-sm font-medium">{item.label}</span>
    </NavLink>
  );
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="mt-4">
      <div className="px-2 text-xs uppercase opacity-60 tracking-wide mb-2">
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((it) => (
          <NavItem key={it.label} item={it} />
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar() {
  // FM24 기본 구조를 3개 섹션으로 나눔
  const primary: Item[] = [
    { label: "홈", icon: <Home className="size-4" />, to: "/", end: true },
    { label: "수신함", icon: <Mail className="size-4" /> }, // 준비 중
    { label: "선수단", icon: <Users className="size-4" /> }, // 준비 중
    { label: "전술", icon: <Goal className="size-4" />, to: "/dashboard" }, // 지금은 대시보드가 전술 패널 포함
    { label: "일정", icon: <CalendarDays className="size-4" /> }, // 준비 중
    { label: "대회", icon: <Trophy className="size-4" /> }, // 준비 중
  ];

  const operations: Item[] = [
    { label: "데이터 허브", icon: <BarChart3 className="size-4" /> }, // 준비 중
    { label: "스카우팅", icon: <Binoculars className="size-4" /> }, // 준비 중
    { label: "이적", icon: <ArrowLeftRight className="size-4" /> }, // 준비 중
    { label: "훈련", icon: <Dumbbell className="size-4" /> }, // 준비 중
    { label: "의료 센터", icon: <HeartPulse className="size-4" /> }, // 준비 중
  ];

  const club: Item[] = [
    { label: "클럽", icon: <Building2 className="size-4" /> }, // 준비 중
    { label: "구단 비전", icon: <Target className="size-4" /> }, // 준비 중
    { label: "재정", icon: <Wallet className="size-4" /> }, // 준비 중
    { label: "스태프", icon: <UserCog className="size-4" /> }, // 준비 중
    { label: "유소년(U18)", icon: <GraduationCap className="size-4" /> }, // 준비 중
  ];

  // 데이터 탐색(우리 앱 기존 기능): 리그/검색
  const dataExplore: Item[] = [
    { label: "리그", icon: <Trophy className="size-4" />, to: "/leagues" },
    { label: "검색", icon: <Search className="size-4" />, to: "/search" },
  ];

  return (
    <aside
      className="w-72 h-svh sticky top-0 border-r border-white/10 p-4
                 bg-white/5 supports-[backdrop-filter]:backdrop-blur shadow-xl"
    >
      {/* 브랜드 헤더: 로고 + 타이틀 */}
      <Link
        to="/"
        className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-white/10"
        aria-label="All Leagues Fans 홈"
      >
        <img
          src="/android-chrome-192x192.png"
          alt="All Leagues Fans 로고"
          className="size-8 rounded-lg"
        />
        <span className="text-lg font-bold tracking-tight">
          All Leagues Fans
        </span>
      </Link>

      <Section title="메인" items={primary} />
      <Section title="운영" items={operations} />
      <Section title="클럽" items={club} />
      <Section title="데이터 탐색" items={dataExplore} />
    </aside>
  );
}
