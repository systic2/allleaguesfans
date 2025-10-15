// LeagueTopScorers.tsx - Display top scorers and top assisters for a league
import { useQuery } from '@tanstack/react-query';
import { fetchTopScorersStats, fetchTopAssistersStats, type PlayerStatistics } from '@/lib/api';
import { Link } from 'react-router-dom';

interface LeagueTopScorersProps {
  idLeague: string;
  season: string;
  limit?: number;
}

function PlayerStatRow({ player, rank, showGoals }: { player: PlayerStatistics; rank: number; showGoals: boolean }) {
  const primaryStat = showGoals ? player.goals : player.assists;
  const secondaryStat = showGoals ? player.assists : player.goals;
  const statLabel = showGoals ? '골' : '도움';
  const secondaryLabel = showGoals ? '도움' : '골';

  // Medal colors for top 3
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-amber-600';
      default: return 'text-white/70';
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/20';
      case 2: return 'bg-gray-500/20';
      case 3: return 'bg-amber-500/20';
      default: return 'bg-white/5';
    }
  };

  return (
    <Link
      to={`/teams/${player.idTeam}`}
      className={`flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${getRankBg(rank)}`}
    >
      <div className="flex items-center space-x-3 flex-1">
        {/* Rank */}
        <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm ${getRankColor(rank)}`}>
          {rank}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{player.strPlayer}</div>
          <div className="text-xs text-white/60 truncate">{player.strTeam}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{primaryStat}</div>
          <div className="text-[10px] text-white/50">{statLabel}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-white/70">{secondaryStat}</div>
          <div className="text-[10px] text-white/50">{secondaryLabel}</div>
        </div>
      </div>
    </Link>
  );
}

export default function LeagueTopScorers({ idLeague, season, limit = 5 }: LeagueTopScorersProps) {
  // Fetch top scorers
  const { data: topScorers, isLoading: scorersLoading } = useQuery({
    queryKey: ['top-scorers-stats', idLeague, season],
    queryFn: () => fetchTopScorersStats(idLeague, season, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch top assisters
  const { data: topAssisters, isLoading: assistersLoading } = useQuery({
    queryKey: ['top-assisters-stats', idLeague, season],
    queryFn: () => fetchTopAssistersStats(idLeague, season, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (scorersLoading || assistersLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Scorers Loading */}
        <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <span className="mr-2">⚽</span>
            득점 순위
          </h2>
          <div className="animate-pulse space-y-3">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
            ))}
          </div>
        </section>

        {/* Top Assisters Loading */}
        <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            도움 순위
          </h2>
          <div className="animate-pulse space-y-3">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Check if we have data
  const hasScorers = topScorers && topScorers.length > 0;
  const hasAssisters = topAssisters && topAssisters.length > 0;

  if (!hasScorers && !hasAssisters) {
    return (
      <div className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4">선수 통계</h2>
        <p className="text-white/60 text-center py-8">
          아직 선수 통계 데이터가 없습니다. 경기가 진행되면 득점과 도움 순위가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top Scorers */}
      <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center border-b border-white/10 pb-2">
          <span className="mr-2">⚽</span>
          득점 순위
        </h2>
        {hasScorers ? (
          <div className="space-y-2">
            {topScorers.map((player, idx) => (
              <PlayerStatRow
                key={player.idPlayer}
                player={player}
                rank={idx + 1}
                showGoals={true}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-center py-4 text-sm">
            득점 기록이 없습니다
          </p>
        )}
      </section>

      {/* Top Assisters */}
      <section className="bg-black/20 rounded-xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center border-b border-white/10 pb-2">
          <span className="mr-2">🎯</span>
          도움 순위
        </h2>
        {hasAssisters ? (
          <div className="space-y-2">
            {topAssisters.map((player, idx) => (
              <PlayerStatRow
                key={player.idPlayer}
                player={player}
                rank={idx + 1}
                showGoals={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-center py-4 text-sm">
            도움 기록이 없습니다
          </p>
        )}
      </section>
    </div>
  );
}
