import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PLAYER_PAGE_SIZE, fetchPlayersPage, fetchTeamsList, type PlayerSort } from "@/lib/api";
import { leagueIdForSlug, leagueNameKo, leagueSlugFor, supportedLeagueIds } from "@/lib/leagues";
import { POSITION_GROUPS, isPositionGroup, positionGroupOf, type PositionGroup } from "@/lib/positions";
import { ageOn } from "@/lib/dates";
import { useTeamName } from "@/hooks/useTeamName";
import { FilterBar, FilterField, filterControl } from "@/components/FilterBar";

const SORT_OPTIONS: { value: PlayerSort; label: string }[] = [
  { value: "name", label: "이름순" },
  { value: "young", label: "나이 어린순" },
  { value: "old", label: "나이 많은순" },
];

// /players?league=&team=&position=GK&q=&sort=&page= — 현재 선수단(players_v2) 기준
export default function PlayersPage() {
  const [params, setParams] = useSearchParams();
  const teamName = useTeamName();
  const leagueSlug = params.get("league") ?? "";
  const leagueId = leagueSlug ? leagueIdForSlug(leagueSlug) : null;
  const teamId = params.get("team") ?? "";
  const rawPosition = params.get("position");
  const position: PositionGroup | "" = isPositionGroup(rawPosition) ? rawPosition : "";
  const q = params.get("q") ?? "";
  const sort = (SORT_OPTIONS.some((o) => o.value === params.get("sort")) ? params.get("sort") : "name") as PlayerSort;
  const rawPage = Number(params.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  // 필터를 바꾸면 1페이지로 (docs/prd.md 5장 상태 유지 규칙)
  const update = (next: Record<string, string>, replace = false) => {
    // 최신 주소를 기준으로 바꾼다 (지연된 입력 반영이 그 사이 바뀐 필터를 덮어쓰지 않게)
    setParams((prev) => {
      const merged = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(next)) {
        if (value) merged.set(key, value);
        else merged.delete(key);
      }
      if (!("page" in next)) merged.delete("page");
      return merged;
    }, { replace });
  };
  const unknownLeague = !!leagueSlug && !leagueId;

  // 이름 입력은 300ms 뒤에 주소에 반영한다
  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);
  useEffect(() => {
    if (qInput.trim() === q) return;
    const id = setTimeout(() => update({ q: qInput.trim() }, true), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const { data: teams } = useQuery({ queryKey: ["teams-list"], queryFn: fetchTeamsList, staleTime: 1000 * 60 * 10 });
  const leagueTeams = (teams ?? []).filter((t) => !leagueId || t.league_id === leagueId);
  // 리그만 고르면 그 리그 팀들, 팀을 고르면 그 팀(리그도 골랐다면 그 리그 소속일 때만). 팀 목록을 받기 전에는 조회하지 않는다
  const waitingForTeams = !!leagueId && !teams;
  const teamIds = teamId
    ? (!leagueId || leagueTeams.some((t) => t.team_id === teamId) ? [teamId] : [])
    : leagueId ? leagueTeams.map((t) => t.team_id) : undefined;

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ["players-page", teamIds, position, q, sort, page],
    queryFn: () => fetchPlayersPage({ teamIds, position: position || null, q, sort, page }),
    enabled: !waitingForTeams && !unknownLeague,
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PLAYER_PAGE_SIZE)) : 1;

  // 마지막 페이지보다 큰 페이지 주소는 마지막 페이지로 바로잡는다
  useEffect(() => {
    if (data && !isPlaceholderData && data.total > 0 && page > totalPages) update({ page: String(totalPages) }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isPlaceholderData, page, totalPages]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">선수</h1>
        <p className="text-xs text-ink/50">현재 선수단 기준입니다. 시즌별 명단은 아직 제공하지 않습니다.</p>
      </div>

      <FilterBar>
        <FilterField label="리그">
          <select aria-label="리그" value={leagueSlug} onChange={(e) => update({ league: e.target.value, team: "" })} className={filterControl}>
            <option value="">전체 리그</option>
            {supportedLeagueIds().map((id) => (
              <option key={id} value={leagueSlugFor(id)}>{leagueNameKo(leagueSlugFor(id))}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="팀">
          <select aria-label="팀" value={teamId} onChange={(e) => update({ team: e.target.value })} className={`${filterControl} max-w-48`}>
            <option value="">전체 팀</option>
            {leagueTeams.map((t) => (
              <option key={t.team_id} value={t.team_id}>{teamName(t.team_id, t.team_name)}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="포지션">
          <select aria-label="포지션" value={position} onChange={(e) => update({ position: e.target.value })} className={filterControl}>
            <option value="">전체</option>
            {POSITION_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="이름 (영문)">
          <input type="search" aria-label="선수 이름" value={qInput} onChange={(e) => setQInput(e.target.value)} className={filterControl} />
        </FilterField>
        <FilterField label="정렬">
          <select aria-label="정렬" value={sort} onChange={(e) => update({ sort: e.target.value === "name" ? "" : e.target.value })} className={filterControl}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterField>
      </FilterBar>

      {unknownLeague ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">지원하지 않는 리그입니다. 리그 필터를 다시 골라 주세요.</p>
      ) : isLoading || waitingForTeams ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">선수 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : !data || data.total === 0 ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">조건에 맞는 선수가 없습니다.</p>
      ) : data.rows.length === 0 ? (
        // 마지막 페이지를 넘은 주소 — 위 effect 가 마지막 페이지로 옮긴다
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : (
        <>
          <p className="text-xs text-ink/50">총 {data.total.toLocaleString("ko-KR")}명</p>
          {/* 새 결과를 받는 동안 이전 행은 마우스·키보드 모두로 고를 수 없게 inert */}
          <div className={`overflow-x-auto rounded-lg border border-line bg-panel ${isPlaceholderData ? "opacity-60" : ""}`} aria-busy={isPlaceholderData} inert={isPlaceholderData}>
            <table className="w-full text-sm">
              <caption className="sr-only">선수 목록</caption>
              <thead className="bg-sunken text-xs text-ink/60">
                <tr>
                  <th scope="col" className="sticky left-0 bg-sunken px-3 py-2 text-left">이름</th>
                  <th scope="col" className="px-3 py-2 text-left">소속</th>
                  <th scope="col" className="px-3 py-2 text-left">포지션</th>
                  <th scope="col" className="px-3 py-2 text-left">국적</th>
                  <th scope="col" className="px-3 py-2 text-right">나이</th>
                  <th scope="col" className="px-3 py-2 text-right">등번호</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => {
                  const group = POSITION_GROUPS.find((g) => g.key === positionGroupOf(p.position));
                  const age = ageOn(p.birth_date);
                  return (
                    <tr key={p.id} className="border-t border-line hover:bg-raised">
                      <td className="sticky left-0 bg-panel px-3 py-2">
                        <Link to={`/players/${p.id}`} className="flex min-h-8 items-center gap-2 hover:text-accent">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-xs text-ink/60">
                            <PlayerPhoto src={p.photo_url} name={p.name} />
                          </span>
                          <span className="whitespace-nowrap">{p.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {p.team_id ? (
                          <Link to={`/teams/${p.team_id}`} className="whitespace-nowrap hover:text-accent">{teamName(p.team_id, p.team_name ?? p.team_id)}</Link>
                        ) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2" title={p.position ?? undefined}>{group?.label ?? p.position ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{p.nationality ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{age ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.number ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav aria-label="페이지" className="flex items-center justify-center gap-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              className={`${filterControl} disabled:opacity-40`}
            >
              이전
            </button>
            <span className="text-ink/70">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
              className={`${filterControl} disabled:opacity-40`}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

// 사진이 없거나 불러오지 못하면 이름 첫 글자 (docs/prd.md 8.3)
function PlayerPhoto({ src, name }: { src: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{name.slice(0, 1)}</>;
  return <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />;
}
