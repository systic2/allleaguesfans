// clear-events-table.js - events 테이블 완전 정리
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function clearEventsTable() {
  console.log('🗑️ events 테이블 완전 정리 시작...');
  
  try {
    // 현재 레코드 수 확인
    const { count: beforeCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 정리 전 events 테이블: ${beforeCount}개 레코드`);
    
    // 배치로 삭제 (한 번에 너무 많으면 타임아웃)
    let deletedTotal = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batchToDelete } = await supabase
        .from('events')
        .select('id')
        .limit(batchSize);
      
      if (!batchToDelete || batchToDelete.length === 0) {
        break;
      }
      
      console.log(`🔄 ${batchToDelete.length}개 레코드 삭제 중...`);
      
      const ids = batchToDelete.map(row => row.id);
      const { error, count: _count } = await supabase
        .from('events')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error('❌ 삭제 실패:', error.message);
        break;
      }
      
      deletedTotal += batchToDelete.length;
      console.log(`✅ 누적 삭제: ${deletedTotal}개`);
      
      // 잠시 대기 (API 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 최종 확인
    const { count: afterCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`🎉 정리 완료! 남은 레코드: ${afterCount}개`);
    console.log(`📈 총 삭제: ${beforeCount - afterCount}개 레코드`);
    
    return true;
    
  } catch (error) {
    console.error('❌ events 테이블 정리 실패:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 중복 데이터 완전 정리');
  console.log('=====================================');
  
  const success = await clearEventsTable();
  
  if (success) {
    console.log('\n✅ 정리 완료!');
    console.log('🎯 다음 단계: master-import.ts로 새로운 데이터 임포트');
  } else {
    console.log('\n❌ 정리 실패');
  }
}

main().catch(console.error);