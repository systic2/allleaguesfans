import { Link } from "react-router-dom";
import type { MatchWithTeams } from "@/lib/thesportsdb-api";
import { kstShortDate, kstTime } from "@/lib/dates";
import { hasConfirmedScore, hasKickoffTime, matchPhase, statusLabel } from "@/lib/match-status";
import { leagueNameKo, leagueSlugFor } from "@/lib/leagues";
import { useTeamName } from "@/hooks/useTeamName";
import CrestImg from "@/app/components/CrestImg";

function Crest({ src }: { src: string | null | undefined }) {
  return <CrestImg src={src} alt="" size={20} className="shrink-0" />;
}

/** 경기 한 줄: 시각(또는 상태) · 홈 · 점수(경기 상세 링크) · 원정. showDate·showLeague 는 여러 날짜·리그가 섞인 목록용 */
export function MatchRow({ match, showDate = false, showLeague = false }: {
  match: MatchWithTeams; showDate?: boolean; showLeague?: boolean;
}) {
  const teamName = useTeamName();
  const phase = matchPhase(match.status);
  const showScore = hasConfirmedScore(match.status, match.homeScore, match.awayScore);
  return (
    <li className={`grid ${showDate || showLeague ? "grid-cols-[5.5rem_1fr_auto_1fr]" : "grid-cols-[4.5rem_1fr_auto_1fr]"} items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0 sm:px-4`}>
      <span className={`text-xs ${phase === "live" ? "font-bold text-loss" : "text-ink/60"}`}>
        {showDate && <span className="block">{kstShortDate(match.date)}</span>}
        <span className="block">{hasKickoffTime(match.status) ? kstTime(match.date) : statusLabel(match.status)}</span>
        {showLeague && <span className="block truncate text-ink/40">{leagueNameKo(leagueSlugFor(String(match.leagueId)))}</span>}
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
