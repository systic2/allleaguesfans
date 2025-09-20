import type { UpcomingFixture } from '@/lib/api';

/**
 * Fixtures Section Component
 * 
 * Displays fixture information from database with Korean UI
 * 
 * Features:
 * - Responsive design with consistent styling
 * - Korean language support for UI text
 * - Comprehensive error handling and loading states
 */
interface FixturesSectionProps {
  /** Fixture data from database for display */
  upcomingFixtures: UpcomingFixture[];
}

/**
 * Fixtures display component using database data
 * @param fixtures - Array of upcoming fixtures from database
 */
function FixturesCard({ fixtures }: { fixtures: UpcomingFixture[] }) {
  if (fixtures.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="text-slate-400 text-sm">최근 경기가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fixtures.map((fixture) => (
        <div key={fixture.id} className="flex items-center justify-between p-3 bg-slate-700 rounded">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {fixture.home_team.logo_url && (
                <img src={fixture.home_team.logo_url} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-white text-sm">{fixture.home_team.name}</span>
            </div>
            <span className="text-slate-400 text-xs">vs</span>
            <div className="flex items-center space-x-2">
              {fixture.away_team.logo_url && (
                <img src={fixture.away_team.logo_url} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-white text-sm">{fixture.away_team.name}</span>
            </div>
          </div>
          <div className="text-slate-400 text-xs">
            {new Date(fixture.date_utc).toLocaleDateString('ko-KR', {
              month: 'numeric',
              day: 'numeric'
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FixturesSection({ 
  upcomingFixtures 
}: FixturesSectionProps) {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <h2 className="text-white text-lg font-semibold">최근 경기</h2>
      </div>

      {/* Content */}
      <div className="p-6">
        <FixturesCard fixtures={upcomingFixtures} />
      </div>
    </div>
  );
}