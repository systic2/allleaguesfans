// src/lib/squad.ts
// 팀 선수단 표·선수 시즌 기록 표의 정렬과 표시 규칙 (docs/prd.md TEAM-02·03, PLAYER-02·05, 8.1)

import { ageOn, kstDate } from "@/lib/dates";
import { positionGroupOf, POSITION_GROUPS, type PositionGroup } from "@/lib/positions";
import { currentRoster } from "@/lib/roster-snapshot";
import type { TeamPlayer } from "@/lib/api";

export type SquadSortKey = "number" | "name" | "position" | "age" | "nationality" | "appearances" | "goals" | "assists" | "yellow" | "red";
export type SortDir = "asc" | "desc";

/** 감독·코치와 이전 명단을 뺀 현재 선수단 (기준은 roster-snapshot.ts) */
export function squadPlayers(players: TeamPlayer[]): TeamPlayer[] {
  return currentRoster(players);
}

function jerseyNumber(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

// GK·DF·MF·FW 순, 묶이지 않는 포지션은 그 뒤에 원문 순. 포지션이 없으면 누락
function positionRank(position: string | null): string | null {
  if (!position) return null;
  const group = positionGroupOf(position);
  return group ? String(POSITION_GROUPS.findIndex((g) => g.key === group)) : `9${position}`;
}

function sortValue(player: TeamPlayer, key: SquadSortKey, today: string): number | string | null {
  switch (key) {
    case "number": return jerseyNumber(player.strNumber);
    case "name": return player.strPlayer || null;
    case "position": return positionRank(player.strPosition);
    case "age": return ageOn(player.dateBorn, today);
    case "nationality": return player.strNationality || null;
    case "appearances": return player.appearances;
    case "goals": return player.goals;
    case "assists": return player.assists;
    case "yellow": return player.yellow_cards;
    case "red": return player.red_cards;
  }
}

function compareValues(a: number | string, b: number | string): number {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ko");
}

/** 누락값은 방향과 관계없이 맨 뒤, 같으면 등번호 → 이름 순 (8.1 표 정렬) */
export function sortSquad(players: TeamPlayer[], key: SquadSortKey, dir: SortDir, today: string = kstDate()): TeamPlayer[] {
  const tieBreak = (a: TeamPlayer, b: TeamPlayer) => {
    const na = jerseyNumber(a.strNumber), nb = jerseyNumber(b.strNumber);
    if (na !== nb) return na === null ? 1 : nb === null ? -1 : na - nb;
    return a.strPlayer.localeCompare(b.strPlayer, "ko");
  };
  return [...players].sort((a, b) => {
    const va = sortValue(a, key, today), vb = sortValue(b, key, today);
    if (va === null || vb === null) return va === vb ? tieBreak(a, b) : va === null ? 1 : -1;
    // 묶이지 않는 포지션은 정렬 방향과 관계없이 GK·DF·MF·FW 뒤
    if (key === "position" && String(va).startsWith("9") !== String(vb).startsWith("9")) return String(va).startsWith("9") ? 1 : -1;
    const diff = compareValues(va, vb);
    return diff === 0 ? tieBreak(a, b) : dir === "asc" ? diff : -diff;
  });
}

export function filterSquad(players: TeamPlayer[], group: PositionGroup | "all"): TeamPlayer[] {
  return group === "all" ? players : players.filter((p) => positionGroupOf(p.strPosition) === group);
}

/** 선수단 기준일: 명단 행을 마지막으로 수집한 날 (한국 날짜). 알 수 없으면 null */
export function squadAsOf(players: TeamPlayer[]): string | null {
  const times = players.map((p) => (p.updatedAt ? Date.parse(p.updatedAt) : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? kstDate(new Date(Math.max(...times))) : null;
}

/** 하나라도 값이 있는 열만 보인다 (수집하지 않는 열은 감춤) */
export function hasAnyValue<T>(rows: T[], pick: (row: T) => number | null): boolean {
  return rows.some((row) => pick(row) !== null);
}

const K_LEAGUE_IDS = ["4689", "4822"];

export function isKLeague(idLeague: string | null | undefined): boolean {
  return K_LEAGUE_IDS.includes(idLeague ?? "");
}

/** 기록 범위 안내 (PLAYER-05). 리그 구분별 한 줄 */
export const RECORD_SCOPE = {
  kleague: "K리그 기록은 kleague.com 득점·도움 순위에서 가져와, 리그별 득점 또는 도움 상위 30위 안의 선수만 있습니다.",
  kleagueLink: "kleague.com 기록은 같은 팀 명단에서 영문 이름이 정확히 한 명과 일치하는 선수에게만 연결해, 순위에 든 선수라도 기록이 보이지 않을 수 있습니다.",
  europe: "유럽 리그 기록은 경기 타임라인의 득점·도움·카드·PK만 집계합니다. 출전 수와 출전 시간은 제공하지 않으며, 리그의 끝난 경기를 모두 모은 뒤에 반영됩니다.",
  transfer: "기록은 리그·시즌별로 한 줄입니다. 같은 리그 안에서 시즌 중 팀을 옮기면 두 팀 기록이 한 줄로 합쳐지고, 표시되는 팀이 실제 현재 소속과 다를 수 있습니다.",
} as const;
