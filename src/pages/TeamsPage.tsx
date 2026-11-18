import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamsList, type TeamListRow } from "@/lib/api";
import { leagueIdForSlug, leagueNameKo, leagueSlugFor, seasonLabel, supportedLeagueIds } from "@/lib/leagues";
import { useTeamName } from "@/hooks/useTeamName";
import { findTeamIdsByAlias } from "@/lib/team-aliases";
import CrestImg from "@/app/components/CrestImg";
import { FilterBar, FilterField, filterControl } from "@/components/FilterBar";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

// /teams?league=slug&q=이름 — 지원 리그의 최근 시즌 참가 팀
export default function TeamsPage() {
  const [params, setParams] = useSearchParams();
  const teamName = useTeamName();
  const leagueSlug = params.get("league") ?? "";
  const leagueId = leagueSlug ? leagueIdForSlug(leagueSlug) : null;
  const q = params.get("q") ?? "";

  const { data, isLoading, isError } = useQuery({ queryKey: ["teams-list"], queryFn: fetchTeamsList, staleTime: 1000 * 60 * 10 });

  const update = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: key === "q" }); // 이름 입력은 기록을 쌓지 않는다
  };
  const unknownLeague = !!leagueSlug && !leagueId;

  const nq = normalize(q);
  // 검색창과 같이 줄임말('맨유')도 찾는다
  const aliasIds = new Set(nq ? findTeamIdsByAlias(q) : []);
  const matches = (row: TeamListRow) =>
    !nq || aliasIds.has(row.team_id) || normalize(teamName(row.team_id, row.team_name)).includes(nq) || normalize(row.team_name).includes(nq);
  const groups = supportedLeagueIds()
    .filter((id) => !leagueId || id === leagueId)
    .map((id) => ({ id, rows: (data ?? []).filter((row) => row.league_id === id && matches(row)) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-ink">팀</h1>

      <FilterBar>
        <FilterField label="리그">
          <select aria-label="리그" value={leagueSlug} onChange={(e) => update("league", e.target.value)} className={filterControl}>
            <option value="">전체 리그</option>
            {supportedLeagueIds().map((id) => (
              <option key={id} value={leagueSlugFor(id)}>{leagueNameKo(leagueSlugFor(id))}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="팀 이름 (한·영)">
          <input type="search" aria-label="팀 이름" value={q} onChange={(e) => update("q", e.target.value)} className={filterControl} />
        </FilterField>
      </FilterBar>

      {unknownLeague ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">지원하지 않는 리그입니다. 리그 필터를 다시 골라 주세요.</p>
      ) : isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">팀 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">조건에 맞는 팀이 없습니다.</p>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-label={leagueNameKo(leagueSlugFor(group.id)) ?? group.id} className="rounded-lg border border-line bg-panel">
            <h2 className="flex items-baseline gap-2 border-b border-line px-4 py-2 text-sm font-bold">
              <Link to={`/leagues/${leagueSlugFor(group.id)}`} className="hover:text-accent">{leagueNameKo(leagueSlugFor(group.id))}</Link>
              <span className="font-normal text-ink/50">{seasonLabel(group.id, group.rows[0].season)} 시즌 · {group.rows.length}팀</span>
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {group.rows.map((row) => (
                <li key={row.team_id}>
                  <Link to={`/teams/${row.team_id}`} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-raised">
                    <span className="w-6 text-right text-xs text-ink/50">{row.rank}</span>
                    <CrestImg src={row.crest_url} alt="" size={24} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{teamName(row.team_id, row.team_name)}</span>
                      {teamName(row.team_id, row.team_name) !== row.team_name && (
                        <span className="block truncate text-xs text-ink/50">{row.team_name}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
