// check-fixture-events.js - fixture_events 테이블 상태 확인
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function checkFixtureEventsTable() {
  console.log('📊 fixture_events 테이블 상태 확인...');
  
  try {
    // fixture_events 테이블 레코드 수 확인
    const { count: fixtureEventsCount, error: countError } = await supabase
      .from('fixture_events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      if (countError.message.includes('does not exist')) {
        console.log('❌ fixture_events 테이블이 존재하지 않습니다.');
        console.log('🔧 해결 방법: create-fixture-events-table.sql을 Supabase 대시보드에서 실행하세요.');
        return false;
      } else {
        throw countError;
      }
    }
    
    console.log(`🔢 fixture_events 레코드 수: ${fixtureEventsCount?.toLocaleString()}개`);
    
    if (fixtureEventsCount > 0) {
      // 샘플 데이터 확인
      const { data: sampleData } = await supabase
        .from('fixture_events')
        .select('fixture_id, event_type, event_detail, elapsed_minutes, player_id')
        .limit(5);
      
      console.log('\n📋 샘플 데이터:');
      sampleData?.forEach((row, index) => {
        console.log(`  ${index + 1}. Fixture ${row.fixture_id}: ${row.event_type} (${row.event_detail}) at ${row.elapsed_minutes}min`);
      });
      
      // Goal 이벤트 수 확인
      const { count: goalCount } = await supabase
        .from('fixture_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'Goal');
      
      console.log(`⚽ Goal 이벤트: ${goalCount?.toLocaleString()}개`);
    } else {
      console.log('📝 fixture_events 테이블이 비어있습니다.');
      console.log('⏳ 데이터 임포트가 완료될 때까지 기다려주세요.');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 확인 실패:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Fixture Events 테이블 상태 확인');
  console.log('=====================================');
  
  const exists = await checkFixtureEventsTable();
  
  if (!exists) {
    console.log('\n📄 다음 SQL 스크립트를 Supabase 대시보드에서 실행하세요:');
    console.log('   scripts/create-fixture-events-table.sql');
  }
}

main().catch(console.error);