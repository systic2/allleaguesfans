import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import {
  fetchLeagueLeaders, fetchMatchesInRange, fetchMatchesOnDate, fetchNextMatchDate, fetchSyncStatus, type LeagueLeaderRow,
} from "@/lib/api";
import type { MatchWithTeams } from "@/lib/thesportsdb-api";
import { kstDate, kstDateLabel, kstDateTime, shiftDate } from "@/lib/dates";
import { leagueNameKo, leagueSlugFor, seasonLabel, supportedLeagueIds } from "@/lib/leagues";
import { useFavorites } from "@/hooks/useFavorites";
import { useTeamName } from "@/hooks/useTeamName";
import type { Favorite } from "@/lib/favorites";
import CrestImg from "@/app/components/CrestImg";
import { MatchRow } from "@/components/MatchRow";

// 수집은 Supabase pg_cron(migration 25)이 매시 7분에 시작한다(2026-11-21 05:07 UTC 실행 확인).
// 매시 실행이 두 번 빠지면 마지막 성공에서 약 3시간 뒤 세 번째 실행이 끝난다. 여기에 약 1시간 여유
// (러너 대기, 명단 갱신 최대 10분, 예비·수동 실행이 대기열에서 앞설 때)를 더해 4시간으로 잡는다.
// pg_cron 이 멈춰 예비 실행(6시간마다)만 남으면 예비 실행 사이마다 보통 약 2시간씩(다음 예비 실행이 밀리면 더 길게, 앞 실행이 밀렸다 정시로 돌아오면 더 짧게) 표시된다.
// 마지막 성공이 이보다 오래되면 '갱신 지연'으로 표시한다 (docs/prd.md HOME-04, AC-11)
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;
const WEEK_LIMIT = 30;
const RECENT_LIMIT = 30;
const FAVORITE_TEAMS_SHOWN = 8;
// 즐겨찾기 팀의 다음 경기·최근 결과를 찾는 범위 (일)
const FAVORITE_WINDOW_DAYS = 60;

// 홈: 즐겨찾기 팀 → 오늘 경기 → 리그별 1~4위 → 이번 주 경기 → 최근 결과 (docs/prd.md 7.2).
// 섹션마다 따로 불러와 한 섹션이 실패해도 다른 섹션은 그대로 보인다
export default function HomePage() {
  const today = kstDate();
  const { favorites } = useFavorites();
  const favoriteTeams = favorites.filter((fav) => fav.type === "team");

  return (
    <SyncFreshnessProvider>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-xl font-bold text-ink">홈</h1>
        <FavoriteTeamsSection teams={favoriteTeams} today={today} />
        <TodaySection today={today} />
        <LeadersSection />
        <WeekSection today={today} />
        <RecentSection today={today} />
      </div>
    </SyncFreshnessProvider>
  );
}

function Section({ title, step, action, children }: {
  title: string; step?: "events" | "standings"; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
          {step && <AsOf step={step} />}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

type SyncFreshness = { data: Awaited<ReturnType<typeof fetchSyncStatus>> | undefined; isError: boolean; now: number };
const SyncFreshnessContext = createContext<SyncFreshness>({ data: undefined, isError: false, now: 0 });

/**
 * 기준 시각을 홈 전체에서 한 번만 읽고 한 시계로 판정한다. 페이지를 열어 둔 채로도 새 수집 시각과
 * '갱신 지연' 전환이 반영되도록, 보이는 동안 5분마다(탭으로 돌아왔을 때는 5분이 지났으면) 다시 읽고
 * 1분마다 그리고 탭으로 돌아올 때 다시 판정한다.
 * children 은 이 컴포넌트의 상태가 바뀌어도 다시 그려지지 않고, 문맥을 읽는 AsOf 만 다시 그려진다.
 */
function SyncFreshnessProvider({ children }: { children: ReactNode }) {
  const { data, isError } = useQuery({
    queryKey: ["sync-status"], queryFn: fetchSyncStatus,
    staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000, refetchOnWindowFocus: true,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    const id = setInterval(tick, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return <SyncFreshnessContext.Provider value={{ data, isError, now }}>{children}</SyncFreshnessContext.Provider>;
}

/** 이 섹션 데이터의 수집 단계가 마지막으로 성공한 시각 */
function AsOf({ step }: { step: "events" | "standings" }) {
  const { data, isError, now } = useContext(SyncFreshnessContext);
  // 다시 읽기가 잠깐 실패해도 이미 받은 시각은 그대로 보여 준다(오래되면 '갱신 지연'으로 바뀐다)
  if (!data) return isError ? <span className="text-ink/50">기준 시각 확인 불가</span> : null;
  const at = data[step];
  if (!at) return <span className="text-ink/50">기준 시각 미제공</span>;
  const isStale = now - Date.parse(at) > STALE_AFTER_MS;
  return (
    <span className={isStale ? "text-draw" : "text-ink/50"}>
      기준 {kstDateTime(at)}{isStale ? " · 갱신 지연" : ""}
    </span>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-panel p-4 text-sm text-ink/60">{children}</div>;
}

function MatchList({ matches, showDate = false }: { matches: MatchWithTeams[]; showDate?: boolean }) {
  return (
    <ul className="rounded-lg border border-line bg-panel">
      {matches.map((match) => <MatchRow key={match.id} match={match} showDate={showDate} showLeague />)}
    </ul>
  );
}

/** 한국 날짜별로 묶어 보여준다 (경기 순서 유지) */
function MatchesByDate({ matches }: { matches: MatchWithTeams[] }) {
  const groups = new Map<string, MatchWithTeams[]>();
  for (const match of matches) {
    const date = kstDate(new Date(match.date));
    groups.set(date, [...(groups.get(date) ?? []), match]);
  }
  return (
    <div className="space-y-3">
      {[...groups].map(([date, list]) => (
        <div key={date} className="rounded-lg border border-line bg-panel">
          <h3 className="border-b border-line px-4 py-2 text-sm font-bold">
            <Link to={`/matches?date=${date}`} className="hover:text-accent">{kstDateLabel(date)}</Link>
          </h3>
          <ul>
            {list.map((match) => <MatchRow key={match.id} match={match} showLeague />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TruncatedNote({ shown, limit }: { shown: number; limit: number }) {
  if (shown < limit) return null;
  return <p className="text-xs text-ink/50">앞의 {limit}경기만 보여 줍니다. 날짜별 전체 경기는 경기 화면에서 볼 수 있습니다.</p>;
}

function FavoriteTeamsSection({ teams, today }: { teams: Favorite[]; today: string }) {
  const shown = teams.slice(0, FAVORITE_TEAMS_SHOWN);
  const ids = shown.map((team) => team.id);
  const upcoming = useQuery({
    queryKey: ["home-favorite-upcoming", ids, today],
    queryFn: () => fetchMatchesInRange(today, shiftDate(today, FAVORITE_WINDOW_DAYS), { teamIds: ids, phases: ["scheduled"], limit: 200 }),
    enabled: ids.length > 0,
  });
  const recent = useQuery({
    queryKey: ["home-favorite-recent", ids, today],
    queryFn: () => fetchMatchesInRange(shiftDate(today, -FAVORITE_WINDOW_DAYS), today, { teamIds: ids, phases: ["finished"], descending: true, limit: 200 }),
    enabled: ids.length > 0,
  });

  if (teams.length === 0) {
    return (
      <Section title="즐겨찾기 팀">
        <Notice>
          즐겨찾기한 팀이 없습니다. 팀 화면의 <Star className="inline h-3.5 w-3.5" aria-hidden="true" /> 버튼으로 추가하면 여기에 먼저 보입니다.
        </Notice>
      </Section>
    );
  }

  return (
    <Section
      title="즐겨찾기 팀"
      step="events"
      action={teams.length > shown.length && <Link to="/favorites?type=team" className="text-accent hover:underline">전체 {teams.length}팀 보기</Link>}
    >
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((team) => (
          <FavoriteTeamCard
            key={team.id}
            team={team}
            recent={recent.data && pickTeamMatch(recent.data, team.id)}
            next={upcoming.data && pickTeamMatch(upcoming.data, team.id)}
            recentState={recent.isError ? "error" : recent.isLoading ? "loading" : "ready"}
            nextState={upcoming.isError ? "error" : upcoming.isLoading ? "loading" : "ready"}
          />
        ))}
      </ul>
    </Section>
  );
}

function pickTeamMatch(matches: MatchWithTeams[], teamId: string): MatchWithTeams | null {
  return matches.find((m) => String(m.homeTeamId) === teamId || String(m.awayTeamId) === teamId) ?? null;
}

type LoadState = "loading" | "error" | "ready";

function FavoriteTeamCard({ team, recent, next, recentState, nextState }: {
  team: Favorite; recent: MatchWithTeams | null | undefined; next: MatchWithTeams | null | undefined;
  recentState: LoadState; nextState: LoadState;
}) {
  const teamName = useTeamName();
  return (
    <li className="rounded-lg border border-line bg-panel">
      <Link to={`/teams/${team.id}`} className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm font-bold hover:text-accent">
        <CrestImg src={team.image} alt="" size={20} className="shrink-0" />
        <span className="truncate">{teamName(team.id, team.name)}</span>
      </Link>
      <dl>
        <FavoriteMatchSlot label="최근 결과" match={recent} state={recentState} empty={`최근 ${FAVORITE_WINDOW_DAYS}일 동안 끝난 경기가 없습니다.`} />
        <FavoriteMatchSlot label="다음 경기" match={next} state={nextState} empty={`앞으로 ${FAVORITE_WINDOW_DAYS}일 안에 예정된 경기가 없습니다.`} />
      </dl>
    </li>
  );
}

function FavoriteMatchSlot({ label, match, state, empty }: {
  label: string; match: MatchWithTeams | null | undefined; state: LoadState; empty: string;
}) {
  return (
    <div className="border-b border-line last:border-0">
      <dt className="px-4 pt-2 text-xs text-ink/50">{label}</dt>
      <dd>
        {state === "loading" ? (
          <p className="px-4 py-2 text-xs text-ink/70">로딩중…</p>
        ) : state === "error" ? (
          <p className="px-4 py-2 text-xs text-loss">경기를 불러오지 못했습니다.</p>
        ) : match ? (
          <ul><MatchRow match={match} showDate showLeague /></ul>
        ) : (
          <p className="px-4 py-2 text-xs text-ink/60">{empty}</p>
        )}
      </dd>
    </div>
  );
}

function TodaySection({ today }: { today: string }) {
  // 경기 화면(/matches)과 같은 키라 서로 캐시를 나눠 쓴다
  const { data: matches, isLoading, isError } = useQuery({
    queryKey: ["matches-on-date", today, null, ""],
    queryFn: () => fetchMatchesOnDate(today, { leagueId: null, phase: null }),
  });
  const isEmpty = !isLoading && !isError && matches?.length === 0;
  // 가장 가까운 '예정' 경기 날짜 (연기·취소된 경기는 고르지 않는다). 경기 화면의 예정 필터와 같은 키
  const { data: nextDate, isError: isNextDateError } = useQuery({
    queryKey: ["next-match-date", today, null, "scheduled"],
    queryFn: () => fetchNextMatchDate(today, null, "scheduled"),
    enabled: isEmpty,
  });
  // 가장 가까운 경기 날짜가 아래 '이번 주 경기' 범위 밖이면 그날 경기를 여기서 보여준다
  const nextIsBeyondWeek = isEmpty && !!nextDate && nextDate > shiftDate(today, 6);
  const { data: nextMatches, isError: isNextMatchesError } = useQuery({
    queryKey: ["matches-on-date", nextDate, null, ""],
    queryFn: () => fetchMatchesOnDate(nextDate!, { leagueId: null, phase: null }),
    enabled: nextIsBeyondWeek,
  });

  return (
    <Section title={`오늘 경기 · ${kstDateLabel(today)}`} step="events" action={<Link to="/matches" className="text-accent hover:underline">경기 화면</Link>}>
      {isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">오늘 경기를 불러오지 못했습니다.</p>
      ) : matches && matches.length > 0 ? (
        <MatchList matches={matches} />
      ) : (
        <>
          <Notice>
            <p className="text-ink">오늘은 경기가 없습니다.</p>
            {nextDate && (
              <Link to={`/matches?date=${nextDate}`} className="mt-2 inline-block text-accent underline">
                가장 가까운 경기: {kstDateLabel(nextDate)}
              </Link>
            )}
            {(isNextDateError || (nextIsBeyondWeek && isNextMatchesError)) && <p className="mt-2 text-loss">가장 가까운 경기를 불러오지 못했습니다.</p>}
          </Notice>
          {nextIsBeyondWeek && nextMatches && nextMatches.length > 0 && <MatchList matches={nextMatches} />}
        </>
      )}
    </Section>
  );
}

function WeekSection({ today }: { today: string }) {
  const from = shiftDate(today, 1);
  const to = shiftDate(today, 6);
  const { data: matches, isLoading, isError } = useQuery({
    queryKey: ["home-week", from, to],
    queryFn: () => fetchMatchesInRange(from, to, { limit: WEEK_LIMIT }),
  });
  return (
    <Section title="이번 주 경기" step="events">
      <p className="text-xs text-ink/50">내일부터 {kstDateLabel(to)}까지</p>
      {isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">이번 주 경기를 불러오지 못했습니다.</p>
      ) : !matches || matches.length === 0 ? (
        <Notice>이 기간에 예정된 경기가 없습니다.</Notice>
      ) : (
        <>
          <MatchesByDate matches={matches} />
          <TruncatedNote shown={matches.length} limit={WEEK_LIMIT} />
        </>
      )}
    </Section>
  );
}

function RecentSection({ today }: { today: string }) {
  const from = shiftDate(today, -6);
  const { data: matches, isLoading, isError } = useQuery({
    queryKey: ["home-recent", from, today],
    queryFn: () => fetchMatchesInRange(from, today, { phases: ["finished"], descending: true, limit: RECENT_LIMIT }),
  });
  return (
    <Section title="최근 결과" step="events">
      <p className="text-xs text-ink/50">최근 7일 ({kstDateLabel(from)}부터 오늘까지) 끝난 경기, 최근 경기부터</p>
      {isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">최근 결과를 불러오지 못했습니다.</p>
      ) : !matches || matches.length === 0 ? (
        <Notice>최근 7일 동안 끝난 경기가 없습니다.</Notice>
      ) : (
        <>
          <MatchesByDate matches={matches} />
          <TruncatedNote shown={matches.length} limit={RECENT_LIMIT} />
        </>
      )}
    </Section>
  );
}

function LeadersSection() {
  const { data: rows, isLoading, isError } = useQuery({ queryKey: ["home-league-leaders"], queryFn: () => fetchLeagueLeaders(4) });
  const groups = supportedLeagueIds()
    .map((id) => ({ id, rows: (rows ?? []).filter((row) => row.league_id === id) }))
    .filter((group) => group.rows.length > 0);

  return (
    <Section title="리그별 1~4위" step="standings">
      {isLoading ? (
        <p className="text-sm text-ink/70">로딩중…</p>
      ) : isError ? (
        <p className="text-sm text-loss">순위를 불러오지 못했습니다.</p>
      ) : groups.length === 0 ? (
        <Notice>표시할 순위가 없습니다.</Notice>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => <LeaderCard key={group.id} leagueId={group.id} rows={group.rows} />)}
        </div>
      )}
    </Section>
  );
}

function LeaderCard({ leagueId, rows }: { leagueId: string; rows: LeagueLeaderRow[] }) {
  const teamName = useTeamName();
  const slug = leagueSlugFor(leagueId);
  const name = leagueNameKo(slug) ?? leagueId;
  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
        <h3 className="text-sm font-bold">
          <Link to={`/leagues/${slug}`} className="hover:text-accent">{name}</Link>
          <span className="ml-2 text-xs font-normal text-ink/50">{seasonLabel(leagueId, rows[0].season)} 시즌</span>
        </h3>
        <Link to={`/leagues/${slug}`} className="text-xs text-accent hover:underline" aria-label={`${name} 순위표 전체`}>순위표</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-ink/50">
            <th scope="col" className="w-10 px-4 py-1 text-left font-normal">순위</th>
            <th scope="col" className="px-2 py-1 text-left font-normal">팀</th>
            <th scope="col" className="w-12 px-2 py-1 text-right font-normal">경기</th>
            <th scope="col" className="w-14 px-4 py-1 text-right font-normal">승점</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team_id} className="border-t border-line">
              <td className="px-4 py-1.5 font-mono">{row.rank}</td>
              <td className="px-2 py-1.5">
                <Link to={`/teams/${row.team_id}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
                  <CrestImg src={row.crest_url} alt="" size={20} className="shrink-0" />
                  <span className="truncate">{teamName(row.team_id, row.team_name)}</span>
                </Link>
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-ink/70">{row.played ?? "-"}</td>
              <td className="px-4 py-1.5 text-right font-mono font-bold">{row.points ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
