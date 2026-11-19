import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { TeamPlayer } from "@/lib/api";
import { ageOn } from "@/lib/dates";
import { POSITION_GROUPS, positionGroupOf, type PositionGroup } from "@/lib/positions";
import {
  filterSquad, hasAnyValue, isKLeague, RECORD_SCOPE, sortSquad, squadAsOf, squadPlayers,
  type SortDir, type SquadSortKey,
} from "@/lib/squad";
import { SegmentedControl } from "@/components/FilterBar";

type Column = { key: SquadSortKey; label: string; numeric?: boolean; value: (p: TeamPlayer) => string | number | null };

const BASE_COLUMNS: Column[] = [
  { key: "number", label: "번호", numeric: true, value: (p) => p.strNumber },
  { key: "name", label: "이름", value: (p) => p.strPlayer },
  { key: "position", label: "포지션", value: (p) => positionLabel(p.strPosition) },
  { key: "age", label: "나이", numeric: true, value: (p) => ageOn(p.dateBorn) },
  { key: "nationality", label: "국적", value: (p) => p.strNationality },
];

const STAT_COLUMNS: (Column & { pick: (p: TeamPlayer) => number | null })[] = [
  { key: "appearances", label: "출전", numeric: true, value: (p) => p.appearances, pick: (p) => p.appearances },
  { key: "goals", label: "득점", numeric: true, value: (p) => p.goals, pick: (p) => p.goals },
  { key: "assists", label: "도움", numeric: true, value: (p) => p.assists, pick: (p) => p.assists },
  { key: "yellow", label: "경고", numeric: true, value: (p) => p.yellow_cards, pick: (p) => p.yellow_cards },
  { key: "red", label: "퇴장", numeric: true, value: (p) => p.red_cards, pick: (p) => p.red_cards },
];

const FILTERS: { value: PositionGroup | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  ...POSITION_GROUPS.map((g) => ({ value: g.key, label: g.key })),
];

// GK·DF·MF·FW 로 묶고, 묶을 수 없는 포지션은 원문 그대로
function positionLabel(position: string | null): string | null {
  return positionGroupOf(position) ?? position;
}

/** 팀 선수단 표 (TEAM-02·03). players 는 현재 명단 스냅샷, 기록은 seasonLabel 시즌 */
export default function SquadTable({ players, leagueId, seasonLabel }: { players: TeamPlayer[]; leagueId?: string; seasonLabel: string }) {
  const [group, setGroup] = useState<PositionGroup | "all">("all");
  const [sort, setSort] = useState<{ key: SquadSortKey; dir: SortDir }>({ key: "number", dir: "asc" });

  const squad = squadPlayers(players);
  const asOf = squadAsOf(squad);
  const statColumns = STAT_COLUMNS.filter((c) => hasAnyValue(squad, c.pick));
  const columns: Column[] = [...BASE_COLUMNS, ...statColumns];
  const rows = sortSquad(filterSquad(squad, group), sort.key, sort.dir);

  const onSort = (key: SquadSortKey, numeric?: boolean) =>
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      // 기록 열은 많은 순부터
      : { key, dir: numeric && key !== "number" && key !== "age" ? "desc" : "asc" });

  return (
    <section aria-labelledby="squad-heading" className="rounded-xl border border-line bg-panel p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="squad-heading" className="text-lg font-bold text-ink">
            현재 선수단 <span className="text-sm font-normal text-ink/60">({asOf ? `기준일 ${asOf}` : "기준일 미제공"})</span>
          </h2>
          <p className="mt-1 text-xs text-ink/60">
            명단은 수집 시점의 스냅샷이라 이후 이적은 반영되지 않았을 수 있습니다. 과거 시즌 명단은 제공하지 않습니다.
            {statColumns.length > 0 && ` 기록은 ${seasonLabel} 시즌입니다.`}
          </p>
        </div>
        <SegmentedControl label="포지션" options={FILTERS} value={group} onChange={setGroup} />
      </div>

      {squad.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/60">등록된 선수 정보가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <caption className="sr-only">선수단 ({rows.length}명). 열 제목 버튼으로 정렬합니다.</caption>
            <thead className="text-xs text-ink/60">
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-2 py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.key, c.numeric)}
                        className={`inline-flex min-h-11 min-w-11 items-center gap-1 px-1 hover:text-ink ${active ? "text-ink" : ""}`}
                      >
                        {c.label}
                        {active && (sort.dir === "asc"
                          ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.idPlayer} className="border-b border-line/60 last:border-0 hover:bg-raised">
                  {columns.map((c) => {
                    const value = c.value(p);
                    if (c.key === "name") {
                      return (
                        <th key={c.key} scope="row" className="px-2 py-2 text-left font-medium">
                          <Link to={`/players/${p.idPlayer}`} className="text-ink hover:text-accent hover:underline">{p.strPlayer}</Link>
                        </th>
                      );
                    }
                    return (
                      <td key={c.key} className={`px-2 py-2 ${c.numeric ? "text-right font-mono tabular-nums" : "text-left"} text-ink/80`}>
                        {value === null || value === "" ? <span title="미제공" className="text-ink/40">—</span> : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={columns.length} className="py-6 text-center text-ink/60">이 포지션의 선수가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {squad.length > 0 && (
        <p className="mt-3 text-xs text-ink/50">
          {isKLeague(leagueId)
            ? statColumns.length > 0
              ? `${RECORD_SCOPE.kleague} ${RECORD_SCOPE.kleagueLink}`
              : `이 시즌에 이 명단과 연결된 K리그 개인 기록이 아직 없습니다. ${RECORD_SCOPE.kleagueLink} 득점·도움 순위는 리그 화면에서 볼 수 있습니다.`
            : statColumns.length > 0
              ? `${RECORD_SCOPE.europe} 기록이 없는 선수는 —로 표시합니다.`
              : "이 시즌에 이 명단과 연결된 개인 기록이 아직 없습니다."}
          {statColumns.length > 0 && ` ${RECORD_SCOPE.transfer}`}
        </p>
      )}
    </section>
  );
}
