// src/components/TheSportsDBFixturesSection.tsx
// REFACTORED to use JOINed team data
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  fetchRecentMatches,
  fetchUpcomingMatches,
  type DatabaseFixture 
} from '@/lib/database-fixtures-api';

interface TheSportsDBFixturesSectionProps {
  leagueId?: number;
  leagueSlug?: string;
}

function FixturesCard({ title, fixtures, isLoading, error, showScores = false }: {
  title: string;
  fixtures: DatabaseFixture[];
  isLoading: boolean;
  error?: Error | null;
  showScores?: boolean;
}) {
  if (isLoading) {
    // ... (loading state remains the same)
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6"><div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="animate-pulse"><div className="h-16 bg-slate-700 rounded"></div></div>))}</div></div>
      </div>
    );
  }

  if (error) {
    // ... (error state remains the same)
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6"><div className="text-red-400 text-sm">경기 정보를 불러올 수 없습니다.</div></div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    // ... (empty state remains the same)
    return (
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6"><div className="text-slate-400 text-sm">경기가 없습니다.</div></div>
      </div>
    );
  }

  const rounds = fixtures.reduce((acc, fixture) => {
    const round = fixture.round || 'N/A';
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(fixture);
    return acc;
  }, {} as Record<string, DatabaseFixture[]>);

  const sortedRounds = Object.keys(rounds).sort((a, b) => {
    const aNum = parseInt(a.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.replace(/\D/g, '')) || 0;
    return showScores ? bNum - aNum : aNum - bNum;
  });

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-white text-lg font-semibold">{title}</h2>
        {sortedRounds.length > 0 && (
          <div className="text-slate-400 text-sm mt-1">
            라운드 {sortedRounds[0]}
          </div>
        )}
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {sortedRounds.slice(0, 2).map(round => (
            <div key={round}>
              {sortedRounds.length > 1 && (
                <div className="text-slate-400 text-xs mb-2 font-medium">
                  라운드 {round}
                </div>
              )}
              <div className="space-y-3">
                {rounds[round].map((fixture: DatabaseFixture) => (
                  <TheSportsDBFixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    showScores={showScores}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TheSportsDBFixtureRowProps {
  fixture: DatabaseFixture;
  showScores: boolean;
}

function TheSportsDBFixtureRow({ fixture, showScores }: TheSportsDBFixtureRowProps) {
  const isCompleted = fixture.status === 'FINISHED';
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null;

  const formatDateKorean = (fixture: DatabaseFixture) => {
    try {
      const date = new Date(fixture.date);
      if (isNaN(date.getTime())) return fixture.date;
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch (error) {
      console.warn('Date formatting error:', error);
      return fixture.date;
    }
  };

  const formatStatus = (status: DatabaseFixture['status']) => {
    const statusMap: Record<DatabaseFixture['status'], string> = {
      'SCHEDULED': '예정',
      'FINISHED': '종료',
      'POSTPONED': '연기',
      'CANCELED': '취소',
      'IN_PLAY': '진행중',
      'LIVE': '진행중',
      'UNKNOWN': '미정',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {fixture.homeTeam?.badgeUrl && (
                <img src={fixture.homeTeam.badgeUrl} alt={fixture.homeTeam.name} className="w-5 h-5 object-contain" />
              )}
              <span className="text-white text-sm font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={fixture.homeTeam?.name || fixture.homeTeamId}>
                {fixture.homeTeam?.name || `Team ${fixture.homeTeamId}`}
              </span>
            </div>

            <div className="flex items-center justify-center px-3">
              {showScores && hasScore ? (
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold ${isCompleted ? 'text-white' : 'text-slate-300'}`}>
                    {fixture.homeScore}
                  </span>
                  <span className="text-slate-400 text-sm">-</span>
                  <span className={`text-lg font-bold ${isCompleted ? 'text-white' : 'text-slate-300'}`}>
                    {fixture.awayScore}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs font-medium bg-slate-600 px-2 py-1 rounded">
                  VS
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 flex-1 justify-end min-w-0">
              <span className="text-white text-sm font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right" title={fixture.awayTeam?.name || fixture.awayTeamId}>
                {fixture.awayTeam?.name || `Team ${fixture.awayTeamId}`}
              </span>
              {fixture.awayTeam?.badgeUrl && (
                <img src={fixture.awayTeam.badgeUrl} alt={fixture.awayTeam.name} className="w-5 h-5 object-contain" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2 text-slate-400">
            <span className="font-medium whitespace-nowrap" title="한국 시간 (KST)">
              {formatDateKorean(fixture)} <span className="text-slate-500 text-xs">KST</span>
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              isCompleted ? 'bg-green-600 text-white' : 
              fixture.status === 'SCHEDULED' ? 'bg-blue-600 text-white' :
              'bg-slate-600 text-slate-300'
            }`}>
              {formatStatus(fixture.status)}
            </span>
          </div>
          {fixture.venueName && (
            <div className="text-slate-500 text-xs sm:max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={fixture.venueName}>
              📍 {fixture.venueName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TheSportsDBFixturesSection({ 
  leagueId, 
  leagueSlug 
}: TheSportsDBFixturesSectionProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'upcoming'>('recent');

  const effectiveLeagueSlug = leagueSlug || (leagueId ? 
    (leagueId === 4001 || leagueId === 1 ? 'k-league-1' : 
     leagueId === 4002 || leagueId === 2 ? 'k-league-2' : 
     `league-${leagueId}`) : 'k-league-1');

  const { 
    data: recentFixtures = [], 
    isLoading: recentLoading, 
    error: recentError 
  } = useQuery({
    queryKey: ["v2-databaseRecentFixtures", effectiveLeagueSlug],
    queryFn: () => fetchRecentMatches(effectiveLeagueSlug, 2025, 10),
    enabled: !!effectiveLeagueSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { 
    data: upcomingFixtures = [], 
    isLoading: upcomingLoading, 
    error: upcomingError 
  } = useQuery({
    queryKey: ["v2-databaseUpcomingFixtures", effectiveLeagueSlug],
    queryFn: () => fetchUpcomingMatches(effectiveLeagueSlug, 2025, 10),
    enabled: !!effectiveLeagueSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isLoading = recentLoading || upcomingLoading;
  const error = recentError || upcomingError;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'recent'
                ? 'bg-slate-700 text-white border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            최근 경기
            {recentFixtures.length > 0 && (
              <span className="ml-2 text-xs bg-slate-600 px-2 py-1 rounded">
                {recentFixtures.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-slate-700 text-white border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            예정 경기
            {upcomingFixtures.length > 0 && (
              <span className="ml-2 text-xs bg-slate-600 px-2 py-1 rounded">
                {upcomingFixtures.length}
              </span>
            )}
          </button>
        </div>
        <div className="p-6">
          {activeTab === 'recent' ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-slate-700 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-red-400 text-sm">
                  경기 정보를 불러올 수 없습니다.
                </div>
              ) : recentFixtures.length === 0 ? (
                <div className="text-slate-400 text-sm">
                  최근 경기가 없습니다.
                </div>
              ) : (
                recentFixtures.slice(0, 10).map((fixture: DatabaseFixture) => (
                  <TheSportsDBFixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    showScores={true}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-slate-700 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-red-400 text-sm">
                  경기 정보를 불러올 수 없습니다.
                </div>
              ) : upcomingFixtures.length === 0 ? (
                <div className="text-slate-400 text-sm">
                  예정된 경기가 없습니다.
                </div>
              ) : (
                upcomingFixtures.slice(0, 10).map((fixture: DatabaseFixture) => (
                  <TheSportsDBFixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    showScores={false}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-500 text-xs">
          제공: TheSportsDB • 리그: {effectiveLeagueSlug}
        </div>
      </div>
    </div>
  );
}