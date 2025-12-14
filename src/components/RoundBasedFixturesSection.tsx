import { useQuery } from '@tanstack/react-query';
import { fetchRecentRoundFixtures, fetchUpcomingRoundFixtures } from '@/lib/api';
import { MatchWithTeams } from '@/lib/thesportsdb-api'; // Import MatchWithTeams

interface RoundBasedFixturesSectionProps {
  leagueId: number;
  season?: string; // Change from number to string
}

interface FixturesCardProps {
  title: string;
  fixtures: MatchWithTeams[]; // Changed from RoundFixture[]
  isLoading: boolean;
  error?: Error | null;
  showScores?: boolean;
}

function FixturesCard({ title, fixtures, isLoading, error, showScores = false }: FixturesCardProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <div className="text-red-400 text-sm">
            경기 정보를 불러올 수 없습니다.
          </div>
        </div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <div className="text-slate-400 text-sm">
            경기가 없습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-white text-lg font-semibold">{title}</h2>
        {fixtures.length > 0 && fixtures[0].round && (
          <div className="text-slate-400 text-sm mt-1">
            Round {fixtures[0].round}
          </div>
        )}
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {fixtures.map((fixture) => (
            <FixtureRow 
              key={fixture.id} 
              fixture={fixture} 
              showScores={showScores}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface FixtureRowProps {
  fixture: MatchWithTeams; // Changed from RoundFixture
  showScores: boolean;
}

function FixtureRow({ fixture, showScores }: FixtureRowProps) {
  const isCompleted = ['FT', 'AET', 'PEN', 'FINISHED'].includes(fixture.status); // Use fixture.status
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null; // Use homeScore, awayScore
  const isLive = ['IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(fixture.status);
  const isPostponed = ['POSTPONED', 'SUSP', 'INT'].includes(fixture.status);


  return (
    <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
      <div className="flex items-center space-x-3 flex-1">
        {/* Home Team */}
        <div className="flex items-center space-x-2 flex-1">
          {fixture.homeTeam?.badgeUrl && ( // Use homeTeam?.badgeUrl
            <img 
              src={fixture.homeTeam.badgeUrl} // Use homeTeam?.badgeUrl
              alt="" 
              className="w-5 h-5 object-contain" 
            />
          )}
          <span className="text-white text-sm font-medium">
            {fixture.homeTeam?.name || `Team ${fixture.homeTeamId}`} {/* Use homeTeam?.name */}
          </span>
        </div>

        {/* Score or VS */}
        <div className="flex items-center space-x-2 min-w-[60px] justify-center">
          {showScores && hasScore ? (
            <div className="flex items-center space-x-1">
              <span className={`text-lg font-bold ${
                isCompleted ? 'text-white' : 'text-slate-300'
              }`}>
                {fixture.homeScore} {/* Use homeScore */}
              </span>
              <span className="text-slate-400 text-sm">-</span>
              <span className={`text-lg font-bold ${
                isCompleted ? 'text-white' : 'text-slate-300'
              }`}>
                {fixture.awayScore} {/* Use awayScore */}
              </span>
            </div>
          ) : isLive ? (
            <span className="text-red-500 animate-pulse text-[10px]">LIVE</span>
          ) : isPostponed ? (
            <span className="text-yellow-500 text-[10px]">연기됨</span>
          ) : (
            <span className="text-slate-400 text-xs">vs</span>
          )}
        </div>

        {/* Away Team */}
        <div className="flex items-center space-x-2 flex-1 justify-end">
          <span className="text-white text-sm font-medium">
            {fixture.awayTeam?.name || `Team ${fixture.awayTeamId}`} {/* Use awayTeam?.name */}
          </span>
          {fixture.awayTeam?.badgeUrl && ( // Use awayTeam?.badgeUrl
            <img 
              src={fixture.awayTeam.badgeUrl} // Use awayTeam?.badgeUrl
              alt="" 
              className="w-5 h-5 object-contain" 
            />
          )}
        </div>
      </div>

      {/* Date and Status */}
      <div className="text-slate-400 text-xs ml-4 text-right min-w-[80px]">
        <div>
          {new Date(fixture.date).toLocaleDateString('ko-KR', { // Use fixture.date
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        {!isCompleted && (
          <div className="text-slate-500 text-xs mt-1">
            {fixture.status} {/* Use fixture.status */}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoundBasedFixturesSection({ 
  leagueId, 
  season = '2025' // Change default season to string
}: RoundBasedFixturesSectionProps) {
  const { 
    data: recentFixtures = [], 
    isLoading: recentLoading, 
    error: recentError 
  } = useQuery({
    queryKey: ["recentRoundFixtures", leagueId, season],
    queryFn: () => fetchRecentRoundFixtures(leagueId, season),
    enabled: !!leagueId,
  });

  const { 
    data: upcomingFixtures = [], 
    isLoading: upcomingLoading, 
    error: upcomingError 
  } = useQuery({
    queryKey: ["upcomingRoundFixtures", leagueId, season],
    queryFn: () => fetchUpcomingRoundFixtures(leagueId, season),
    enabled: !!leagueId,
  });

  return (
    <div className="space-y-6">
      {/* Recent Matches - Latest Completed Round */}
      <FixturesCard
        title="최근 경기"
        fixtures={recentFixtures}
        isLoading={recentLoading}
        error={recentError}
        showScores={true}
      />

      {/* Upcoming Matches - Next Round */}
      <FixturesCard
        title="예정 경기"
        fixtures={upcomingFixtures}
        isLoading={upcomingLoading}
        error={upcomingError}
        showScores={false}
      />
    </div>
  );
}