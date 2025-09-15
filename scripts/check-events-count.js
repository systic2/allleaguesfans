// check-events-count.js - events 테이블 현재 상태 확인
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function checkEventsCount() {
  console.log('📊 현재 events 테이블 상태 확인...');
  
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    console.log(`🔢 현재 events 레코드 수: ${count?.toLocaleString()}개`);
    
    if (count === 0) {
      console.log('✅ events 테이블이 완전히 비어있습니다!');
      console.log('🎯 다음 단계: 새로운 데이터 임포트 준비 완료');
    } else {
      console.log(`🔄 아직 ${count?.toLocaleString()}개 레코드가 남아있습니다.`);
      console.log('⏳ 정리 작업이 계속 진행 중입니다...');
    }
    
  } catch (error) {
    console.error('❌ 확인 실패:', error.message);
  }
}

async function main() {
  console.log('🚀 Events 테이블 상태 확인');
  console.log('=====================================');
  
  await checkEventsCount();
}

main().catch(console.error);