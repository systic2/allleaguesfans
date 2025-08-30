import { useQuery } from "@tanstack/react-query";
import { fetchLeagues } from "../../lib/api";
import { NavLink } from "react-router-dom";
import { Trophy } from "lucide-react";

export default function Sidebar() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: fetchLeagues,
  });

  return (
    <aside
      className="w-72 h-svh sticky top-0 border-r border-white/10 p-4
                      backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/3 dark:bg-black/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="size-5 text-blue-400" />
        <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">
          리그
        </h2>
      </div>

      {isLoading && <div className="text-sm opacity-70">불러오는 중…</div>}
      {error && <div className="text-sm text-red-400">리그 로드 실패</div>}

      <nav className="space-y-1 overflow-y-auto pr-1 max-h-[calc(100vh-5.5rem)]">
        {data?.map((l) => (
          <NavLink
            key={l.id}
            to={`/leagues/${l.id}`}
            className={({ isActive }) =>
              [
                "block rounded-xl px-3 py-2 text-sm transition",
                "hover:bg-white/10",
                isActive
                  ? "bg-blue-500/20 ring-1 ring-inset ring-blue-400 text-blue-200"
                  : "text-gray-200",
              ].join(" ")
            }
          >
            {l.name}{" "}
            {l.country ? (
              <span className="opacity-60">({l.country})</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
