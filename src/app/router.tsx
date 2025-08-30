import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layout/RootLayout";
import LeaguesPage from "../pages/LeaguesPage";
import LeaguePage from "../pages/LeaguePage";
import TeamPage from "../pages/TeamPage";
import PlayerPage from "../pages/PlayerPage";
import SearchPage from "../pages/SearchPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <LeaguesPage /> },
      { path: "leagues/:leagueId", element: <LeaguePage /> },
      { path: "teams/:teamId", element: <TeamPage /> },
      { path: "players/:playerId", element: <PlayerPage /> },
      { path: "search", element: <SearchPage /> },
    ],
  },
]);
