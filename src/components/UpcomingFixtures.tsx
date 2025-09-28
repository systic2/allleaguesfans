import { useQuery } from "@tanstack/react-query";
import { 
  fetchEnhancedUpcomingFixtures, 
  fetchEnhancedTeamUpcomingFixtures, 
  type EnhancedUpcomingFixture 
} from "@/lib/enhanced-fixtures-api";
import { 
  fetchKLeague1UpcomingFixtures,
  fetchKLeague2UpcomingFixtures,
  type TheSportsDBFixture
} from "@/lib/thesportsdb-api";

// Utility function to convert any time to Korean timezone (KST = UTC+9)
const convertToKoreanTime = (dateStr: string): Date => {
  const date = new Date(dateStr);
  
  // If the date is invalid, try parsing differently
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  
  // Check if the date is already in UTC (assumes most API dates are UTC)
  // Add 9 hours for Korean Standard Time
  return new Date(date.getTime() + (9 * 60 * 60 * 1000));
};

// Convert TheSportsDBFixture to EnhancedUpcomingFixture format
function convertTheSportsDBToEnhanced(fixtures: TheSportsDBFixture[]): EnhancedUpcomingFixture[] {
  return fixtures.map(fixture => ({
    id: parseInt(fixture.id), // Convert string to number
    league_id: parseInt(fixture.league_id),
    date_utc: fixture.date_utc,
    status: fixture.status === 'Not Started' ? 'NS' : fixture.status === 'TBD' ? 'TBD' : fixture.status,
    round: `라운드 ${fixture.round}`,
    home_team: {
      id: parseInt(fixture.home_team.id),
      name: fixture.home_team.name,
      logo_url: fixture.home_team.badge_url || null,
      highlightly_logo: null
    },
    away_team: {
      id: parseInt(fixture.away_team.id),
      name: fixture.away_team.name,
      logo_url: fixture.away_team.badge_url || null,
      highlightly_logo: null
    },
    venue: fixture.venue
  }));
}

interface UpcomingFixturesProps {
  teamId?: number;
  leagueId?: number;
  title?: string;
  limit?: number;
  className?: string;
  useTheSportsDB?: boolean; // Use TheSportsDB API for K League fixtures
}

export default function UpcomingFixtures({ 
  teamId, 
  leagueId, 
  title = "다음 경기", 
  limit = 5,
  className = "",
  useTheSportsDB = false
}: UpcomingFixturesProps) {
  
  // TheSportsDB API를 사용하는 경우의 쿼리
  const theSportsDBQuery = useQuery({
    queryKey: ["thesportsdb-k-league-upcoming"],
    queryFn: async () => {
      const [kLeague1Fixtures, kLeague2Fixtures] = await Promise.all([
        fetchKLeague1UpcomingFixtures(),
        fetchKLeague2UpcomingFixtures()
      ]);
      
      const allFixtures = [...kLeague1Fixtures, ...kLeague2Fixtures];
      
      // Sort by date and limit results
      const sortedFixtures = allFixtures
        .filter(fixture => fixture.is_upcoming)
        .sort((a, b) => new Date(a.date_utc).getTime() - new Date(b.date_utc).getTime())
        .slice(0, limit);
      
      return convertTheSportsDBToEnhanced(sortedFixtures);
    },
    enabled: useTheSportsDB && !teamId, // Only for league-wide fixtures, not team-specific
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 기존 enhanced fixtures API를 사용하는 경우의 쿼리
  const enhancedQuery = useQuery({
    queryKey: teamId ? ["enhanced-team-upcoming-fixtures", teamId] : ["enhanced-upcoming-fixtures", leagueId],
    queryFn: () => {
      if (teamId) {
        return fetchEnhancedTeamUpcomingFixtures(teamId, limit);
      } else {
        return fetchEnhancedUpcomingFixtures(leagueId, limit);
      }
    },
    enabled: !useTheSportsDB, // Only when not using TheSportsDB
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 사용할 쿼리 결과 선택
  const activeQuery = useTheSportsDB ? theSportsDBQuery : enhancedQuery;
  const { data: fixtures, isLoading, error } = activeQuery;

  if (isLoading) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-600 rounded"></div>
                <div>
                  <div className="w-32 h-4 bg-slate-600 rounded mb-1"></div>
                  <div className="w-24 h-3 bg-slate-600 rounded"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="w-16 h-4 bg-slate-600 rounded mb-1"></div>
                <div className="w-12 h-3 bg-slate-600 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="text-center text-slate-400 py-8">
          <p>예정된 경기를 불러오는데 실패했습니다.</p>
        </div>
      </div>
    );
  }

  if (!fixtures || fixtures.length === 0) {
    return (
      <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <div className="text-center text-slate-400 py-8">
          <div className="w-16 h-16 mx-auto mb-4 opacity-50">
            📅
          </div>
          <p className="text-lg font-medium mb-2">예정된 경기가 없습니다</p>
          <p className="text-sm">새로운 시즌이나 컵 대회 일정을 기다려주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-600 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {useTheSportsDB && (
          <div className="text-slate-400 text-xs bg-green-600/20 px-2 py-1 rounded border border-green-600/30">
            TheSportsDB
          </div>
        )}
      </div>
      <div className="space-y-4">
        {fixtures.map((fixture) => (
          <FixtureCard 
            key={fixture.id} 
            fixture={fixture} 
            showTeams={!teamId} 
            useTheSportsDB={useTheSportsDB}
          />
        ))}
      </div>
    </div>
  );
}

interface FixtureCardProps {
  fixture: EnhancedUpcomingFixture;
  showTeams?: boolean;
  useTheSportsDB?: boolean;
}

function FixtureCard({ fixture, showTeams = true, useTheSportsDB = false }: FixtureCardProps) {
  // Use Korean timezone conversion for TheSportsDB fixtures
  const fixtureDate = useTheSportsDB 
    ? convertToKoreanTime(fixture.date_utc)
    : new Date(fixture.date_utc);
    
  const now = new Date();
  const today = useTheSportsDB ? convertToKoreanTime(now.toISOString()) : now;
  const tomorrow = new Date(today.getTime() + 86400000);
  
  const isToday = fixtureDate.toDateString() === today.toDateString();
  const isTomorrow = fixtureDate.toDateString() === tomorrow.toDateString();
  
  let dateDisplay: string;
  if (fixture.status === 'TBD') {
    dateDisplay = '일정 미정';
  } else if (isToday) {
    const timeStr = fixtureDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    dateDisplay = useTheSportsDB ? `오늘 ${timeStr} KST` : `오늘 ${timeStr}`;
  } else if (isTomorrow) {
    const timeStr = fixtureDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    dateDisplay = useTheSportsDB ? `내일 ${timeStr} KST` : `내일 ${timeStr}`;
  } else {
    const dateTimeStr = fixtureDate.toLocaleDateString('ko-KR', { 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    dateDisplay = useTheSportsDB ? `${dateTimeStr} KST` : dateTimeStr;
  }

  const statusDisplay = {
    'TBD': '일정 미정',
    'NS': '경기 예정',
    'PST': '연기됨'
  }[fixture.status] || fixture.status;

  const statusColor = {
    'TBD': 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
    'NS': 'bg-green-900/50 text-green-300 border border-green-700',
    'PST': 'bg-red-900/50 text-red-300 border border-red-700'
  }[fixture.status] || 'bg-slate-700 text-slate-300 border border-slate-600';

  return (
    <div className="border border-slate-600 rounded-lg p-4 hover:border-blue-400 transition-colors bg-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {statusDisplay}
          </span>
          <span className="text-sm text-slate-400">{fixture.round}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{dateDisplay}</div>
          {fixture.venue && (
            <div className="text-xs text-slate-400">{fixture.venue}</div>
          )}
        </div>
      </div>

      {showTeams && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex items-center space-x-2">
              {fixture.home_team.logo_url && (
                <div className="relative">
                  <img 
                    src={fixture.home_team.logo_url} 
                    alt={fixture.home_team.name}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      // Hide broken images
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {fixture.home_team.highlightly_logo && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" 
                         title="Enhanced logo from Highlightly API" />
                  )}
                </div>
              )}
              <span className="font-medium text-white">{fixture.home_team.name}</span>
            </div>
          </div>
          
          <div className="px-4 text-slate-400 font-bold">VS</div>
          
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white">{fixture.away_team.name}</span>
              {fixture.away_team.logo_url && (
                <div className="relative">
                  <img 
                    src={fixture.away_team.logo_url} 
                    alt={fixture.away_team.name}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      // Hide broken images
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {fixture.away_team.highlightly_logo && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" 
                         title="Enhanced logo from Highlightly API" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}