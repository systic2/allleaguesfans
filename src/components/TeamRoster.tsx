// TeamRoster.tsx - Team Squad/Roster Display Component
import { useQuery } from '@tanstack/react-query';
import { fetchTeamPlayers, type TeamPlayer } from '@/lib/api';
import { Users } from "lucide-react";
import { Link } from "react-router-dom";

interface TeamRosterProps {
  idTeam: string;
  teamName: string;
}

// 포지션별 색상 매핑 (FM 스타일)
const getPositionColor = (position: string) => {
  switch (position?.toUpperCase()) {
    case 'G':
    case 'GK':
      return 'bg-purple-900 border-purple-700 text-purple-300'; // Goalkeeper
    case 'D':
    case 'RB':
    case 'LB':
    case 'CB':
      return 'bg-teal-900 border-teal-700 text-teal-300'; // Defender
    case 'M':
    case 'DM':
    case 'CM':
    case 'AM':
    case 'RM':
    case 'LM':
      return 'bg-orange-900 border-orange-700 text-orange-300'; // Midfielder
    case 'F':
    case 'ST':
    case 'CF':
    case 'LW':
    case 'RW':
      return 'bg-red-900 border-red-700 text-red-300'; // Forward
    default:
      return 'bg-gray-900 border-gray-700 text-gray-300'; // Default/Unknown
  }
};

function PlayerCard({ player }: { player: TeamPlayer }) {
  const positionColorClass = getPositionColor(player.strPosition || 'M');
  return (
    <Link to={`/players/${player.idPlayer}`} className="block">
      <div className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors flex items-center gap-4 cursor-pointer">
          {/* Player Avatar / Icon */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center text-slate-400 ${positionColorClass}`}>
            <Users className="w-6 h-6" />
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
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${positionColorClass}`}>
                  {player.strPosition}
                </span>
              </div>
            )}
          </div>
        </div>
    </Link>
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
