import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const item = "block px-4 py-2 rounded-lg hover:bg-white/5";
  const active = "bg-white/10";
  return (
    <aside className="h-screen sticky top-0 border-r border-white/10 p-4 space-y-4">
      <div className="text-lg font-semibold">AllLeaguesFans</div>
      <nav className="text-sm text-white/80 space-y-1">
        <NavLink
          to="/"
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          홈
        </NavLink>
        <NavLink
          to="/leagues/k-league-1"
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          K League 1
        </NavLink>
        <NavLink
          to="/search?q="
          className={({ isActive }) => `${item} ${isActive ? active : ""}`}
        >
          검색
        </NavLink>
      </nav>
    </aside>
  );
}
