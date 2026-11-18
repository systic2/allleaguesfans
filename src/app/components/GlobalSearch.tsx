import { useEffect, useCallback, useId, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { searchByName } from "@/lib/api";
import type { SearchRow } from "@/domain/types";
import {
  MIN_AUTO_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS, SEARCH_SCOPE_TEXT,
  groupSearchRows, playerIdentity, searchResultHref,
} from "@/lib/search";
import { useTeamName } from "@/hooks/useTeamName";

// 입력 중인 칸에서는 '/' 를 단축키로 가로채지 않는다
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 한글 조합 중에 누른 Enter (Chrome 등) — 조합이 끝나면 처리한다
  const pendingEnterRef = useRef(false);
  const navigate = useNavigate();
  const listId = useId();

  // 한글 2벌식은 마지막 글자를 다음 키까지 '조합 중'으로 두므로, 조합 중인 글자까지 포함한 입력값으로 찾는다
  const typed = q.trim();
  const dq = useDebounced(typed, SEARCH_DEBOUNCE_MS);
  // 디바운스가 끝나기 전에는 화면의 결과가 이전 입력의 것이다
  const settled = dq === typed;
  const autoSearch = typed.length >= MIN_AUTO_SEARCH_LENGTH && dq.length >= MIN_AUTO_SEARCH_LENGTH;

  const { data, isFetching, isError } = useQuery<SearchRow[]>({
    queryKey: ["global-search", dq],
    queryFn: () => searchByName(dq),
    enabled: autoSearch,
  });

  const groups = useMemo(() => (autoSearch && data ? groupSearchRows(data, dq) : []), [autoSearch, data, dq]);
  const options = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // 결과가 바뀌면 선택을 풀어 Enter 가 검색 페이지로 가게 한다
  useEffect(() => setActive(-1), [options]);

  // 키보드로 고른 항목이 목록 밖에 있으면 보이게 스크롤
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
    pendingEnterRef.current = false;
  }, []);

  const reset = useCallback(() => {
    close();
    setQ("");
  }, [close]);

  const handleSelect = useCallback((row: SearchRow) => {
    reset();
    navigate(searchResultHref(row));
  }, [navigate, reset]);

  // Enter: 지금 입력과 맞는 결과에서 고른 항목이 있으면 그 상세로, 없으면 검색 페이지로
  const submit = useCallback((value: string) => {
    const row = settled && open ? options[active] : undefined;
    if (row) {
      handleSelect(row);
      return;
    }
    const query = value.trim();
    if (!query) return;
    reset();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }, [settled, open, options, active, handleSelect, reset, navigate]);

  // '/' 또는 Ctrl+K(⌘K) 로 검색창에 포커스
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isSlash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target);
      const isCmdK = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k";
      if (!isSlash && !isCmdK) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    }
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, [close]);

  const listVisible = open && typed.length >= MIN_AUTO_SEARCH_LENGTH && groups.length > 0;

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) {
      // 조합을 확정하는 Enter 는 조합이 끝난 뒤(compositionend) 한 번만 처리한다
      if (e.key === "Enter") pendingEnterRef.current = true;
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!settled || options.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0)));
    } else if (e.key === "Enter") {
      // Safari 는 조합을 끝낸 뒤 keyCode 229 로 Enter 를 보낸다 — 다른 브라우저와 같이 확정+검색 한 번으로 처리
      e.preventDefault();
      submit(e.currentTarget.value);
    } else if (e.key === "Escape") {
      // type="search" 의 Esc 기본 동작(입력 지우기)은 막고 목록만 닫는다
      e.preventDefault();
      close();
    }
  }

  const visible = open && typed.length > 0;
  const activeId = listVisible && active >= 0 ? `${listId}-opt-${active}` : undefined;
  let optionIndex = -1;

  return (
    <div
      ref={boxRef}
      className="relative w-full"
      onBlur={(e) => {
        // Tab 등으로 포커스가 검색 영역 밖으로 나가면 닫는다
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="리그·팀·선수 검색"
        aria-expanded={listVisible}
        aria-controls={listVisible ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        // 이전 조합에서 남은 Enter 가 새 조합 끝에 실행되지 않게 한다
        onCompositionStart={() => { pendingEnterRef.current = false; }}
        onCompositionEnd={(e) => {
          if (!pendingEnterRef.current) return;
          pendingEnterRef.current = false;
          submit(e.currentTarget.value);
        }}
        onKeyDown={onInputKeyDown}
        placeholder="리그/팀/선수 검색 ( / )"
        className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none transition-colors"
      />
      {visible && (
        <div className="absolute z-30 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-lg border border-line bg-panel p-2 shadow-xl">
          {typed.length < MIN_AUTO_SEARCH_LENGTH ? (
            <p className="p-2 text-sm text-ink/60">{MIN_AUTO_SEARCH_LENGTH}글자부터 자동으로 찾습니다. Enter 를 누르면 지금 검색합니다.</p>
          ) : groups.length > 0 ? (
            <div
              id={listId}
              role="listbox"
              aria-label="검색 결과"
              aria-busy={!settled || isFetching}
              aria-disabled={!settled}
              className={settled ? "" : "pointer-events-none opacity-60"}
            >
              {groups.map((group) => (
                <div key={group.type} role="group" aria-label={group.label} className="mb-1 last:mb-0">
                  <div className="px-2 pb-1 pt-2 text-xs font-bold text-ink/40">{group.label}</div>
                  {group.rows.map((row) => {
                    optionIndex += 1;
                    const idx = optionIndex;
                    return (
                      <div
                        key={`${row.type}-${searchResultHref(row)}-${idx}`}
                        id={`${listId}-opt-${idx}`}
                        role="option"
                        aria-selected={idx === active}
                        className={`flex min-h-11 cursor-pointer items-center rounded-md px-2 ${idx === active ? "bg-raised" : "hover:bg-raised"}`}
                        // 클릭 전에 입력창 포커스가 빠져 목록이 닫히지 않게 한다
                        onMouseDown={(e) => e.preventDefault()}
                        // 디바운스 중에 흐리게 남은 이전 결과는 고를 수 없다
                        onMouseEnter={() => { if (settled) setActive(idx); }}
                        onClick={() => { if (settled) handleSelect(row); }}
                      >
                        <SearchResultRow row={row} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : !settled || isFetching ? (
            <p className="p-2 text-sm text-ink/60">검색 중…</p>
          ) : isError ? (
            <p className="p-2 text-sm text-loss">검색하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          ) : (
            <div className="p-2 text-sm text-ink/60">
              <p className="text-ink">검색 결과 없음</p>
              <p className="mt-1">{SEARCH_SCOPE_TEXT} 다른 검색어를 입력해 보세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchResultRow({ row }: { row: SearchRow }) {
  const teamName = useTeamName();
  if (row.type === "league") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-ink">{row.name}</span>
        {row.country && <span className="shrink-0 text-xs text-ink/50">{row.country}</span>}
      </span>
    );
  }
  if (row.type === "team") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        {row.crest_url && <img src={row.crest_url} alt="" className="h-5 w-5 shrink-0 object-contain" />}
        <span className="truncate text-ink">{row.name}</span>
        {row.name_en && <span className="truncate text-xs text-ink/50">{row.name_en}</span>}
      </span>
    );
  }
  // strTeam 이 비어 있어도 팀 ID 로 한글 이름을 찾는다
  const teamLabel = row.team_id || row.team_name ? teamName(row.team_id, row.team_name ?? "") || null : null;
  const identity = playerIdentity(row, teamLabel);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-xs text-ink/60">
        {row.crest_url ? <img src={row.crest_url} alt="" className="h-full w-full object-cover" /> : row.name.slice(0, 1)}
      </span>
      <span className="truncate text-ink">{row.name}</span>
      {identity && <span className="truncate text-xs text-ink/50">{identity}</span>}
    </span>
  );
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
