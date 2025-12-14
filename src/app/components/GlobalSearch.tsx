import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchByName } from "@/lib/api";

/**
 * 검색 행을 컴포넌트 지역에서 상위 호환 타입으로 선언
 * - 백엔드/공용 타입의 세부 필드 차이를 흡수
 */
type GSRow = {
  type: "league" | "team" | "player";
  entity_id: number;
  name: string;
  // 선택 필드(존재하면 사용)
  slug?: string;
  team_id?: number;
  crest_url?: string | null;
  short_name?: string | null;
  team_name?: string | null;
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const dq = useDebounced(q, 200);

  const { data } = useQuery<GSRow[]>(
    {
      queryKey: ["global-search", dq],
      // 공용 API 결과를 상위 호환 타입으로 수용
      queryFn: async () => (await searchByName(dq)) as unknown as GSRow[],
      enabled: dq.trim().length > 0,
    }
  );

  // ❗ 빈 배열 기본값에 명시 타입 부여(never[] 방지)
  const results: GSRow[] = useMemo(() => data ?? ([] as GSRow[]), [data]);

  const handleSelect = useCallback((item: GSRow) => {
    setOpen(false);
    let href = "#";
    if (item.type === "team") href = `/teams/${item.team_id ?? item.entity_id}`;
    else if (item.type === "league") href = `/leagues/${item.slug ?? ""}`;
    else if (item.type === "player") href = `/players/${item.entity_id}`;
    window.location.assign(href);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(results[active]!);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, handleSelect]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  const visible = open && dq.trim().length > 0;

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQ(e.target.value)}
        placeholder="리그/팀/선수 검색"
        className="w-96 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none transition-colors"
      />
      {visible && (
        <div className="absolute mt-2 w-96 rounded-xl border border-white/10 bg-black/80 backdrop-blur p-2">
          {results.length === 0 ? (
            <div className="p-3 text-sm text-white/60">
              검색 결과가 없습니다.
            </div>
          ) : (
            <ul>
              {results.map((row, idx) => (
                <li
                  key={`${row.type}-${row.entity_id}-${idx}`}
                  className={`px-2 py-2 rounded-md ${
                    idx === active ? "bg-white/10" : ""
                  }`}
                  onMouseEnter={() => setActive(idx)}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => handleSelect(row)}
                  >
                    <Row row={row} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: GSRow }) {
  if (row.type === "league") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
          LEAGUE
        </span>
        <span>{row.name}</span>
        {row.slug ? <span className="text-white/40">({row.slug})</span> : null}
      </span>
    );
  }
  if (row.type === "team") {
    return (
      <span className="inline-flex items-center gap-2">
        <img
          src={row.crest_url ?? "/logo-fallback.svg"}
          alt={row.name}
          className="w-5 h-5 object-contain"
        />
        <span>{row.name}</span>
      </span>
    );
  }
  if (row.type === "player") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-700 text-xs">
          {row.crest_url ? (
            <img src={row.crest_url} alt={row.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            "👤"
          )}
        </span>
        <span>{row.name}</span>
        {row.team_name && <span className="text-white/40 text-xs">({row.team_name})</span>}
      </span>
    );
  }
  return <span>{row.name}</span>;
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
