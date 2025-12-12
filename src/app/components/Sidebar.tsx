import { NavLink, useMatch } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, BarChart3, Trophy } from "lucide-react";

export default function Sidebar() {
  const item = "flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors";
  const active = "bg-white/10 text-white font-medium";
  
  // Check if we are on a team page
  const teamMatch = useMatch("/teams/:id");
  const teamId = teamMatch?.params.id;

  return (
    <aside className="h-screen sticky top-0 border-r border-white/10 p-4 space-y-6 overflow-y-auto">
      <div className="px-2">
        <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          AllLeaguesFans
        </div>
      </div>

      <nav className="text-sm text-white/70 space-y-1">
        <div className="px-4 text-xs font-bold text-white/40 uppercase mb-2">Main</div>
        <NavLink
          to="/"
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          <LayoutDashboard className="w-4 h-4" />
          홈
        </NavLink>
        <NavLink
          to="/leagues/k-league-1"
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          <Trophy className="w-4 h-4" />
          K League 1
        </NavLink>
        <NavLink
          to="/leagues/k-league-2"
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          <Trophy className="w-4 h-4" />
          K League 2
        </NavLink>
      </nav>

      {teamId && (
        <nav className="text-sm text-white/70 space-y-1 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="px-4 text-xs font-bold text-white/40 uppercase mb-2 mt-6">Team Menu</div>
          <NavLink
            to={`/teams/${teamId}?tab=overview`}
            end
            className={({ isActive, isPending }) => {
              // Custom active logic for query params since NavLink defaults to path matching
              const search = new URLSearchParams(window.location.search);
              const tab = search.get("tab");
              const isOverview = !tab || tab === "overview";
              return `${item} ${isOverview ? active : ""}`;
            }}
          >
            <LayoutDashboard className="w-4 h-4" />
            개요 (Overview)
          </NavLink>
          <NavLink
            to={`/teams/${teamId}?tab=squad`}
            className={({ isActive }) => {
               const search = new URLSearchParams(window.location.search);
               return `${item} ${search.get("tab") === "squad" ? active : ""}`;
            }}
          >
            <Users className="w-4 h-4" />
            선수단 (Squad)
          </NavLink>
          <NavLink
            to={`/teams/${teamId}?tab=fixtures`}
            className={({ isActive }) => {
               const search = new URLSearchParams(window.location.search);
               return `${item} ${search.get("tab") === "fixtures" ? active : ""}`;
            }}
          >
            <Calendar className="w-4 h-4" />
            일정 (Fixtures)
          </NavLink>
          <NavLink
            to={`/teams/${teamId}?tab=stats`}
            className={({ isActive }) => {
               const search = new URLSearchParams(window.location.search);
               return `${item} ${search.get("tab") === "stats" ? active : ""}`;
            }}
          >
            <BarChart3 className="w-4 h-4" />
            통계 (Stats)
          </NavLink>
        </nav>
      )}
    </aside>
  );
}
