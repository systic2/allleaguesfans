import { type TeamPlayer } from "@/lib/api";
import { Link } from "react-router-dom";

interface TeamLineupProps {
  players: TeamPlayer[];
  className?: string;
  compact?: boolean; 
}

// ...

export default function TeamLineup({ players, className = "", compact = false }: TeamLineupProps) {  const startingXI = players.slice(0, 11);
  const substitutes = players.slice(11);

  const formationPlayers = getFormationSlots(startingXI);

  const pitchMinHeight = compact ? 'min-h-[360px]' : 'min-h-[600px]'; 
  const pitchPadding = compact ? 'p-2' : 'p-6';
  const playerGridPadding = compact ? 'p-2' : 'p-8';
  const playerAvatarSize = compact ? 'w-8 h-8' : 'w-12 h-12';
  const playerTextSize = compact ? 'text-[0.6rem]' : 'text-xs'; 
  const centerCircleSize = compact ? 'w-16 h-16' : 'w-24 h-24';

  return (
    <div className={`${compact ? '' : 'space-y-6'} ${className}`}>
      {/* 포메이션 시각화 */}
      <div className="relative">
        {/* 축구장 배경 */}
        <div className={`relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg ${pitchPadding} ${pitchMinHeight} shadow-inner border border-white/10`}>
          {/* 축구장 라인 */}
          <div className="absolute inset-4 border-2 border-white/20 rounded-lg opacity-70">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20"></div>
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${centerCircleSize} border-2 border-white/20 rounded-full`}></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/2 h-1/6 border-2 border-white/20 border-t-0"></div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/4 h-1/12 border-2 border-white/20 border-t-0"></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-1/6 border-2 border-white/20 border-b-0"></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/4 h-1/12 border-2 border-white/20 border-b-0"></div>
          </div>

          {/* 선수 배치 (4-2-3-1 포메이션 Grid) */}
          <div className={`relative h-full grid grid-rows-5 grid-cols-5 ${playerGridPadding}`}
               style={{
                 gridTemplateAreas: `
                   ".  .   st  .   ."
                   "lw .   am  .   rw"
                   ".  dm1 .   dm2 ."
                   "lb cb1 .   cb2 rb"
                   ".  .   gk  .   ."
                 `,
                 rowGap: compact ? '0.5rem' : '1.5rem' 
               }}>
            
            {formationPlayers.map(({ player, gridArea }) => {
              if (gridArea === 'bench') return null;
              const colorClass = getPositionColor(player.strPosition || 'M');

              return (
                <div
                  key={player.idPlayer}
                  className="flex flex-col items-center justify-center text-center z-10"
                  style={{ gridArea }}
                >
                  <Link to={`/players/${player.idPlayer}`} className="flex flex-col items-center group">
                    <div className={`
                      relative transform transition-all duration-200 
                      ${compact ? '' : 'group-hover:scale-110 group-hover:z-20'}
                    `}>
                      <div className={`
                        ${playerAvatarSize} rounded-full border-2 flex items-center justify-center
                        ${colorClass} text-white font-bold shadow-lg bg-opacity-90
                        ${compact ? 'text-[0.65rem]' : 'text-sm'}
                      `}>
                        {player.strNumber || player.strPosition?.charAt(0) || '?'}
                      </div>
                    </div>
                    <div className={`mt-1 text-white font-semibold leading-tight drop-shadow-md ${playerTextSize} group-hover:text-yellow-300 transition-colors`}>
                      <div className="truncate w-20 mx-auto px-1 bg-black/30 rounded">{player.strPlayer}</div>
                      {!compact && <div className="text-gray-300 text-[0.6rem] mt-0.5">{player.strPosition || 'PL'}</div>}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* 포메이션 정보 */}
        {!compact && (
          <div className="mt-4 text-center">
            <span className="inline-block bg-black/40 px-4 py-1.5 rounded-full text-sm text-white border border-white/10">
              4-2-3-1 Formation
            </span>
          </div>
        )}
      </div>

      {/* 레전드 및 교체 명단 (Compact 아닐 때만) */}
      {!compact && (
        <>
          <div className="flex flex-wrap gap-4 justify-center text-sm mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-white/70">GK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
              <span className="text-white/70">DF</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-white/70">MF</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-white/70">FW</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/5">
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Starting XI</h3>
              <div className="grid grid-cols-1 gap-2">
                {startingXI.map((player) => (
                  <Link key={player.idPlayer} to={`/players/${player.idPlayer}`} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded transition-colors group">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold
                      ${getPositionColor(player.strPosition || 'M')}
                    `}>
                      {Number(player.strNumber) || '-'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate group-hover:text-yellow-300 transition-colors">{player.strPlayer}</div>
                      <div className="text-white/40 text-xs">{player.strPosition}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {substitutes.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Substitutes</h3>
                <div className="grid grid-cols-1 gap-2">
                  {substitutes.map((player) => (
                    <Link key={player.idPlayer} to={`/players/${player.idPlayer}`} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded transition-colors group">
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold
                        ${getPositionColor(player.strPosition || 'M')}
                      `}>
                        {Number(player.strNumber) || '-'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate group-hover:text-yellow-300 transition-colors">{player.strPlayer}</div>
                        <div className="text-white/40 text-xs">{player.strPosition}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}