import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchByName } from "../../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useMemo(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function SearchBox() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const { data } = useQuery({
    queryKey: ["search", dq],
    queryFn: () => searchByName(dq),
    enabled: dq.length > 0,
  });
  const nav = useNavigate();

  return (
    <div className="relative w-full max-w-lg">
      <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 shadow-sm">
        <Search className="size-4 opacity-70" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="팀/선수 검색…"
          className="w-full bg-transparent outline-none placeholder:opacity-60"
        />
      </div>

      {dq && data && data.length > 0 && (
        <div className="absolute mt-2 w-full rounded-2xl border border-white/10 bg-black/70 backdrop-blur shadow-xl overflow-hidden">
          {data.map((r) => {
            const href =
              r.type === "team"
                ? `/teams/${r.entity_id}`
                : `/players/${r.entity_id}`;
            return (
              <Link
                key={`${r.type}-${r.entity_id}`}
                to={href}
                className="block px-3 py-2 hover:bg-white/10 text-sm"
              >
                <span className="uppercase text-[10px] mr-2 opacity-60">
                  {r.type}
                </span>
                {r.name}
              </Link>
            );
          })}
          <button
            onClick={() => nav(`/search?q=${encodeURIComponent(q)}`)}
            className="block w-full text-left px-3 py-2 text-xs opacity-70 hover:bg-white/10"
          >
            “{q}” 전체 결과 보기
          </button>
        </div>
      )}
    </div>
  );
}
