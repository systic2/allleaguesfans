// src/components/UpcomingFixtures.tsx
// FINAL REFACTORED VERSION: Uses the new MatchWithTeams[] model directly
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  fetchEnhancedUpcomingFixtures, 
  type HighlightlyEnhancedFixture 
} from "@/lib/highlightly-enhanced-fixtures-api";
import { 
  fetchAllUpcomingFixtures,
  fetchLeagueUpcomingFixtures,
  type MatchWithTeams, 
} from "@/lib/thesportsdb-api";

// This component now expects the rich MatchWithTeams object or a compatible one
type FixtureData = MatchWithTeams | HighlightlyEnhancedFixture;

interface UpcomingFixturesProps {
  teamId?: number;
  leagueId?: number;
  title?: string;
  limit?: number;
  className?: string;
  useTheSportsDB?: boolean;
}

export default function UpcomingFixtures({ 
  teamId, 
  leagueId, 
  title = "다음 경기", 
  limit = 5,
  className = "",
  useTheSportsDB = false
}: UpcomingFixturesProps) {
  
  const safeUseTheSportsDB = useTheSportsDB;
  
  // This query now uses the refactored API functions that return joined team data
  const theSportsDBQuery = useQuery({
    queryKey: ["v2-upcoming-fixtures", leagueId ?? 'all'], 
    queryFn: async () => {
      if (leagueId) {
        return fetchLeagueUpcomingFixtures(String(leagueId));
      }
      // Fetch for ALL leagues
      return fetchAllUpcomingFixtures(limit);
    },
    enabled: safeUseTheSportsDB && !teamId,
    staleTime: 5 * 60 * 1000,
  });

  // The enhanced query also needs to be compatible
  const enhancedQuery = useQuery({
    queryKey: teamId ? ["v2-enhanced-team-upcoming-fixtures", teamId] : ["v2-enhanced-upcoming-fixtures", leagueId],
    queryFn: () => {
      if (teamId) {
        return Promise.resolve([]); // Placeholder for now
      } else {
        return fetchEnhancedUpcomingFixtures(String(leagueId), limit);
      }
    },
    enabled: !safeUseTheSportsDB,
    staleTime: 5 * 60 * 1000,
  });

  const activeQuery = safeUseTheSportsDB ? theSportsDBQuery : enhancedQuery;
  const { data: fixtures, isLoading, error } = activeQuery;

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-700 rounded my-3"></div>)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="text-center text-slate-400 py-8"><p>예정된 경기를 불러오는데 실패했습니다.</p></div>
      </div>
    );
  }

  if (!fixtures || fixtures.length === 0) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-4 opacity-50">📅</div>
          <p className="text-lg font-medium">예정된 경기가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {safeUseTheSportsDB && (
          <div className="text-slate-400 text-xs bg-green-600/20 px-2 py-1 rounded border border-green-600/30">
            K리그 1+2 통합
          </div>
        )}
      </div>
      <div className="space-y-4">
        {fixtures.map((fixture) => (
          <FixtureCard 
            key={fixture.id} 
            fixture={fixture} 
            showTeams={!teamId}
          />
        ))}
      </div>
    </div>
  );
}

interface FixtureCardProps {
  fixture: FixtureData;
  showTeams?: boolean;
}

function FixtureCard({ fixture, showTeams = true }: FixtureCardProps) {
  // The fixture object now contains nested homeTeam and awayTeam objects
  const { date, status, round, homeTeam, awayTeam, venueName } = fixture;

  const fixtureDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  
  const isToday = fixtureDate.toDateString() === today.toDateString();
  const isTomorrow = fixtureDate.toDateString() === tomorrow.toDateString();
  
  let dateDisplay: string;
  if (status === 'UNKNOWN') {
    dateDisplay = '일정 미정';
  } else if (isToday) {
    dateDisplay = `오늘 ${fixtureDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isTomorrow) {
    dateDisplay = `내일 ${fixtureDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    dateDisplay = fixtureDate.toLocaleDateString('ko-KR', { 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  const statusDisplay: Record<string, string> = {
    'SCHEDULED': '경기 예정',
    'POSTPONED': '연기됨',
    'CANCELED': '취소됨',
  };

  const statusColor: Record<string, string> = {
    'SCHEDULED': 'bg-green-900/50 text-green-300 border border-green-700',
    'POSTPONED': 'bg-red-900/50 text-red-300 border border-red-700',
  };

  return (
    <div className="border border-slate-600 rounded-lg p-4 hover:border-blue-400 transition-colors bg-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[status] || 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
            {statusDisplay[status] || status}
          </span>
          <span className="text-sm text-slate-400">{round}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{dateDisplay}</div>
          {venueName && (
            <div className="text-xs text-slate-400">{venueName}</div>
          )}
        </div>
      </div>

      {showTeams && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <Link to={`/teams/${homeTeam?.id || fixture.homeTeamId}`} className="flex items-center space-x-2 group">
              {homeTeam?.badgeUrl && (
                <img 
                  src={homeTeam.badgeUrl} 
                  alt={homeTeam.name}
                  className="w-6 h-6 object-contain"
                />
              )}
              <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                {homeTeam?.name || `Team ${fixture.homeTeamId}`}
              </span>
            </Link>
          </div>
          
          <div className="px-4 text-slate-400 font-bold">VS</div>
          
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <Link to={`/teams/${awayTeam?.id || fixture.awayTeamId}`} className="flex items-center space-x-2 group">
              <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                {awayTeam?.name || `Team ${fixture.awayTeamId}`}
              </span>
              {awayTeam?.badgeUrl && (
                <img 
                  src={awayTeam.badgeUrl} 
                  alt={awayTeam.name}
                  className="w-6 h-6 object-contain"
                />
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}