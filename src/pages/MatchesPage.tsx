import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchMatchesOnDate, fetchNextMatchDate } from "@/lib/api";
import type { MatchWithTeams } from "@/lib/thesportsdb-api";
import { isDateString, kstDate, kstDateLabel, kstTime, shiftDate } from "@/lib/dates";
import { hasConfirmedScore, hasKickoffTime, matchPhase, statusLabel, type MatchPhase } from "@/lib/match-status";
import { leagueIdForSlug, leagueNameKo, leagueSlugFor, supportedLeagueIds } from "@/lib/leagues";
import { useTeamName } from "@/hooks/useTeamName";
import CrestImg from "@/app/components/CrestImg";
import { FilterBar, FilterField, SegmentedControl, filterControl } from "@/components/FilterBar";

type StatusFilter = "" | "live" | "scheduled" | "finished";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "전체" },
  { value: "live", label: "LIVE" },
  { value: "scheduled", label: "예정" },
  { value: "finished", label: "종료" },
];

// /matches?date=YYYY-MM-DD&league=slug&status=live — 날짜는 한국 시간 기준 (docs/prd.md MATCH-01)
export default function MatchesPage() {
  const [params, setParams] = useSearchParams();
  const today = kstDate();
  const date = isDateString(params.get("date")) ? params.get("date")! : today;
  const leagueSlug = params.get("league") ?? "";
  const leagueId = leagueSlug ? leagueIdForSlug(leagueSlug) : null;
  const rawStatus = params.get("status") ?? "";
  const status: StatusFilter = STATUS_OPTIONS.some((o) => o.value === rawStatus) ? (rawStatus as StatusFilter) : "";

  const update = (next: Record<string, string>) => {
    // 최신 주소를 기준으로 바꾼다 (지연된 입력 반영이 그 사이 바뀐 필터를 덮어쓰지 않게)
    setParams((prev) => {
      const merged = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(next)) {
        if (value) merged.set(key, value);
        else merged.delete(key);
      }
      return merged;
    });
  };
  const unknownLeague = !!leagueSlug && !leagueId;

  // 날짜·필터를 바꾸면 이전 결과를 남기지 않는다 (새 날짜 제목 아래에 이전 경기가 보이지 않게)
  const { data: matches, isLoading, isError } = useQuery({
    queryKey: ["matches-on-date", date, leagueId, status],
    queryFn: () => fetchMatchesOnDate(date, { leagueId, phase: (status || null) as MatchPhase | null }),
    enabled: !unknownLeague,
  });

  const isEmpty = !unknownLeague && !isLoading && !isError && matches?.length === 0;
  // 경기가 없으면 가장 가까운 다음 경기 날짜를 알려준다 (진행·종료 필터에서는 의미가 없어 묻지 않는다)
  const { data: nextDate } = useQuery({
    queryKey: ["next-match-date", date, leagueId, status],
    queryFn: () => fetchNextMatchDate(date, leagueId, status === "scheduled" ? "scheduled" : null),
    enabled: isEmpty && (status === "" || status === "scheduled"),
  });

  const groups = supportedLeagueIds()
    .map((id) => ({ id, matches: (matches ?? []).filter((m) => String(m.leagueId) === id) }))
    .filter((group) => group.matches.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-bold text-ink">경기</h1>

      <FilterBar>
        <FilterField label="날짜">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" aria-label="전날" className={filterControl} onClick={() => update({ date: shiftDate(date, -1) })}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              aria-label="날짜 선택"
              value={date}
              onChange={(e) => isDateString(e.target.value) && update({ date: e.target.value })}
              className={filterControl}
            />
            <button type="button" aria-label="다음날" className={filterControl} onClick={() => update({ date: shiftDate(date, 1) })}>
              <ChevronRight className="h-4 w-4" />
            </button>
            {[["어제", -1], ["오늘", 0], ["내일", 1]].map(([label, offset]) => {
              const value = shiftDate(today, offset as number);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={value === date}
                  onClick={() => update({ date: value === today ? "" : value })}
                  className={`${filterControl} ${value === date ? "border-accent" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FilterField>
        <FilterField label="리그">
          <select aria-label="리그" value={leagueSlug} onChange={(e) => update({ league: e.target.value })} className={filterControl}>
            <option value="">전체 리그</option>
            {supportedLeagueIds().map((id) => (
              <option key={id} value={leagueSlugFor(id)}>{leagueNameKo(leagueSlugFor(id))}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="상태">
          <SegmentedControl label="경기 상태" options={STATUS_OPTIONS} value={status} onChange={(value) => update({ status: value })} />
        </FilterField>
      </FilterBar>

      <h2 className="text-sm font-bold text-ink/70">{kstDateLabel(date)}{date === today ? " · 오늘" : ""}</h2>

      {unknownLeague ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">지원하지 않는 리그입니다. 리그 필터를 다시 골라 주세요.</p>
      ) : isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">경기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">
          <p className="text-ink">이 날짜에 {status ? `${STATUS_OPTIONS.find((o) => o.value === status)!.label} ` : ""}경기가 없습니다.</p>
          {nextDate && (
            <button type="button" onClick={() => update({ date: nextDate })} className="mt-2 text-accent underline">
              가장 가까운 경기: {kstDateLabel(nextDate)}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.id} aria-label={leagueNameKo(leagueSlugFor(group.id)) ?? group.id} className="rounded-lg border border-line bg-panel">
              <h3 className="border-b border-line px-4 py-2 text-sm font-bold">
                <Link to={`/leagues/${leagueSlugFor(group.id)}`} className="hover:text-accent">{leagueNameKo(leagueSlugFor(group.id))}</Link>
              </h3>
              <ul>
                {group.matches.map((match) => <MatchRow key={match.id} match={match} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Crest({ src }: { src: string | null | undefined }) {
  return <CrestImg src={src} alt="" size={20} className="shrink-0" />;
}

function MatchRow({ match }: { match: MatchWithTeams }) {
  const teamName = useTeamName();
  const phase = matchPhase(match.status);
  const showScore = hasConfirmedScore(match.status, match.homeScore, match.awayScore);
  return (
    <li className="grid grid-cols-[4.5rem_1fr_auto_1fr] items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0 sm:px-4">
      <span className={`text-xs ${phase === "live" ? "font-bold text-loss" : "text-ink/60"}`}>
        {hasKickoffTime(match.status) ? kstTime(match.date) : statusLabel(match.status)}
      </span>
      <Link to={`/teams/${match.homeTeamId}`} className="flex min-w-0 items-center justify-end gap-2 hover:text-accent">
        <span className="truncate">{teamName(match.homeTeamId, match.homeTeam?.name ?? match.homeTeamId)}</span>
        <Crest src={match.homeTeam?.badgeUrl} />
      </Link>
      <Link
        to={`/matches/${match.id}`}
        aria-label="경기 상세"
        className="min-w-14 rounded bg-sunken px-2 py-1 text-center font-mono font-bold hover:bg-raised"
      >
        {showScore ? `${match.homeScore} - ${match.awayScore}` : "VS"}
      </Link>
      <Link to={`/teams/${match.awayTeamId}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
        <Crest src={match.awayTeam?.badgeUrl} />
        <span className="truncate">{teamName(match.awayTeamId, match.awayTeam?.name ?? match.awayTeamId)}</span>
      </Link>
    </li>
  );
}
