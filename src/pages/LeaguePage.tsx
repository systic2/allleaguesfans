import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react"; // Add useState and useEffect
import { 
  fetchLeagueBySlug, 
  fetchLeagueStandings, 
  fetchHistoricalChampions, 
  fetchTopScorers, 
  fetchTopAssists,
  getLatestCompletedRound, 
  getNextUpcomingRound,
  fetchFixturesByRound // Import fetchFixturesByRound from @/lib/api
} from "@/lib/api";
import { fetchLeagueFixtures } from "@/lib/thesportsdb-api"; // fetchLeagueFixtures remains from theSportsDB-api
import FMBox from "@/components/fm/FMBox";
import FMStandings from "@/components/fm/FMStandings";
import FMFixtures from "@/components/fm/FMFixtures";
import FMHistory from "@/components/fm/FMHistory";
import FMPlayerStats from "@/components/fm/FMPlayerStats";

export default function LeaguePage() {
  const { slug } = useParams<{ slug: string }>();
  
  // 1. Fetch League Basic Info
  const { data: league, isLoading: leagueLoading } = useQuery({
    queryKey: ['league', slug],
    queryFn: () => fetchLeagueBySlug(slug!),
    enabled: !!slug
  });

  const leagueId = league?.id;
  const currentSeason = league?.current_season; // Get current season from league data

  // Round management state
  const [currentRound, setCurrentRound] = useState<string | undefined>(undefined);

  // Fetch latest/next round on league load
  const { data: initialLatestCompletedRound, isLoading: isLoadingLatest } = useQuery({
    queryKey: ['initialLatestCompletedRound', leagueId, currentSeason],
    queryFn: () => getLatestCompletedRound(leagueId!, Number(currentSeason)),
    enabled: !!leagueId && !!currentSeason && currentRound === undefined, // Only fetch once initially
  });

  const { data: initialNextUpcomingRound, isLoading: isLoadingNext } = useQuery({
    queryKey: ['initialNextUpcomingRound', leagueId, currentSeason],
    queryFn: () => getNextUpcomingRound(leagueId!, Number(currentSeason)),
    enabled: !!leagueId && !!currentSeason && currentRound === undefined, // Only fetch once initially
  });

  // Set initial round based on latest completed or next upcoming
  useEffect(() => {
    if (currentRound === undefined) {
      if (initialLatestCompletedRound || initialNextUpcomingRound) {
        setCurrentRound(initialLatestCompletedRound || initialNextUpcomingRound || undefined);
      } else if (!isLoadingLatest && !isLoadingNext && league) {
        // Fallback to round 1 if no data found after loading
        setCurrentRound('1');
      }
    }
  }, [currentRound, initialLatestCompletedRound, initialNextUpcomingRound, isLoadingLatest, isLoadingNext, league]);


  // 2. Parallel Fetching for Dashboard Data
  const { data: standings } = useQuery({
    queryKey: ['standings', slug],
    queryFn: () => fetchLeagueStandings(slug!),
    enabled: !!slug
  });

  // Fetch fixtures for the currentRound
  const { data: fixturesForRound } = useQuery({
    queryKey: ['fixturesForRound', leagueId, currentRound, currentSeason],
    queryFn: () => fetchFixturesByRound(leagueId!, currentRound!, Number(currentSeason)),
    enabled: !!leagueId && !!currentRound && !!currentSeason,
  });

  const { data: history } = useQuery({
    queryKey: ['history', leagueId],
    queryFn: () => fetchHistoricalChampions(leagueId!),
    enabled: !!leagueId
  });

  const { data: scorers } = useQuery({
    queryKey: ['scorers', leagueId],
    queryFn: () => fetchTopScorers(leagueId!),
    enabled: !!leagueId
  });

  const { data: assists } = useQuery({
    queryKey: ['assists', leagueId],
    queryFn: () => fetchTopAssists(leagueId!),
    enabled: !!leagueId
  });

  // Round navigation handlers
  const handlePreviousRound = () => {
    // Implement logic to calculate previous round
    // For now, simple decrement if round is numeric
    if (currentRound && !isNaN(Number(currentRound))) {
      setCurrentRound(String(Number(currentRound) - 1));
    }
  };

  const handleNextRound = () => {
    // Implement logic to calculate next round
    // For now, simple increment if round is numeric
    if (currentRound && !isNaN(Number(currentRound))) {
      setCurrentRound(String(Number(currentRound) + 1));
    }
  };

  if (leagueLoading) return <div className="p-8 text-white">Loading League...</div>;
  if (!league) return <div className="p-8 text-white">League not found.</div>;
  if (currentRound === undefined) return <div className="p-8 text-white">Loading Round Data...</div>;

  return (
    <div className="flex flex-col h-full bg-[#1b1b1b] text-gray-200 font-sans min-h-screen">
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-[#2c3e50] to-[#1a1a1a] p-4 border-b border-[#444] shadow-md flex items-center gap-6">
        {league.logo_url && (
          <img src={league.logo_url} alt={league.name} className="w-16 h-16 object-contain drop-shadow-lg" />
        )}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">{league.name}</h1>
            <span className="bg-white/10 text-xs px-2 py-0.5 rounded text-gray-300 border border-white/10">
              {league.current_season || '2025'}
            </span>
          </div>
          <div className="text-xs text-gray-400 flex gap-4">
            <span>국가: {league.country}</span>
            <span>디펜딩 챔피언: {history?.[0]?.champion_name || '-'}</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 p-2 grid grid-rows-[3fr_2fr] gap-2 overflow-hidden">
        
        {/* Top Row: 3 Columns (Standings | Fixtures | History) */}
        <div className="grid grid-cols-12 gap-2 h-full min-h-[400px]">
          
          {/* Left: League Table (Wide) */}
          <div className="col-span-5 h-full">
            <FMBox title="리그 순위 >" className="h-full">
              <FMStandings standings={standings || []} />
            </FMBox>
          </div>

          {/* Middle: Fixtures */}
          <div className="col-span-4 h-full">
            <FMBox title="경기/결과 >" className="h-full" 
              action={
                <div className="flex items-center gap-1">
                  <button 
                    className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] text-[10px] hover:bg-[#333] rounded"
                    onClick={handlePreviousRound}
                  >{'<'}</button>
                  <span className="text-gray-300 text-xs font-medium whitespace-nowrap">Round {currentRound}</span>
                  <button 
                    className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] text-[10px] hover:bg-[#333] rounded"
                    onClick={handleNextRound}
                  >{'>'}</button>
                </div>
              }
            >
              <FMFixtures fixtures={fixturesForRound || []} />
            </FMBox>
          </div>

          {/* Right: History & Info */}
          <div className="col-span-3 h-full flex flex-col gap-2">
            <div className="flex-1">
              <FMBox title="지난 우승팀 >" className="h-full">
                <FMHistory history={history || []} />
              </FMBox>
            </div>
            <div className="flex-1">
              <FMBox title="대회 명성 >" className="h-full">
                <div className="p-4 flex items-center justify-center h-full text-gray-500 text-xs">
                  {/* Placeholder for reputation or other stats */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-300 mb-1">Top 5</div>
                    <div>Global Ranking</div>
                  </div>
                </div>
              </FMBox>
            </div>
          </div>
        </div>

        {/* Bottom Row: Player Stats Grid */}
        <div className="h-full min-h-[200px]">
          <FMPlayerStats scorers={scorers || []} assists={assists || []} />
        </div>

      </div>
    </div>
  );
}
