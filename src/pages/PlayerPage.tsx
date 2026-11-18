import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, type PlayerDetail, type PlayerSeasonStats } from "@/lib/api";
import NotFound from "@/app/components/NotFound";
import FavoriteButton from "@/components/FavoriteButton";
import { useTeamName } from "@/hooks/useTeamName";
import { ageOn } from "@/lib/dates";
import { leagueNameKo, leagueSlugFor, seasonLabel } from "@/lib/leagues";
import { POSITION_GROUPS, positionGroupOf } from "@/lib/positions";
import { hasAnyValue, isKLeague, RECORD_SCOPE } from "@/lib/squad";

const MISSING = "미제공";

type StatColumn = { key: string; label: string; pick: (row: PlayerSeasonStats) => number | null; text?: (row: PlayerSeasonStats) => string };

// 수집하는 리그가 하나라도 있는 열만 보인다 (PLAYER-02)
const STAT_COLUMNS: StatColumn[] = [
  { key: "appearances", label: "출전", pick: (r) => r.appearances },
  { key: "minutes", label: "출전 시간", pick: (r) => r.minutesPlayed },
  { key: "goals", label: "득점", pick: (r) => r.goals },
  { key: "assists", label: "도움", pick: (r) => r.assists },
  { key: "yellow", label: "경고", pick: (r) => r.yellowCards },
  { key: "red", label: "퇴장", pick: (r) => r.redCards },
  {
    key: "penalties", label: "PK 성공/시도",
    pick: (r) => (r.penaltiesScored === null || r.penaltiesMissed === null ? null : r.penaltiesScored),
    text: (r) => `${r.penaltiesScored} / ${r.penaltiesScored! + r.penaltiesMissed!}`,
  },
  { key: "ownGoals", label: "자책골", pick: (r) => r.ownGoals },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function positionText(position: string | null): string {
  if (!position) return MISSING;
  const group = POSITION_GROUPS.find((g) => g.key === positionGroupOf(position));
  return group ? `${group.label} (${position})` : position;
}

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <dt className="text-ink/60">{label}</dt>
      <dd className={`text-right font-medium ${value === MISSING ? "text-ink/40" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

export default function PlayerPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const playerId = Number(id);

  const teamName = useTeamName();
  const { data: player, isLoading } = useQuery<PlayerDetail | null>({
    queryKey: ["player-detail", playerId],
    queryFn: () => fetchPlayerDetail(playerId),
    enabled: Number.isFinite(playerId) && playerId > 0,
  });

  if (isLoading) return <div className="p-10 text-center text-ink/70">로딩중…</div>;
  if (!player) return <NotFound message="선수를 찾을 수 없습니다." />;

  const age = ageOn(player.birthDate);
  const currentTeam = player.teamId ? teamName(player.teamId, player.teamName ?? player.teamId) : player.teamName;
  const columns = STAT_COLUMNS.filter((c) => hasAnyValue(player.seasons, c.pick));
  // 기록이 하나도 없어도 현재 소속 리그의 기록 범위는 알린다 (PLAYER-05)
  const leagueIds = [...player.seasons.map((r) => r.leagueId), ...(player.teamLeagueId ? [player.teamLeagueId] : [])];
  const hasKLeague = leagueIds.some((id) => isKLeague(id));
  const hasEurope = leagueIds.some((id) => id !== "" && !isKLeague(id));
  const hasMissingCell = player.seasons.some((r) => columns.some((c) => c.pick(r) === null));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-panel p-4 sm:p-6">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised">
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-2xl font-bold text-ink/50">{initials(player.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-black tracking-tight text-ink sm:text-4xl">{player.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-ink/70">
            {player.jerseyNumber && <span className="font-mono font-bold text-ink">#{player.jerseyNumber}</span>}
            {player.position && <span>{positionText(player.position)}</span>}
            {player.teamId && currentTeam && (
              <Link to={`/teams/${player.teamId}`} className="text-accent hover:underline">{currentTeam}</Link>
            )}
          </p>
          <div className="mt-2">
            <FavoriteButton item={{ type: "player", id: String(player.id), name: player.name, image: player.photoUrl ?? null }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section aria-labelledby="profile-heading" className="rounded-lg border border-line bg-panel p-4 lg:col-span-4">
          <h2 id="profile-heading" className="mb-2 text-sm font-bold text-ink/80">프로필</h2>
          <dl className="text-sm">
            <ProfileRow label="생년월일" value={player.birthDate ? `${player.birthDate.slice(0, 10)}${age !== null ? ` (만 ${age}세)` : ""}` : MISSING} />
            <ProfileRow label="국적" value={player.nationality ?? MISSING} />
            <ProfileRow label="키" value={player.height ?? MISSING} />
            <ProfileRow label="체중" value={player.weight ?? MISSING} />
            <ProfileRow label="포지션" value={positionText(player.position)} />
            <ProfileRow label="등번호" value={player.jerseyNumber ?? MISSING} />
            <ProfileRow
              label="현재 소속"
              value={player.teamId && currentTeam
                ? <Link to={`/teams/${player.teamId}`} className="text-accent hover:underline">{currentTeam}</Link>
                : currentTeam ?? MISSING}
            />
          </dl>
          <p className="mt-3 text-xs text-ink/50">프로필·소속은 수집 시점 기준이며 이후 이적은 반영되지 않았을 수 있습니다.</p>
        </section>

        <section aria-labelledby="seasons-heading" className="rounded-lg border border-line bg-panel p-4 lg:col-span-8">
          <h2 id="seasons-heading" className="mb-2 text-sm font-bold text-ink/80">시즌 기록</h2>
          {player.seasons.length === 0 ? (
            <p className="py-6 text-sm text-ink/60">
              수집된 시즌 기록이 없습니다.
              {isKLeague(player.teamLeagueId) && " K리그 개인 기록은 kleague.com 선수 ID로 모으고 있어 아직 이 선수와 연결되지 않았습니다."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="text-xs text-ink/60">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-2 py-2 text-left font-medium">시즌</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">리그</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">팀</th>
                    {columns.map((c) => <th key={c.key} scope="col" className="px-2 py-2 text-right font-medium">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {player.seasons.map((row) => (
                    <tr key={`${row.season}:${row.leagueId}:${row.teamId}`} className="border-b border-line/60 last:border-0">
                      <th scope="row" className="px-2 py-2 text-left font-medium text-ink">{row.leagueId ? seasonLabel(row.leagueId, row.season) : row.season}</th>
                      <td className="px-2 py-2 text-ink/80">
                        {leagueNameKo(leagueSlugFor(row.leagueId))
                          ? <Link to={`/leagues/${leagueSlugFor(row.leagueId)}`} className="hover:text-accent hover:underline">{leagueNameKo(leagueSlugFor(row.leagueId))}</Link>
                          : <span className="text-ink/40">{MISSING}</span>}
                      </td>
                      <td className="px-2 py-2 text-ink/80">
                        {row.teamId
                          ? <Link to={`/teams/${row.teamId}`} className="hover:text-accent hover:underline">{teamName(row.teamId, row.teamName || row.teamId)}</Link>
                          : row.teamName || <span className="text-ink/40">{MISSING}</span>}
                      </td>
                      {columns.map((c) => {
                        const value = c.pick(row);
                        return (
                          <td key={c.key} className="px-2 py-2 text-right font-mono tabular-nums text-ink/80">
                            {value === null ? <span title={MISSING} className="text-ink/40">—</span> : c.text ? c.text(row) : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(hasKLeague || hasEurope) && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-ink/50">
              {hasKLeague && <li>{RECORD_SCOPE.kleague}</li>}
              {hasEurope && <li>{RECORD_SCOPE.europe}</li>}
              {player.seasons.length > 0 && <li>{RECORD_SCOPE.transfer}</li>}
              {hasMissingCell && <li>—는 그 리그에서 수집하지 않는 항목입니다.</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
