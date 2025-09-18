import { useAPIFootballWidget, useAPIFootballKey } from '@/hooks/useAPIFootballWidget';

/**
 * API-Football Games Widget Component
 * 
 * A React wrapper for the API-Football Games widget that provides:
 * - Real-time fixture updates every 15 seconds
 * - Interactive modals for match details and standings
 * - Dark theme integration with existing design
 * - Comprehensive error handling and loading states
 * - Secure API key management
 * 
 * @example
 * ```tsx
 * <APIFootballGamesWidget 
 *   leagueId={292}  // K League 1
 *   season={2025}
 *   className="additional-styling"
 * />
 * ```
 */
interface APIFootballGamesWidgetProps {
  /** League ID (K League 1: 292, K League 2: 293) */
  leagueId: number;
  /** Season year (e.g., 2025) */
  season: number;
  /** Additional CSS classes for styling */
  className?: string;
}

/**
 * API-Football Games Widget wrapper component
 * 
 * Handles widget initialization, error states, and provides a seamless integration
 * with the existing React application architecture.
 * 
 * @param props - Component props
 * @returns JSX element containing the widget or appropriate error/loading state
 */
export default function APIFootballGamesWidget({ 
  leagueId, 
  season, 
  className = '' 
}: APIFootballGamesWidgetProps) {
  // 커스텀 훅 사용
  const { scriptLoaded, error: scriptError } = useAPIFootballWidget();
  const { apiKey, hasApiKey } = useAPIFootballKey();
  
  // 고유 위젯 ID 생성 (리그별로 구분)
  const widgetId = `wg-api-football-games-${leagueId}`;
  
  // 전체 에러 상태 결합
  const error = scriptError || (!hasApiKey ? 'API-Football 키가 설정되지 않았습니다.' : null);

  // API 키가 없는 경우
  if (!hasApiKey) {
    return (
      <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ 설정 필요</div>
          <div className="text-slate-400 text-sm">
            API-Football 위젯을 사용하려면 환경 변수에 VITE_API_FOOTBALL_KEY를 설정해주세요.
          </div>
        </div>
      </div>
    );
  }

  // 에러가 발생한 경우
  if (error) {
    return (
      <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">❌ 오류 발생</div>
          <div className="text-slate-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 rounded-lg overflow-hidden ${className}`}>
      {/* 헤더 */}
      <div className="bg-slate-700 px-6 py-4 border-b border-slate-600">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">경기 일정 & 결과</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-slate-400 text-xs">실시간</span>
          </div>
        </div>
      </div>

      {/* 위젯 컨테이너 */}
      <div className="p-4">
        {!scriptLoaded ? (
          // 로딩 상태
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <div className="text-slate-400 text-sm mt-2">위젯을 로드하는 중...</div>
          </div>
        ) : (
          // 위젯 div
          <div 
            id={widgetId}
            data-host="v3.football.api-sports.io"
            data-key={apiKey}
            data-league={leagueId.toString()}
            data-season={season.toString()}
            data-theme="dark"
            data-refresh="15"
            data-show-toolbar="true"
            data-show-logos="true"
            data-modal-game="true"
            data-modal-standings="true"
            data-modal-show-logos="true"
            data-show-errors={process.env.NODE_ENV === 'development' ? "true" : "false"}
            className="api-football-widget"
            style={{ minHeight: '400px' }}
          />
        )}
      </div>

      {/* 푸터 정보 */}
      <div className="bg-slate-750 px-6 py-2 border-t border-slate-600">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Powered by API-Football</span>
          <span>15초마다 자동 업데이트</span>
        </div>
      </div>
    </div>
  );
}