import { useState } from 'react';
import APIFootballGamesWidget from './APIFootballGamesWidget';
import type { UpcomingFixture } from '@/lib/api';

interface EnhancedFixturesSectionProps {
  leagueId: number;
  season: number;
  upcomingFixtures: UpcomingFixture[];
}

function UpcomingFixturesCard({ fixtures }: { fixtures: UpcomingFixture[] }) {
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

export default function EnhancedFixturesSection({ 
  leagueId, 
  season, 
  upcomingFixtures 
}: EnhancedFixturesSectionProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'live'>('upcoming');
  
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'upcoming' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              최근 경기
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 ${
                activeTab === 'live' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              <span>실시간</span>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </button>
          </div>
          
          {/* Tab 설명 */}
          <div className="text-xs text-slate-400">
            {activeTab === 'upcoming' 
              ? '데이터베이스 기반' 
              : 'API-Football 위젯'
            }
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={activeTab === 'live' ? '' : 'p-6'}>
        {activeTab === 'upcoming' ? (
          <UpcomingFixturesCard fixtures={upcomingFixtures} />
        ) : (
          <APIFootballGamesWidget 
            leagueId={leagueId} 
            season={season}
            className="rounded-none border-none"
          />
        )}
      </div>
    </div>
  );
}