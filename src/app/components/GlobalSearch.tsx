// app/components/GlobalSearch.tsx
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

/** 안전한 키/타입 접근을 위한 헬퍼들 */
type AnyRow = Record<string, unknown>;
const has = <K extends string>(
  o: AnyRow,
  k: K
): o is AnyRow & Record<K, unknown> => k in o;

function rowKind(r: AnyRow): "league" | "team" | "player" {
  if (has(r, "kind") && typeof r.kind === "string") {
    const v = r.kind.toLowerCase();
    if (v === "league" || v === "team" || v === "player") return v;
  }
  if (has(r, "type") && typeof r.type === "string") {
    const v = r.type.toLowerCase();
    if (v === "league" || v === "team" || v === "player") return v;
  }
  // 기본값(과거 데이터 호환)
  return "team";
}

function leagueSlug(r: AnyRow): string | undefined {
  if (has(r, "slug") && typeof r.slug === "string" && r.slug) return r.slug;
  return undefined;
}

function teamId(r: AnyRow): string | undefined {
  if (has(r, "team_id") && typeof r.team_id === "string" && r.team_id)
    return r.team_id;
  if (has(r, "id") && typeof r.id === "string" && r.id) return r.id; // 신 스키마(team row의 id)
  if (has(r, "entity_id") && typeof r.entity_id === "string" && r.entity_id)
    return r.entity_id; // 구 스키마
  return undefined;
}

function playerId(r: AnyRow): string | undefined {
  if (has(r, "id") && typeof r.id === "string" && r.id) return r.id;
  if (has(r, "entity_id") && typeof r.entity_id === "string" && r.entity_id)
    return r.entity_id;
  return undefined;
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
        const item = data[active] as unknown as AnyRow;
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

  function handleSelect(row: AnyRow) {
    const kind = rowKind(row);

    if (kind === "league") {
      const slug = leagueSlug(row);
      setOpen(false);
      setQ("");
      nav(slug ? `/leagues/${slug}` : `/leagues`);
      return;
    }

    if (kind === "team") {
      const id = teamId(row);
      setOpen(false);
      setQ("");
      if (id) nav(`/teams/${id}`);
      else nav(`/teams`); // 안전 폴백
      return;
    }

    // player
    const pid = playerId(row);
    setOpen(false);
    setQ("");
    if (pid) nav(`/players/${pid}`);
    else nav(`/players`);
  }

  function renderKindTag(row: AnyRow) {
    const kind = rowKind(row);
    const label = kind === "league" ? "리그" : kind === "team" ? "팀" : "선수";
    return (
      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded border border-white/20 opacity-80">
        {label}
      </span>
    );
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
              {data.map((raw, idx) => {
                const r = raw as unknown as AnyRow;
                const isActive = active === idx;
                return (
                  <li key={idx}>
                    <button
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => handleSelect(r)}
                      className={[
                        "w-full text-left px-4 py-2 text-sm transition flex items-center gap-2",
                        isActive ? "bg-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      {renderKindTag(r)}
                      <span className="truncate">
                        {has(r, "name") && typeof r.name === "string"
                          ? r.name
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
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
                // 필요시 /search 라우트 구현에 맞게 조정
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
