// TeamRoster.tsx - Team Squad/Roster Display Component
import { useQuery } from '@tanstack/react-query';
import { fetchTeamPlayers, type TeamPlayer } from '@/lib/api';

interface TeamRosterProps {
  idTeam: string;
  teamName: string;
}

function PlayerCard({ player }: { player: TeamPlayer }) {
  return (
    <div className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
      <div className="flex items-center space-x-4">
        {/* Player Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-slate-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            {player.strNumber && (
              <span className="text-blue-400 font-bold text-lg">#{player.strNumber}</span>
            )}
            <h3 className="text-white font-semibold truncate">{player.strPlayer}</h3>
          </div>
          {player.strPosition && (
            <div className="mt-1">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">
                {player.strPosition}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamRoster({ idTeam, teamName }: TeamRosterProps) {
  const { data: players, isLoading, error } = useQuery({
    queryKey: ['team-players', idTeam],
    queryFn: () => fetchTeamPlayers(idTeam),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">선수단</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-700 rounded-lg p-4 h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">선수단</h2>
        <p className="text-slate-400">선수 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">선수단</h2>
        <p className="text-slate-400">등록된 선수 정보가 없습니다.</p>
      </div>
    );
  }

  // Group players by position
  const groupedPlayers: Record<string, TeamPlayer[]> = players.reduce((acc, player) => {
    const position = player.strPosition || '기타';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(player);
    return acc;
  }, {} as Record<string, TeamPlayer[]>);

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-6">
        선수단 ({players.length}명)
      </h2>

      <div className="space-y-6">
        {Object.entries(groupedPlayers).map(([position, positionPlayers]) => (
          <div key={position}>
            <h3 className="text-lg font-semibold text-slate-300 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              {position} ({positionPlayers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {positionPlayers.map((player) => (
                <PlayerCard key={player.idPlayer} player={player} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
