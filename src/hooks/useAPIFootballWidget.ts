import { useEffect, useState } from 'react';

/**
 * API-Football Widget Script Management Hook
 * 
 * Manages the loading and initialization of API-Football widget scripts.
 * Prevents duplicate script loading when multiple widgets are present on the same page.
 * 
 * @returns Object containing script loading state and error information
 * @example
 * ```tsx
 * function MyWidget() {
 *   const { scriptLoaded, error } = useAPIFootballWidget();
 *   
 *   if (error) return <div>Error: {error}</div>;
 *   if (!scriptLoaded) return <div>Loading...</div>;
 *   
 *   return <div data-widget="games">Widget content</div>;
 * }
 * ```
 */
export function useAPIFootballWidget() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 이미 로드된 스크립트가 있는지 확인
    const existingScript = document.querySelector('script[src*="widgets.api-sports.io"]');
    
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    // 스크립트 동적 로딩
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://widgets.api-sports.io/2.0.3/widgets.js';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ API-Football 위젯 스크립트 로드 완료');
      setScriptLoaded(true);
      setError(null);
    };
    
    script.onerror = () => {
      console.error('❌ API-Football 위젯 스크립트 로드 실패');
      setError('위젯 스크립트를 로드할 수 없습니다. 네트워크를 확인해주세요.');
    };

    // DOM에 추가
    document.head.appendChild(script);
    
    // 메모리 누수 방지를 위해 이벤트 리스너 정리
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  return { scriptLoaded, error };
}

/**
 * API-Football API Key Management Hook
 * 
 * Securely manages the API-Football API key from environment variables.
 * Provides validation and masked display for security purposes.
 * 
 * @returns Object containing API key information and validation state
 * @example
 * ```tsx
 * function SecureWidget() {
 *   const { apiKey, hasApiKey, keyMasked } = useAPIFootballKey();
 *   
 *   if (!hasApiKey) {
 *     return <div>Please set VITE_API_FOOTBALL_KEY in environment</div>;
 *   }
 *   
 *   console.log(`Using key: ${keyMasked}`); // Safe for logging
 *   return <WidgetComponent apiKey={apiKey} />;
 * }
 * ```
 */
export function useAPIFootballKey() {
  const apiKey = import.meta.env.VITE_API_FOOTBALL_KEY;
  
  return {
    apiKey,
    hasApiKey: !!apiKey,
    keyMasked: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : null
  };
}