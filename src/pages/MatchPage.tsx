import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, MapPin, Trophy } from "lucide-react";
import { fetchMatchDetails, type MatchDetails } from "@/lib/thesportsdb-api";
import { fetchNearbyStandings, type TeamStanding } from "@/lib/api";
import CrestImg from "@/app/components/CrestImg";

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'];
const POSTPONED_STATUSES = ['POSTPONED', 'SUSP', 'INT'];

const STATUS_LABELS: Record<string, string> = {
  FINISHED: '경기 종료',
  FT: '경기 종료',
  AET: '연장 종료',
  PEN: '승부차기 종료',
  SCHEDULED: '경기 예정',
  POSTPONED: '연기됨',
  SUSP: '중단',
  INT: '중단',
  IN_PLAY: 'LIVE',
  LIVE: 'LIVE',
  '1H': '전반',
  '2H': '후반',
  HT: '하프타임',
  ET: '연장',
  BT: '연장 휴식',
  P: '승부차기',
  CANCELED: '취소',
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  );
}

export default function MatchPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: match, isLoading, error } = useQuery<MatchDetails | null>({
    queryKey: ["match-details", id],
    queryFn: () => fetchMatchDetails(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const { data: homeStanding } = useQuery<TeamStanding[]>({
    queryKey: ["match-team-standing", match?.leagueId, match?.season, match?.homeTeamId],
    queryFn: () => fetchNearbyStandings(match!.leagueId, match!.season, match!.homeTeamId, 0),
    enabled: !!match?.leagueId && !!match?.season && !!match?.homeTeamId,
  });

  const { data: awayStanding } = useQuery<TeamStanding[]>({
    queryKey: ["match-team-standing", match?.leagueId, match?.season, match?.awayTeamId],
    queryFn: () => fetchNearbyStandings(match!.leagueId, match!.season, match!.awayTeamId, 0),
    enabled: !!match?.leagueId && !!match?.season && !!match?.awayTeamId,
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (isLoading) return <LoadingSpinner />;

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <h2 className="text-2xl font-bold mb-4">경기를 찾을 수 없습니다.</h2>
        <button onClick={() => navigate(-1)} className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 transition-colors">
          뒤로 가기
        </button>
      </div>
    );
  }

  const isFinished = FINISHED_STATUSES.includes(match.status);
  const isLive = LIVE_STATUSES.includes(match.status);
  const isPostponed = POSTPONED_STATUSES.includes(match.status);
  const hasScore = (isFinished || isLive) && match.homeScore != null && match.awayScore != null;

  // fetchNearbyStandings falls back to the full table when the team isn't found in it
  // (cup ties, friendlies, promotion mismatches) — never trust index [0] blindly.
  const homeRank = homeStanding?.find((row) => String(row.team_id) === String(match.homeTeamId));
  const awayRank = awayStanding?.find((row) => String(row.team_id) === String(match.awayTeamId));

  return (
    <div className="text-white font-sans max-w-4xl mx-auto pb-10">
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-white/50 hover:text-white text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 뒤로
        </button>
      </div>

      {/* Competition / status */}
      <div className="px-6 pb-4 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          {match.leagueBadge && (
            <img src={match.leagueBadge} alt="" className="w-5 h-5 object-contain" />
          )}
          <span>{match.leagueName || match.leagueId}</span>
          {match.round && <span>· {match.round}라운드</span>}
          {match.season && <span>· {match.season}</span>}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            isLive
              ? 'bg-red-900/30 text-red-400 border border-red-800 animate-pulse'
              : isFinished
              ? 'bg-white/10 text-white/60'
              : isPostponed
              ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
          }`}
        >
          {STATUS_LABELS[match.status] || match.status}
        </span>
      </div>

      {/* Score panel */}
      <div className="bg-black/20 rounded-xl border border-white/5 mx-4 p-8 flex items-center justify-between gap-4">
        <Link to={`/teams/${match.homeTeamId}`} className="flex flex-col items-center gap-3 flex-1 group">
          <CrestImg src={match.homeTeam?.badgeUrl} alt={match.homeTeam?.name || ''} size={64} />
          <span className="font-bold text-center group-hover:text-purple-300 transition-colors">
            {match.homeTeam?.name || `Team ${match.homeTeamId}`}
          </span>
          {homeRank && (
            <span className="text-xs text-white/40">{homeRank.rank}위 · {homeRank.points}점</span>
          )}
        </Link>

        <div className="flex flex-col items-center gap-1 px-4 shrink-0">
          {hasScore ? (
            <span className="text-4xl font-black">
              {match.homeScore} - {match.awayScore}
            </span>
          ) : isPostponed ? (
            <span className="text-lg font-bold text-yellow-500">연기됨</span>
          ) : match.status === 'CANCELED' ? (
            <span className="text-lg font-bold text-red-400">취소됨</span>
          ) : (
            <span className="text-2xl font-bold text-white/30">VS</span>
          )}
          <span className="text-xs text-white/40">{formatTime(match.date)}</span>
        </div>

        <Link to={`/teams/${match.awayTeamId}`} className="flex flex-col items-center gap-3 flex-1 group">
          <CrestImg src={match.awayTeam?.badgeUrl} alt={match.awayTeam?.name || ''} size={64} />
          <span className="font-bold text-center group-hover:text-purple-300 transition-colors">
            {match.awayTeam?.name || `Team ${match.awayTeamId}`}
          </span>
          {awayRank && (
            <span className="text-xs text-white/40">{awayRank.rank}위 · {awayRank.points}점</span>
          )}
        </Link>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 m-4">
        <div className="bg-black/20 rounded-xl border border-white/5 p-4 flex items-center gap-3">
          <Calendar className="text-purple-500 w-5 h-5 shrink-0" />
          <div>
            <p className="text-xs text-white/40">일시</p>
            <p className="text-sm font-medium">
              {formatDate(match.date)} {formatTime(match.date)}
            </p>
          </div>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/5 p-4 flex items-center gap-3">
          <MapPin className="text-purple-500 w-5 h-5 shrink-0" />
          <div>
            <p className="text-xs text-white/40">경기장</p>
            <p className="text-sm font-medium">{match.venueName || '정보 없음'}</p>
          </div>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/5 p-4 flex items-center gap-3">
          <Trophy className="text-purple-500 w-5 h-5 shrink-0" />
          <div>
            <p className="text-xs text-white/40">대회</p>
            <p className="text-sm font-medium">
              {match.leagueName || match.leagueId}
              {match.round ? ` · ${match.round}R` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Known data gap: lineups/events/live stats aren't populated in the DB yet */}
      <div className="bg-black/20 rounded-xl border border-white/5 mx-4 p-6 text-center">
        <p className="text-white/30 text-sm">라인업, 득점·카드 기록, 실시간 경기 통계는 아직 제공되지 않습니다.</p>
      </div>
    </div>
  );
}
