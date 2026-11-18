import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "@/app/layout/RootLayout";
import NotFound from "@/app/components/NotFound";

const LeagueListPage = lazy(() => import("@/pages/LeagueListPage"));
const LeaguePage = lazy(() => import("@/pages/LeaguePage"));
const TeamPage = lazy(() => import("@/pages/TeamPageDB")); // Using new DB-based version
const PlayerPage = lazy(() => import("@/pages/PlayerPage"));
const MatchPage = lazy(() => import("@/pages/MatchPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const TeamsPage = lazy(() => import("@/pages/TeamsPage"));
const PlayersPage = lazy(() => import("@/pages/PlayersPage"));
const MatchesPage = lazy(() => import("@/pages/MatchesPage"));
const FavoritesPage = lazy(() => import("@/pages/FavoritesPage"));

const router = createBrowserRouter([
  {
    path: "/",
    // 지연 로딩 중에도 사이드바·상단 바가 남도록 Suspense 는 RootLayout 안(Outlet 주변)에 둔다
    element: <RootLayout />,
    children: [
      { index: true, element: <LeagueListPage /> },

      // 리그 목록은 LeagueListPage로 고정
      { path: "leagues", element: <LeagueListPage /> },

      // 리그 상세
      { path: "leagues/:slug", element: <LeaguePage /> },

      // 팀 / 선수 / 경기
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:id", element: <TeamPage /> },
      { path: "players", element: <PlayersPage /> },
      { path: "players/:id", element: <PlayerPage /> },
      { path: "matches", element: <MatchesPage /> },
      { path: "matches/:id", element: <MatchPage /> },

      // 검색
      { path: "search", element: <SearchPage /> },
      { path: "favorites", element: <FavoritesPage /> },

      // 없는 주소도 사이드바·검색이 있는 레이아웃 안에서 보여준다
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default router;
