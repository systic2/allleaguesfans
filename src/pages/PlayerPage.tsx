import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, type PlayerDetail } from "@/lib/api";
import { Users, Shield, Zap, Activity, Clock, AlertCircle } from "lucide-react";
import CrestImg from "@/app/components/CrestImg";
import FMSubNav from "@/components/FMSubNav";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#2a2a2a] text-white px-3 py-1 text-xs font-bold uppercase tracking-wider border-l-4 border-purple-500 mb-2">
      {title}
    </div>
  );
}

function StatItem({ label, value, highlight = false, colorClass = "text-white" }: { label: string, value: number | string, highlight?: boolean, colorClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded hover:bg-white/5 border-b border-white/5 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-base font-mono font-bold ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function PlayerPage() {
  const { id = "0" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerId = Number(id);

  const { data: player, isLoading } = useQuery<PlayerDetail | null>({
    queryKey: ["player-detail", playerId],
    queryFn: () => fetchPlayerDetail(playerId),
    enabled: Number.isFinite(playerId) && playerId > 0,
  });

  if (isLoading) return <div className="p-10 text-center text-white">Loading Scout Report...</div>;
  if (!player) return <div className="p-10 text-center text-white">Player not found in database.</div>;

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
                <img src="https://flagcdn.com/w40/kr.png" alt="Korea" className="h-5 rounded shadow-sm opacity-80" />
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
          
          <div className="text-right">
             <div className="text-xs text-white/40 uppercase font-bold mb-1">Weekly Wage</div>
             <div className="text-xl text-white font-mono font-bold">₩ 5,250,000</div>
             <div className="text-xs text-green-400 mt-1">Expires 2027/12/31</div>
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
                  <span className="text-white font-medium">{player.age} years old ({player.birthDate})</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Height</span>
                  <span className="text-white font-medium">{player.height}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Weight</span>
                  <span className="text-white font-medium">{player.weight}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/40">Preferred Foot</span>
                  <span className="text-white font-medium">{player.preferredFoot}</span>
                </div>
              </div>
            </div>

            {/* Condition / Fitness */}
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
              <SectionHeader title="Fitness" />
              <div className="flex justify-around items-center py-4">
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-xl bg-black/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                     97%
                   </div>
                   <span className="text-xs text-white/50 uppercase">Condition</span>
                 </div>
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-16 h-16 rounded-full border-4 border-blue-500 flex items-center justify-center text-blue-400 font-bold text-xl bg-black/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                     100%
                   </div>
                   <span className="text-xs text-white/50 uppercase">Sharpness</span>
                 </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN: Real Statistics (6 cols) */}
          <div className="lg:col-span-6">
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm h-full">
              <SectionHeader title="2025 Season Statistics" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                
                {/* Participation */}
                <div className="bg-white/5 rounded p-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Participation
                  </h3>
                  <div className="space-y-1">
                    <StatItem label="Appearances" value={player.stats.appearances} />
                    <StatItem label="Minutes Played" value={player.stats.minutesPlayed} />
                    <StatItem label="Avg Rating" value={player.stats.rating.toFixed(2)} colorClass="text-yellow-400" />
                  </div>
                </div>

                {/* Attack */}
                <div className="bg-white/5 rounded p-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Attack
                  </h3>
                  <div className="space-y-1">
                    <StatItem label="Goals" value={player.stats.goals} colorClass="text-emerald-400" />
                    <StatItem label="Assists" value={player.stats.assists} colorClass="text-blue-400" />
                    <StatItem label="Penalties Scored" value={`${player.stats.penaltiesScored} / ${player.stats.penaltiesScored + player.stats.penaltiesMissed}`} />
                  </div>
                </div>

                {/* Discipline */}
                <div className="bg-white/5 rounded p-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> Discipline
                  </h3>
                  <div className="space-y-1">
                    <StatItem label="Yellow Cards" value={player.stats.yellowCards} colorClass="text-yellow-500" />
                    <StatItem label="Red Cards" value={player.stats.redCards} colorClass="text-red-500" />
                    <StatItem label="Own Goals" value={player.stats.ownGoals} colorClass="text-red-400" />
                  </div>
                </div>

                {/* Summary / Form */}
                <div className="bg-white/5 rounded p-3 flex flex-col items-center justify-center">
                   <h3 className="text-xs font-bold text-white/50 uppercase mb-2">Form (Last 5)</h3>
                   <div className="flex gap-1">
                     {[...Array(5)].map((_, i) => (
                       <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-600 text-white' : i === 3 ? 'bg-gray-500 text-white' : 'bg-red-500 text-white'}`}>
                         {i < 3 ? 'W' : i === 3 ? 'D' : 'L'} {/* Mock Data */}
                       </div>
                     ))}
                   </div>
                   <div className="mt-4 text-center">
                     <span className="text-xs text-white/40">Goals / 90min</span>
                     <div className="text-xl font-mono font-bold text-white">
                       {player.stats.minutesPlayed > 0 ? (player.stats.goals / (player.stats.minutesPlayed / 90)).toFixed(2) : '0.00'}
                     </div>
                   </div>
                </div>

              </div>
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
            <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
              <SectionHeader title="Quick Summary" />
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-white/60 text-sm">Goals</span>
                   <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500" style={{ width: `${Math.min(player.stats.goals * 5, 100)}%` }}></div>
                   </div>
                   <span className="text-white font-bold font-mono">{player.stats.goals}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-white/60 text-sm">Assists</span>
                   <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500" style={{ width: `${Math.min(player.stats.assists * 10, 100)}%` }}></div>
                   </div>
                   <span className="text-white font-bold font-mono">{player.stats.assists}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-white/60 text-sm">Apps</span>
                   <div className="flex-1 mx-3 h-2 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-purple-500" style={{ width: `${Math.min(player.stats.appearances * 2, 100)}%` }}></div>
                   </div>
                   <span className="text-white font-bold font-mono">{player.stats.appearances}</span>
                 </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* --- BOTTOM SECTION: BIOGRAPHY --- */}
        <div className="mt-4 bg-[#242424] rounded border border-white/5 p-6 shadow-sm">
          <SectionHeader title="Scout Report" />
          <p className="text-gray-400 text-sm leading-relaxed">
            <span className="text-white font-bold">{player.name}</span> is a {player.age}-year-old professional footballer from South Korea who currently plays as a <span className="text-white">{player.position}</span> for <span className="text-white">{player.teamName}</span>. 
            
            {player.stats.goals > 5 ? ` He has been in fine form this season, finding the net ${player.stats.goals} times.` : ` He is a hardworking player looking to make his mark on the first team.`}
            
            With {player.stats.appearances} appearances this season, he is {player.stats.appearances > 20 ? 'a key member of the squad' : 'fighting for his place in the team'}.
          </p>
        </div>
      </div>
    </div>
  );
}