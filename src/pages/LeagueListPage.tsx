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
      className="group block bg-slate-800 hover:bg-slate-700 rounded-lg p-6 transition-all duration-200 border border-slate-700 hover:border-slate-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-white text-lg font-semibold group-hover:text-blue-400 transition-colors">
            {league.name}
          </h3>
          <div className="flex items-center space-x-4 mt-2 text-slate-400 text-sm">
            <span>ID: {league.id}</span>
            {league.tier && <span>Tier {league.tier}</span>}
          </div>
        </div>
        <div className="text-slate-400 group-hover:text-blue-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-700 group-hover:border-slate-600">
        <div className="flex items-center text-slate-400 text-sm">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>순위표와 팀 정보 보기</span>
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
            limit={8}
            className="bg-slate-800"
            useTheSportsDB={true}
          />
        </div>
      </div>
    </div>
  );
}