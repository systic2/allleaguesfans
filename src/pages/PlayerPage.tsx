import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, type PlayerDetail } from "@/lib/api";
import { Users, Shield, Zap, Activity } from "lucide-react";
import CrestImg from "@/app/components/CrestImg";

// FM Style Color Helpers
const getAttrColor = (val: number) => {
  if (val >= 16) return "text-emerald-400 font-extrabold shadow-emerald-400/20 drop-shadow-sm";
  if (val >= 11) return "text-blue-300 font-bold";
  if (val >= 6) return "text-gray-300 font-medium";
  return "text-gray-600 font-normal";
};

const getAttrBg = (val: number) => {
  if (val >= 16) return "bg-emerald-900/20";
  return "";
};

function AttributeRow({ name, value }: { name: string; value: number }) {
  return (
    <div className={`flex justify-between items-center py-0.5 px-2 rounded hover:bg-white/5 ${getAttrBg(value)}`}>
      <span className="text-gray-400 text-sm">{name}</span>
      <span className={`text-base font-mono ${getAttrColor(value)}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#2a2a2a] text-white px-3 py-1 text-xs font-bold uppercase tracking-wider border-l-4 border-purple-500 mb-2">
      {title}
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
    <div className="min-h-screen bg-[#1b1b1b] text-gray-200 font-sans p-6">
      {/* --- HEADER --- */}
      <div className="bg-[#242424] rounded-t-lg border-b-4 border-purple-600 p-6 flex justify-between items-end shadow-lg mb-4">
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
                 <CrestImg src={undefined} size={20} alt={player.teamName} /> {/* Assuming fetchPlayerDetail doesn't return crest yet, fetch from team? Or just text */}
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

      {/* --- MAIN GRID --- */}
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

        {/* CENTER COLUMN: Attributes (6 cols) */}
        <div className="lg:col-span-6">
          <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm h-full">
            <SectionHeader title="Attributes" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {/* Technical */}
              <div>
                <h3 className="text-xs font-bold text-white/30 uppercase mb-3 border-b border-white/5 pb-1">Technical</h3>
                <div className="space-y-0.5">
                  {player.attributes.technical.map(attr => (
                    <AttributeRow key={attr.name} name={attr.name} value={attr.value} />
                  ))}
                </div>
              </div>
              {/* Mental */}
              <div>
                <h3 className="text-xs font-bold text-white/30 uppercase mb-3 border-b border-white/5 pb-1">Mental</h3>
                <div className="space-y-0.5">
                  {player.attributes.mental.map(attr => (
                    <AttributeRow key={attr.name} name={attr.name} value={attr.value} />
                  ))}
                </div>
              </div>
              {/* Physical */}
              <div>
                <h3 className="text-xs font-bold text-white/30 uppercase mb-3 border-b border-white/5 pb-1">Physical</h3>
                <div className="space-y-0.5">
                  {player.attributes.physical.map(attr => (
                    <AttributeRow key={attr.name} name={attr.name} value={attr.value} />
                  ))}
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

          {/* Season Stats Summary */}
          <div className="bg-[#242424] rounded border border-white/5 p-4 shadow-sm">
            <SectionHeader title="Season Stats" />
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-white/30 text-xs uppercase border-b border-white/5">
                  <th className="pb-2 text-left">Stat</th>
                  <th className="pb-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 text-white/70">Appearances</td>
                  <td className="py-2 text-right font-mono font-bold text-white">{player.stats.appearances}</td>
                </tr>
                <tr>
                  <td className="py-2 text-white/70">Goals</td>
                  <td className="py-2 text-right font-mono font-bold text-emerald-400">{player.stats.goals}</td>
                </tr>
                <tr>
                  <td className="py-2 text-white/70">Assists</td>
                  <td className="py-2 text-right font-mono font-bold text-blue-400">{player.stats.assists}</td>
                </tr>
                <tr>
                  <td className="py-2 text-white/70">Avg Rating</td>
                  <td className="py-2 text-right font-mono font-bold text-yellow-400">{player.stats.rating.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
      </div>

      {/* --- BOTTOM SECTION: BIOGRAPHY --- */}
      <div className="mt-4 bg-[#242424] rounded border border-white/5 p-6 shadow-sm">
        <SectionHeader title="Scout Report" />
        <p className="text-gray-400 text-sm leading-relaxed">
          <span className="text-white font-bold">{player.name}</span> is a {player.age}-year-old professional footballer from South Korea who currently plays as a <span className="text-white">{player.position}</span> for <span className="text-white">{player.teamName}</span>. 
          
          {player.stats.goals > 5 ? ` He has been in fine form this season, finding the net ${player.stats.goals} times.` : ` He is a hardworking player looking to make his mark on the first team.`}
          
          Known for his <span className="text-emerald-400">{player.attributes.technical.reduce((a, b) => a.value > b.value ? a : b).name}</span> and <span className="text-emerald-400">{player.attributes.mental.reduce((a, b) => a.value > b.value ? a : b).name}</span>, he is considered a valuable asset to the squad.
        </p>
      </div>
    </div>
  );
}
