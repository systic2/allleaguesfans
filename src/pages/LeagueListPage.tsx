// src/pages/LeagueListPage.tsx
import { useQuery } from "@tanstack/react-query";
import { fetchLeagues, type LeagueLite } from "@/lib/api";
import { Link } from "react-router-dom";
import UpcomingFixtures from "@/components/UpcomingFixtures";

function LoadingState() {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-6 h-32"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
          <h2 className="text-red-400 text-lg font-semibold mb-2">오류 발생</h2>
          <p className="text-red-300">{message}</p>
        </div>
      </div>
    </div>
  );
}

function LeagueCard({ league }: { league: LeagueLite }) {
  return (
    <Link
      to={`/leagues/${league.slug}`}
      className="group block bg-slate-800 hover:bg-slate-700 rounded-lg overflow-hidden transition-all duration-200 border border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
    >
      {/* 배너 이미지 */}
      {league.banner_url && (
        <div className="h-24 bg-gradient-to-r from-slate-700 to-slate-600 relative overflow-hidden">
          <img 
            src={league.banner_url} 
            alt={`${league.name} banner`}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
            onError={(e) => {
              // 배너 이미지 로드 실패시 숨김
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* 리그 로고 */}
            {league.logo_url && (
              <div className="flex-shrink-0">
                <img 
                  src={league.logo_url} 
                  alt={`${league.name} logo`}
                  className="w-12 h-12 object-contain rounded-lg bg-white/10 p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="text-white text-xl font-bold group-hover:text-blue-400 transition-colors truncate">
                {league.name}
              </h3>
              {league.name_korean && league.name_korean !== league.name && (
                <p className="text-slate-300 text-sm mt-1 truncate">
                  {league.name_korean}
                </p>
              )}
              <div className="flex items-center space-x-3 mt-3 text-slate-400 text-sm">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {league.country_code || 'KR'}
                </span>
                {league.primary_source && (
                  <span className="bg-blue-600/20 px-2 py-1 rounded text-blue-300 text-xs font-medium">
                    {league.primary_source.toUpperCase()}
                  </span>
                )}
                {league.tier && (
                  <span className="bg-slate-600/50 px-2 py-1 rounded text-xs">
                    Tier {league.tier}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-slate-400 flex-shrink-0 ml-4">
            <svg 
              className="w-6 h-6 transform group-hover:translate-x-1 group-hover:text-blue-400 transition-all" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        
        {/* 추가 정보 표시 영역 */}
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>시즌 2025</span>
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              3-API 통합 데이터
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LeagueListPage() {
  const { data, isLoading, error } = useQuery<LeagueLite[]>({
    queryKey: ["leagues"],
    queryFn: fetchLeagues,
  });

  if (isLoading) return <LoadingState />;
  
  if (error) {
    return <ErrorState message="리그 목록을 불러오지 못했습니다." />;
  }

  const leagues = (data ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  );

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">리그</h1>
          <p className="text-slate-400">
            K리그 정보를 확인하고 팀별 순위표를 살펴보세요
          </p>
        </div>

        {/* 리그 카드 그리드 */}
        {leagues.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <div className="text-slate-400 mb-2">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
              </svg>
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">리그 정보 없음</h3>
            <p className="text-slate-400">현재 표시할 리그 정보가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        )}

        {/* 통계 정보 */}
        {leagues.length > 0 && (
          <div className="mt-8 bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">리그 통계</h3>
                <p className="text-slate-400 text-sm mt-1">
                  총 {leagues.length}개 리그가 등록되어 있습니다
                </p>
              </div>
              <div className="text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* 예정된 경기 */}
        <div className="mt-8">
          <UpcomingFixtures
            title="🗓️ K리그 예정 경기"
            limit={20}
            className="bg-slate-800"
            useTheSportsDB={true}
          />
        </div>
      </div>
    </div>
  );
}