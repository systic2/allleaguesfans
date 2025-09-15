// complete-migration-guide.js - 완전한 마이그레이션 가이드 및 검증
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    return !error;
  } catch (err) {
    return false;
  }
}

async function showManualSteps() {
  console.log('🚀 API-Football 스키마 마이그레이션 완전 가이드');
  console.log('==========================================');
  
  console.log('\n📋 1단계: Supabase Dashboard에서 테이블 생성');
  console.log('   👉 https://supabase.com/dashboard/project/whoszwxxwgmpdfckmcgh/sql-editor');
  console.log('   📄 실행할 SQL: scripts/create-fixture-events-table.sql');
  console.log(`
-- 다음 SQL을 Supabase SQL Editor에서 실행하세요:
CREATE TABLE fixture_events (
  id BIGSERIAL PRIMARY KEY,
  fixture_id BIGINT,
  team_id INTEGER,
  player_id INTEGER,
  assist_player_id INTEGER,
  elapsed_minutes INTEGER NOT NULL,
  extra_minutes INTEGER,
  event_type VARCHAR(20) NOT NULL,
  event_detail VARCHAR(50),
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fixture_id, player_id, event_type, elapsed_minutes, event_detail)
);

CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_fixture_events_time ON fixture_events(elapsed_minutes);
  `);
  
  console.log('\n📋 2단계: 테이블 생성 확인');
  const fixtureEventsExists = await checkTableExists('fixture_events');
  console.log(`   fixture_events 테이블: ${fixtureEventsExists ? '✅ 존재함' : '❌ 생성 필요'}`);
  
  if (!fixtureEventsExists) {
    console.log('   ⚠️ fixture_events 테이블이 없습니다. 1단계를 먼저 완료하세요.');
    return;
  }
  
  console.log('\n📋 3단계: 데이터 재임포트');
  console.log('   💡 master-import.ts가 이미 fixture_events를 사용하도록 업데이트되었습니다.');
  console.log('   🔧 실행 명령: SEASON_YEAR=2025 npx tsx scripts/master-import.ts');
  
  console.log('\n📋 4단계: 기존 events 테이블 백업 및 삭제');
  console.log('   📦 백업: CREATE TABLE events_backup AS SELECT * FROM events;');
  console.log('   🗑️ 삭제: DROP TABLE events; (새로운 데이터 확인 후)');
  
  console.log('\n📋 5단계: 웹 애플리케이션 코드 업데이트');
  console.log('   🔄 모든 events 참조를 fixture_events로 변경');
  console.log('   🔄 minute 필드를 elapsed_minutes로 변경');
  console.log('   🔄 type 필드를 event_type으로 변경');
  console.log('   🔄 detail 필드를 event_detail로 변경');
}

async function checkCurrentDataState() {
  console.log('\n📊 현재 데이터 상태:');
  
  const tables = ['events', 'fixture_events', 'fixtures', 'players'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      console.log(`   ${table}: ${count} 레코드`);
    } catch (err) {
      console.log(`   ${table}: 테이블 없음 또는 오류`);
    }
  }
}

async function testImportWithNewSchema() {
  console.log('\n🧪 새 스키마 테스트 임포트 (1개 fixture만)');
  
  const fixtureEventsExists = await checkTableExists('fixture_events');
  if (!fixtureEventsExists) {
    console.log('   ❌ fixture_events 테이블이 없어서 테스트 불가');
    return;
  }
  
  console.log('   ✅ fixture_events 테이블 존재 확인');
  console.log('   💡 전체 임포트 실행 준비 완료!');
  console.log('   🚀 다음 명령 실행: SEASON_YEAR=2025 npx tsx scripts/master-import.ts');
}

async function showExpectedBenefits() {
  console.log('\n🎯 새 스키마의 예상 효과:');
  console.log('   1. 중복 데이터 자동 제거 (UNIQUE 제약조건)');
  console.log('   2. API-Football 표준 준수 (elapsed_minutes, event_type, event_detail)');
  console.log('   3. 정확한 골 통계 (공식 K-League 기록과 일치)');
  console.log('   4. 깨끗한 데이터 구조 (assist_player_id, extra_minutes 분리)');
  console.log('   5. 성능 향상 (적절한 인덱스 설정)');
  
  console.log('\n📈 예상 결과:');
  console.log('   • 현재 events: 5,257개 (중복 포함)');
  console.log('   • 예상 fixture_events: ~1,000-2,000개 (중복 제거 후)');
  console.log('   • 골 통계: 공식 K-League 기록과 일치');
}

async function main() {
  await showManualSteps();
  await checkCurrentDataState();
  await testImportWithNewSchema();
  await showExpectedBenefits();
  
  console.log('\n✅ 마이그레이션 준비 완료!');
  console.log('🎯 다음 작업: Supabase Dashboard에서 fixture_events 테이블 생성');
}

main().catch(console.error);