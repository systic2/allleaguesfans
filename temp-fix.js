// 브라우저 콘솔에서 실행할 임시 테스트 코드

// 1. 환경 변수 확인
console.log('🔍 환경 변수 상태:');
console.log('VITE_SEASON_YEAR:', import.meta.env.VITE_SEASON_YEAR);
console.log('전체 환경 변수:', import.meta.env);

// 2. Supabase 직접 테스트
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// 3. 순위표 데이터 직접 조회
const testStandings = async () => {
  console.log('📊 순위표 테스트 시작...');
  
  const season = Number(import.meta.env.VITE_SEASON_YEAR || 2025);
  console.log('사용 중인 시즌:', season);
  
  const { data, error } = await supabase
    .from('standings')
    .select(`
      team_id,
      position,
      points,
      played,
      teams!inner(name, code, logo_url)
    `)
    .eq('league_id', 4001)
    .eq('season_year', season)
    .order('position', { ascending: true });
  
  if (error) {
    console.error('❌ 순위표 오류:', error);
  } else {
    console.log('✅ 순위표 데이터:', data);
    console.log(`총 ${data?.length || 0}팀 조회됨`);
  }
};

// 실행
testStandings();