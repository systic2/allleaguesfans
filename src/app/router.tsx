import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "@/app/layout/RootLayout";

const LeagueListPage = lazy(() => import("@/pages/LeagueListPage"));
const LeaguePage = lazy(() => import("@/pages/LeaguePage"));
const TeamPage = lazy(() => import("@/pages/TeamPage"));
const PlayerPage = lazy(() => import("@/pages/PlayerPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));

function Fallback() {
  return <div className="p-6 text-white/70">로딩중…</div>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<Fallback />}>
        <RootLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: <LeagueListPage /> },

      // 리그 목록은 LeagueListPage로 고정
      { path: "leagues", element: <LeagueListPage /> },

      // 리그 상세
      { path: "leagues/:slug", element: <LeaguePage /> },

      // 팀 / 선수
      { path: "teams/:id", element: <TeamPage /> },
      { path: "players/:id", element: <PlayerPage /> },

      // 검색
      { path: "search", element: <SearchPage /> },
    ],
  },
  { path: "*", element: <div className="p-6">페이지를 찾을 수 없습니다.</div> },
]);

export default router;
