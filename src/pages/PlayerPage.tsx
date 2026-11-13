import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, type PlayerDetail } from "@/lib/api";
import { Users, Zap, Clock, AlertCircle } from "lucide-react";
import CrestImg from "@/app/components/CrestImg";
import FMSubNav from "@/components/FMSubNav";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#2a2a2a] text-white px-3 py-1 text-xs font-bold uppercase tracking-wider border-l-4 border-purple-500 mb-2">
      {title}
    </div>
  );
}

function StatItem({ label, value, colorClass = "text-white" }: { label: string, value: number | string, colorClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded hover:bg-white/5 border-b border-white/5 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-base font-mono font-bold ${colorClass}`}>{value}</span>
    </div>
  );
}

// 수집하지 않는 항목(0)은 실제 0과 구분되도록 '-' 로 표시
function orDash(value: number): number | string {
  return value > 0 ? value : '-';
}

export default function PlayerPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const playerId = Number(id);

  const { data: player, isLoading } = useQuery<PlayerDetail | null>({
    queryKey: ["player-detail", playerId],
    queryFn: () => fetchPlayerDetail(playerId),
    enabled: Number.isFinite(playerId) && playerId > 0,
  });

  if (isLoading) return <div className="p-10 text-center text-white">Loading Scout Report...</div>;
  if (!player) return <div className="p-10 text-center text-white">Player not found in database.</div>;
  const { stats } = player;

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-gray-200 font-sans">
      {/* --- HEADER --- */}
      <div className="p-6 pb-0">
        <div className="bg-[#242424] rounded-t-lg border-b-4 border-purple-600 p-6 flex justify-between items-end shadow-lg">
          <div className="flex gap-6 items-center">
            <div className="w-24 h-24 bg-[#333] rounded-full border-2 border-white/10 flex items-center justify-center overflow-hidden relative">
               {player.photoUrl ? (
                 <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
               ) : (
                 <Users className="w-12 h-12 text-white/20" />
               )}
               <div className="absolute bottom-0 right-0 bg-black/80 px-2 text-xs font-bold text-white border border-white/20 rounded-tl-md">
                 {player.jerseyNumber}
               </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-black text-white tracking-tight">{player.name}</h1>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-lg font-medium">
                <span className="text-yellow-400 font-bold">{player.position}</span>
                <span>•</span>
                <span className="flex items-center gap-2">
                   <CrestImg src={undefined} size={20} alt={player.teamName} />
                   {player.teamName}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* --- SUB NAV --- */}
      <FMSubNav type="player" basePath={`/players/${playerId}`} />

      {/* --- MAIN CONTENT --- */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LEFT COLUMN: Profile & Bio (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Profile Card */}
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
              <SectionHeader title="Profile" />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Nationality</span>
                  <span className="text-white font-medium">{player.nationality}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Age</span>
                  <span className="text-white font-medium">{player.age !== null ? `${player.age} years old (${player.birthDate})` : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Height</span>
                  <span className="text-white font-medium">{player.height}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Weight</span>
                  <span className="text-white font-medium">{player.weight}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Real Statistics (6 cols) */}
          <div className="lg:col-span-6">
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm h-full">
              <SectionHeader title={stats ? `${stats.season} Season Statistics` : 'Season Statistics'} />
              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {/* Participation */}
                  <div className="bg-white/5 rounded p-3">
                    <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Participation
                    </h3>
                    <div className="space-y-1">
                      <StatItem label="Appearances" value={orDash(stats.appearances)} />
                      <StatItem label="Minutes Played" value={orDash(stats.minutesPlayed)} />
                    </div>
                  </div>

                  {/* Attack */}
                  <div className="bg-white/5 rounded p-3">
                    <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Attack
                    </h3>
                    <div className="space-y-1">
                      <StatItem label="Goals" value={stats.goals} colorClass="text-emerald-400" />
                      <StatItem label="Assists" value={stats.assists} colorClass="text-blue-400" />
                      <StatItem label="Penalties Scored" value={`${stats.penaltiesScored} / ${stats.penaltiesScored + stats.penaltiesMissed}`} />
                    </div>
                  </div>

                  {/* Discipline */}
                  <div className="bg-white/5 rounded p-3">
                    <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> Discipline
                    </h3>
                    <div className="space-y-1">
                      <StatItem label="Yellow Cards" value={stats.yellowCards} colorClass="text-yellow-500" />
                      <StatItem label="Red Cards" value={stats.redCards} colorClass="text-red-500" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/50 mt-4">아직 이 선수의 시즌 기록이 없습니다.</p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Position & Stats (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Position Map (CSS Mini Pitch) */}
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
              <SectionHeader title="Positions" />
              <div className="relative h-48 bg-green-800/80 rounded border border-white/10 m-2 flex items-center justify-center overflow-hidden">
                 {/* Pitch Lines */}
                 <div className="absolute inset-2 border border-white/20"></div>
                 <div className="absolute top-1/2 w-full h-px bg-white/20"></div>
                 <div className="absolute top-1/2 left-1/2 w-12 h-12 border border-white/20 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                 
                 {/* Player Dot (Dynamic based on position string) */}
                 <div className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold z-10
                   ${player.position.includes('GK') ? 'bg-yellow-500 bottom-2' : 
                     player.position.includes('D') ? 'bg-blue-500 bottom-1/4' : 
                     player.position.includes('M') ? 'bg-green-500 top-1/2 -translate-y-1/2' : 
                     'bg-red-500 top-1/4'}
                 `}>
                   {player.position.substring(0, 2)}
                 </div>
              </div>
              <div className="text-center mt-2">
                <span className="text-emerald-400 font-bold text-sm">Natural</span>
                <div className="text-xs text-white/50">{player.position}</div>
              </div>
            </div>

            {/* Quick Stats Summary */}
            {stats && (
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
              <SectionHeader title="Quick Summary" />
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-white/60 text-sm">Goals</span>
                   <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500" style={{ width: `${Math.min(stats.goals * 5, 100)}%` }}></div>
                   </div>
                   <span className="text-white font-bold font-mono">{stats.goals}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-white/60 text-sm">Assists</span>
                   <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500" style={{ width: `${Math.min(stats.assists * 10, 100)}%` }}></div>
                   </div>
                   <span className="text-white font-bold font-mono">{stats.assists}</span>
                 </div>
              </div>
            </div>
            )}
          </div>
          
        </div>

      </div>
    </div>
  );
}