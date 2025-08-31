import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { searchByName } from "../../lib/api";
import type { SearchRow } from "../../lib/types";

// 입력 디바운스
function useDebouncedValue(value: string, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dq = useDebouncedValue(q, 200);
  const nav = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<SearchRow[], Error>({
    queryKey: ["global-search", dq],
    queryFn: () => searchByName(dq),
    enabled: open && dq.trim().length > 0,
  });

  // 바깥 클릭/키보드 핸들링
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        (document.activeElement as HTMLElement)?.blur();
      }
      if (!open || !data?.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, data.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        const item = data[active];
        if (item) handleSelect(item);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, data, active]);

  function handleSelect(r: SearchRow) {
    const to =
      r.type === "team" ? `/teams/${r.entity_id}` : `/players/${r.entity_id}`;
    setOpen(false);
    setQ("");
    nav(to);
  }

  return (
    <div ref={boxRef} className="relative w-full">
      {/* 상단 전체 검색바 */}
      <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-4 py-2 shadow-sm">
        <Search className="size-4 opacity-70" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          placeholder="선수/팀/리그 검색…"
          className="w-full bg-transparent outline-none placeholder:opacity-60"
        />
        {q && (
          <button
            aria-label="clear"
            onClick={() => {
              setQ("");
              setActive(0);
            }}
            className="opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 드롭다운 결과 */}
      {open && dq.trim() && (
        <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-black/80 backdrop-blur shadow-2xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-3 text-sm opacity-70">검색 중…</div>
          ) : data && data.length > 0 ? (
            <ul role="listbox" className="max-h-[60vh] overflow-auto">
              {data.map((r, idx) => (
                <li key={`${r.type}-${r.entity_id}`}>
                  <button
                    role="option"
                    aria-selected={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => handleSelect(r)}
                    className={[
                      "w-full text-left px-4 py-2 text-sm transition flex items-center gap-2",
                      active === idx ? "bg-white/10" : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded border border-white/20 opacity-80">
                      {r.type}
                    </span>
                    <span className="truncate">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm opacity-70">
              검색 결과가 없습니다.
            </div>
          )}
          <div className="border-t border-white/10">
            <button
              onClick={() => {
                setOpen(false);
                nav(`/search?q=${encodeURIComponent(q)}`);
              }}
              className="w-full text-left px-4 py-2 text-xs opacity-80 hover:bg-white/5"
            >
              “{q}” 전체 결과 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
