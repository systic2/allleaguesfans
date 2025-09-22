import { useQuery } from "@tanstack/react-query";
import { fetchUpcomingFixtures, fetchTeamUpcomingFixtures, UpcomingFixture } from "@/lib/api";

interface UpcomingFixturesProps {
  teamId?: number;
  leagueId?: number;
  title?: string;
  limit?: number;
  className?: string;
}

export default function UpcomingFixtures({ 
  teamId, 
  leagueId, 
  title = "다음 경기", 
  limit = 5,
  className = ""
}: UpcomingFixturesProps) {
  const { data: fixtures, isLoading, error } = useQuery({
    queryKey: teamId ? ["team-upcoming-fixtures", teamId] : ["upcoming-fixtures", leagueId],
    queryFn: () => {
      if (teamId) {
        return fetchTeamUpcomingFixtures(teamId, limit);
      } else {
        return fetchUpcomingFixtures(leagueId, limit);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="space-y-4">
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} showTeams={!teamId} />
        ))}
      </div>
    </div>
  );
}

interface FixtureCardProps {
  fixture: UpcomingFixture;
  showTeams?: boolean;
}

function FixtureCard({ fixture, showTeams = true }: FixtureCardProps) {
  const fixtureDate = new Date(fixture.date_utc);
  const isToday = fixtureDate.toDateString() === new Date().toDateString();
  const isTomorrow = fixtureDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  
  let dateDisplay: string;
  if (fixture.status === 'TBD') {
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
                <img 
                  src={fixture.home_team.logo_url} 
                  alt={fixture.home_team.name}
                  className="w-6 h-6 object-contain"
                />
              )}
              <span className="font-medium text-white">{fixture.home_team.name}</span>
            </div>
          </div>
          
          <div className="px-4 text-slate-400 font-bold">VS</div>
          
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white">{fixture.away_team.name}</span>
              {fixture.away_team.logo_url && (
                <img 
                  src={fixture.away_team.logo_url} 
                  alt={fixture.away_team.name}
                  className="w-6 h-6 object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}