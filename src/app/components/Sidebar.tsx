import { NavLink } from "react-router-dom";
import { CalendarDays, LayoutDashboard, Shield, Star, Trophy, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchLeagues } from "@/lib/api";
import { compareLeagueSlugs } from "@/lib/leagues";
import { useFavorites } from "@/hooks/useFavorites";
import { favoriteHref } from "@/lib/favorites";
import CrestImg from "@/app/components/CrestImg";

// 사이드바에 바로 보여 줄 즐겨찾기 수 (나머지는 /favorites)
const SIDEBAR_FAVORITES = 10;

const MAIN_MENU = [
  { to: "/", label: "홈", icon: LayoutDashboard, end: true },
  { to: "/matches", label: "경기", icon: CalendarDays, end: false },
  { to: "/teams", label: "팀", icon: Shield, end: false },
  { to: "/players", label: "선수", icon: User, end: false },
  { to: "/favorites", label: "즐겨찾기", icon: Star, end: false },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const item = "flex min-h-11 items-center gap-3 px-3 rounded-md text-ink/70 hover:bg-raised hover:text-ink transition-colors";
  const active = "bg-raised text-ink font-medium";

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['leagues-sidebar'],
    queryFn: fetchLeagues,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const sorted = [...(leagues ?? [])].sort((a, b) => compareLeagueSlugs(a.slug, b.slug));
  const { favorites } = useFavorites();

  return (
    <aside className="h-screen sticky top-0 border-r border-line bg-panel p-3 space-y-5 overflow-y-auto">
      {/* 오른쪽 여백: 모바일 서랍의 닫기 버튼 자리 */}
      <div className="px-3 pt-1 pr-12 lg:pr-3 text-lg font-bold text-accent">AllLeaguesFans</div>

      <nav aria-label="주 메뉴" className="text-sm space-y-1">
        {MAIN_MENU.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `${item} ${isActive ? active : ""}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}

        {favorites.length > 0 && (
          <div aria-label="즐겨찾기 바로가기" role="group">
            <div className="px-3 pb-1 pt-3 text-xs font-bold text-ink/50">즐겨찾기</div>
            {favorites.slice(0, SIDEBAR_FAVORITES).map((fav) => (
              <NavLink
                key={`${fav.type}-${fav.id}`}
                to={favoriteHref(fav)}
                onClick={onNavigate}
                className={({ isActive }) => `${item} ${isActive ? active : ""}`}
              >
                <CrestImg src={fav.image} alt="" size={16} className={fav.type === "player" ? "rounded-full" : ""} />
                <span className="truncate">{fav.name}</span>
              </NavLink>
            ))}
            {favorites.length > SIDEBAR_FAVORITES && (
              <NavLink to="/favorites" onClick={onNavigate} className="flex min-h-11 items-center px-3 text-xs text-ink/50 hover:text-ink">
                {favorites.length - SIDEBAR_FAVORITES}개 더 보기
              </NavLink>
            )}
          </div>
        )}

        <NavLink
          to="/leagues"
          end
          onClick={onNavigate}
          className={({ isActive }) => `mt-3 flex min-h-11 items-center px-3 rounded-md text-xs font-bold ${isActive ? "bg-raised text-ink" : "text-ink/50 hover:bg-raised hover:text-ink"}`}
        >
          리그 전체
        </NavLink>

        {isLoading ? (
          <div className="px-3 py-2 text-xs text-ink/40">로딩중…</div>
        ) : (
          sorted.map((league) => (
            <NavLink
              key={league.slug}
              to={`/leagues/${league.slug}`}
              onClick={onNavigate}
              className={({ isActive }) => `${item} ${isActive ? active : ""}`}
            >
              {league.logo_url ? (
                <img src={league.logo_url} alt="" className="w-4 h-4 object-contain" />
              ) : (
                <Trophy className="w-4 h-4 text-ink/40" />
              )}
              <span className="truncate">{league.name_korean ?? league.name}</span>
            </NavLink>
          ))
        )}
      </nav>
    </aside>
  );
}
