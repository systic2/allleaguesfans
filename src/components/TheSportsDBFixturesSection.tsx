// src/components/TheSportsDBFixturesSection.tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  fetchRecentMatches,
  fetchUpcomingMatches,
  type DatabaseFixture 
} from '@/lib/database-fixtures-api';

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

interface TheSportsDBFixturesSectionProps {
  leagueId?: number; // Legacy support
  leagueSlug?: string; // New slug-based approach
}

interface FixturesCardProps {
  title: string;
  fixtures: DatabaseFixture[];
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
                <div className="h-16 bg-slate-700 rounded"></div>
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

  // Group fixtures by round for better organization
  const rounds = fixtures.reduce((acc, fixture) => {
    const round = String(fixture.intRound);
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(fixture);
    return acc;
  }, {} as Record<string, DatabaseFixture[]>);

  const sortedRounds = Object.keys(rounds).sort((a, b) => {
    // Sort rounds numerically
    const aNum = parseInt(a.replace(/\D/g, ''));
    const bNum = parseInt(b.replace(/\D/g, ''));
    return showScores ? bNum - aNum : aNum - bNum; // Recent: descending, Upcoming: ascending
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
                {rounds[round].map((fixture) => (
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
  const isCompleted = fixture.strStatus === 'Match Finished';
  const hasScore = fixture.intHomeScore !== null && fixture.intAwayScore !== null;

  // Format fixture date and time in Korean timezone
  const formatDateKorean = (fixture: DatabaseFixture) => {
    try {
      // DatabaseFixture uses dateEvent field (format: "2025-04-27")
      const date = new Date(fixture.dateEvent);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return fixture.dateEvent; // Return raw date if parsing fails
      }
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      // For upcoming matches, we might not have specific times
      return `${month}/${day}`;
    } catch (error) {
      console.warn('Date formatting error:', error);
      return fixture.dateEvent;
    }
  };

  // Format status for display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'Not Started': '예정',
      'Match Finished': '종료',
      'TBD': '미정',
      'Postponed': '연기',
      'Cancelled': '취소',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Teams */}
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Home Team */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
{/* Team badges not available in database */}
              <span className="text-white text-sm font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={fixture.strHomeTeam}>
                {fixture.strHomeTeam}
              </span>
            </div>

            {/* Score or VS */}
            <div className="flex items-center justify-center px-3">
              {showScores && hasScore ? (
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold ${
                    isCompleted ? 'text-white' : 'text-slate-300'
                  }`}>
                    {fixture.intHomeScore}
                  </span>
                  <span className="text-slate-400 text-sm">-</span>
                  <span className={`text-lg font-bold ${
                    isCompleted ? 'text-white' : 'text-slate-300'
                  }`}>
                    {fixture.intAwayScore}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400 text-xs font-medium bg-slate-600 px-2 py-1 rounded">
                  VS
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center space-x-2 flex-1 justify-end min-w-0">
              <span className="text-white text-sm font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right" title={fixture.strAwayTeam}>
                {fixture.strAwayTeam}
              </span>
{/* Team badges not available in database */}
            </div>
          </div>
        </div>
      </div>

      {/* Date, Status, and Venue Info */}
      <div className="px-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2 text-slate-400">
            <span className="font-medium whitespace-nowrap" title="한국 시간 (KST)">
              {formatDateKorean(fixture)} <span className="text-slate-500 text-xs">KST</span>
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              isCompleted ? 'bg-green-600 text-white' : 
              fixture.strStatus === 'Not Started' ? 'bg-blue-600 text-white' :
              'bg-slate-600 text-slate-300'
            }`}>
              {formatStatus(fixture.strStatus)}
            </span>
          </div>
          {fixture.strVenue && (
            <div className="text-slate-500 text-xs sm:max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={fixture.strVenue}>
              📍 {fixture.strVenue}
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

  // Convert legacy leagueId to slug if needed
  const effectiveLeagueSlug = leagueSlug || (leagueId ? 
    (leagueId === 4001 || leagueId === 1 ? 'k-league-1' : 
     leagueId === 4002 || leagueId === 2 ? 'k-league-2' : 
     `league-${leagueId}`) : 'k-league-1');

  // Fetch recent matches using database
  const { 
    data: recentFixtures = [], 
    isLoading: recentLoading, 
    error: recentError 
  } = useQuery({
    queryKey: ["databaseRecentFixtures", effectiveLeagueSlug],
    queryFn: () => {
      console.log(`🔍 Fetching recent matches for: ${effectiveLeagueSlug}`);
      return fetchRecentMatches(effectiveLeagueSlug, 2025, 10);
    },
    enabled: !!effectiveLeagueSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch upcoming matches using database
  const { 
    data: upcomingFixtures = [], 
    isLoading: upcomingLoading, 
    error: upcomingError 
  } = useQuery({
    queryKey: ["databaseUpcomingFixtures", effectiveLeagueSlug],
    queryFn: () => {
      console.log(`🔮 Fetching upcoming matches for: ${effectiveLeagueSlug}`);
      return fetchUpcomingMatches(effectiveLeagueSlug, 2025, 10);
    },
    enabled: !!effectiveLeagueSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const isLoading = recentLoading || upcomingLoading;
  const error = recentError || upcomingError;

  // Debug logging
  console.log(`📊 Fixtures Debug - League: ${effectiveLeagueSlug}`, {
    recentFixtures: recentFixtures?.length || 0,
    upcomingFixtures: upcomingFixtures?.length || 0,
    isLoading,
    error: error?.message || null
  });

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
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

        {/* Tab Content */}
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
                recentFixtures.slice(0, 10).map((fixture) => (
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
                upcomingFixtures.slice(0, 10).map((fixture) => (
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

      {/* API Source Info */}
      <div className="text-center">
        <div className="text-slate-500 text-xs">
          제공: TheSportsDB • 리그: {effectiveLeagueSlug}
        </div>
      </div>
    </div>
  );
}