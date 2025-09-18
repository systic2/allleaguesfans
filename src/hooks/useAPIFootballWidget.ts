import { useEffect, useState } from 'react';

/**
 * API-Football 위젯 스크립트를 관리하는 커스텀 훅
 * 여러 위젯이 같은 페이지에 있을 때 스크립트 중복 로딩을 방지
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
 * API-Football API 키를 안전하게 가져오는 함수
 */
export function useAPIFootballKey() {
  const apiKey = import.meta.env.VITE_API_FOOTBALL_KEY;
  
  return {
    apiKey,
    hasApiKey: !!apiKey,
    keyMasked: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : null
  };
}