import { type TeamPlayer } from "@/lib/api";

interface TeamLineupProps {
  teamId: number;
  players: TeamPlayer[];
  className?: string;
  compact?: boolean; // New prop
}

// 포지션별 색상 매핑
const getPositionColor = (position: string) => {
  switch (position?.toUpperCase()) {
    case 'G':
    case 'GK':
      return 'bg-purple-800 border-purple-600 text-purple-300'; // Goalkeeper
    case 'D':
    case 'RB':
    case 'LB':
    case 'CB':
      return 'bg-teal-800 border-teal-600 text-teal-300'; // Defender
    case 'M':
    case 'DM':
    case 'CM':
    case 'AM':
    case 'RM':
    case 'LM':
      return 'bg-orange-800 border-orange-600 text-orange-300'; // Midfielder
    case 'F':
    case 'ST':
    case 'CF':
    case 'LW':
    case 'RW':
      return 'bg-red-800 border-red-600 text-red-300'; // Forward
    default:
      return 'bg-gray-800 border-gray-600 text-gray-300'; // Default/Unknown
  }
};

// 포지션별 그리드 위치 매핑 (4-3-3 포메이션 기준)
const getPositionGridArea = (position: string, index: number) => {
  const pos = position?.toUpperCase() || 'M';
  
  if (pos.includes('G') || pos === 'GK') {
    return 'gk';
  }
  
  // Adjusted for a more central, compact 4-3-3/4-2-3-1 feel
  if (pos.includes('D') || pos === 'CB' || pos === 'RB' || pos === 'LB') {
    const defenderIndex = index % 4; // Use index to distribute
    return ['def1', 'def2', 'def3', 'def4'][defenderIndex];
  }
  
  if (pos.includes('M') || pos === 'CM' || pos === 'DM' || pos === 'AM' || pos === 'RM' || pos === 'LM') {
    const midIndex = index % 3; // Use index to distribute
    return ['mid1', 'mid2', 'mid3'][midIndex];
  }
  
  if (pos.includes('F') || pos === 'ST' || pos === 'CF' || pos === 'LW' || pos === 'RW') {
    const forwIndex = index % 3; // Use index to distribute
    return ['fwd1', 'fwd2', 'fwd3'][forwIndex];
  }
  
  return 'mid2'; // 기본값
};

export default function TeamLineup({ teamId, players, className = "", compact = false }: TeamLineupProps) {
  // 선발 11명 선택 (포지션별로 정렬)
  const startingXI = players.slice(0, 11);
  const substitutes = players.slice(11);

  const pitchMinHeight = compact ? 'min-h-[300px]' : 'min-h-[500px]';
  const pitchPadding = compact ? 'p-4' : 'p-6';
  const playerGridPadding = compact ? 'p-4' : 'p-8';
  const playerAvatarSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const playerTextSize = compact ? 'text-[0.6rem]' : 'text-xs'; 
  const centerCircleSize = compact ? 'w-16 h-16' : 'w-20 h-20';

  return (
    <div className={`${compact ? '' : 'space-y-6'} ${className}`}>
      {/* 포메이션 시각화 */}
      <div className="relative">
        {/* 축구장 배경 */}
        <div className={`relative bg-gradient-to-b from-green-700 to-green-800 rounded-lg ${pitchPadding} ${pitchMinHeight}`}>
          {/* 축구장 라인 */}
          <div className="absolute inset-4 border-2 border-white/10 rounded-lg">
            {/* 센터 라인 */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10"></div>
            {/* 센터 서클 */}
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${centerCircleSize} border-2 border-white/10 rounded-full`}></div>
            {/* 골 에리어들 */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/10 border-t-0"></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-8 border-2 border-white/10 border-b-0"></div>
          </div>

          {/* 선수 배치 (4-3-3 포메이션) */}
          <div className={`relative h-full grid grid-rows-4 grid-cols-5 gap-4 ${playerGridPadding}`}
               style={{
                 gridTemplateAreas: `
                   ". fwd1 fwd2 fwd3 ."
                   ". mid1 mid2 mid3 ."
                   "def1 def2 def3 def4 ."
                   ". . gk . ."
                 `
               }}>
            
            {startingXI.map((player, index) => {
              const gridArea = getPositionGridArea(player.strPosition || 'M', index);
              const colorClass = getPositionColor(player.strPosition || 'M');
              
              return (
                <div
                  key={player.idPlayer}
                  className="flex flex-col items-center justify-center text-center"
                  style={{ gridArea }}
                >
                  {/* 선수 카드 */}
                  <div className={`
                    relative transform transition-all duration-200 
                    ${compact ? '' : 'hover:scale-110 hover:z-10'}
                  `}>
                    {/* 선수 아바타 */}
                    <div className={`
                      ${playerAvatarSize} rounded-full border-2 flex items-center justify-center
                      ${colorClass} text-white font-bold text-sm shadow-lg
                    `}>
                      {player.strNumber || player.strPosition?.charAt(0) || '?'} {/* Display number or initial */}
                    </div>
                  </div>
                  {/* 선수 이름 및 포지션 (항상 표시) */}
                  <div className={`mt-1 text-white ${playerTextSize} font-medium leading-tight`}>
                    <div className="truncate w-20">{player.strPlayer}</div> {/* Truncate long names */}
                    {!compact && <div className="text-gray-300 text-[0.6rem]">{player.strPosition || 'PL'}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 포메이션 정보 */}
        {!compact && (
          <div className="mt-4 text-center">
            <span className="inline-block bg-white/10 px-3 py-1 rounded-full text-sm text-white/80">
              4-3-3 포메이션
            </span>
          </div>
        )}
      </div>

      {/* 포지션별 범례 */}
      {!compact && (
        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            <span className="text-white/80">골키퍼</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-teal-500 rounded-full"></div>
            <span className="text-white/80">수비수</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            <span className="text-white/80">미드필더</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-white/80">공격수</span>
          </div>
        </div>
      )}

      {/* 선발 명단 리스트 */}
      {!compact && (
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-3">선발 명단</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {startingXI.map((player) => (
              <div key={player.idPlayer} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                  ${getPositionColor(player.strPosition || 'M')}
                `}>
                  {Number(player.strNumber) || '?'}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{player.strPlayer}</div>
                  <div className="text-white/60 text-sm">{player.strPosition || '포지션 미정'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 교체 명단 */}
      {!compact && substitutes.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-3">교체 명단</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {substitutes.slice(0, 7).map((player) => (
              <div key={player.idPlayer} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                  ${getPositionColor(player.strPosition || 'M')}
                `}>
                  {Number(player.strNumber) || '?'}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{player.strPlayer}</div>
                  <div className="text-white/60 text-sm">{player.strPosition || '포지션 미정'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}