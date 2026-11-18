// src/lib/search.ts
// 통합 검색 결과의 정렬·묶음·링크 (docs/prd.md 7.1). 조회는 api.ts 의 searchByName 이 맡는다.
import type { SearchRow } from "@/domain/types";

// 이 길이부터 입력하는 대로 검색한다. 더 짧으면 Enter 로 검색 페이지에서 찾는다
export const MIN_AUTO_SEARCH_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_RESULTS_PER_TYPE = 10;

export const SEARCH_SCOPE_TEXT = "리그·팀 이름(한글·영문)과 선수 영문 이름에서 찾습니다.";

const TYPE_ORDER: SearchRow["type"][] = ["league", "team", "player"];
const TYPE_LABELS: Record<SearchRow["type"], string> = { league: "리그", team: "팀", player: "선수" };

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

// 0 = 정확히 같음, 1 = 앞부분이 같음, 2 = 그 밖의 포함
function matchRank(names: (string | null | undefined)[], q: string): number {
  const nq = normalize(q);
  let best = 2;
  for (const name of names) {
    if (!name) continue;
    const n = normalize(name);
    if (n === nq) return 0;
    if (n.startsWith(nq)) best = Math.min(best, 1);
  }
  return best;
}

function namesOf(row: SearchRow): (string | null | undefined)[] {
  return row.type === "player" ? [row.name] : [row.name, row.name_en];
}

/** 유형별로 묶고, 각 묶음은 정확 일치 → 앞부분 일치 → 포함 순 (같으면 원래 순서). 묶음마다 최대 10건 */
export function groupSearchRows(rows: SearchRow[], q: string): { type: SearchRow["type"]; label: string; rows: SearchRow[] }[] {
  return TYPE_ORDER.map((type) => {
    const ofType = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.type === type)
      .sort((a, b) => matchRank(namesOf(a.row), q) - matchRank(namesOf(b.row), q) || a.index - b.index)
      .slice(0, MAX_RESULTS_PER_TYPE)
      .map(({ row }) => row);
    return { type, label: TYPE_LABELS[type], rows: ofType };
  }).filter((group) => group.rows.length > 0);
}

export function searchResultHref(row: SearchRow): string {
  if (row.type === "league") return `/leagues/${row.slug}`;
  if (row.type === "team") return `/teams/${row.team_id}`;
  return `/players/${row.entity_id}`;
}

/** 동명이인을 구분할 선수 정보: 소속 · 국적 · 출생 연도 (있는 것만) */
export function playerIdentity(row: Extract<SearchRow, { type: "player" }>, teamLabel: string | null): string {
  const birthYear = row.birth_date ? row.birth_date.slice(0, 4) : null;
  return [teamLabel, row.nationality, birthYear ? `${birthYear}년생` : null].filter(Boolean).join(" · ");
}
