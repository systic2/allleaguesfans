// src/app/router.tsx
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "@/app/layout/RootLayout";
import SasInspiredDashboard from "@/pages/SasInspiredDashboard";
import LeagueListPage from "@/pages/LeagueListPage";
import LeaguePage from "@/pages/LeaguePage";
import TeamPage from "@/pages/TeamPage";
import PlayerPage from "@/pages/PlayerPage";
import SearchPage from "@/pages/SearchPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <SasInspiredDashboard /> }, // ✅ 홈을 대시보드로
      { path: "dashboard", element: <SasInspiredDashboard /> }, // 직접 URL 접근용
      { path: "leagues", element: <LeagueListPage /> },
      { path: "leagues/:leagueId", element: <LeaguePage /> },
      { path: "teams/:teamId", element: <TeamPage /> },
      { path: "players/:playerId", element: <PlayerPage /> },
      { path: "search", element: <SearchPage /> },
    ],
  },
]);
