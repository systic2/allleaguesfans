// check-and-create-fixture-events.js - fixture_events 테이블 확인 및 생성
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function checkFixtureEventsTable() {
  console.log('🔍 fixture_events 테이블 존재 확인...');
  
  try {
    const { data: _data, error } = await supabase
      .from('fixture_events')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ fixture_events 테이블이 존재하지 않습니다.');
      console.log('에러:', error.message);
      return false;
    }
    
    console.log('✅ fixture_events 테이블이 존재합니다.');
    
    // 현재 레코드 수 확인
    const { count } = await supabase
      .from('fixture_events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 현재 fixture_events 레코드 수: ${count}`);
    return true;
    
  } catch (err) {
    console.error('❌ 테이블 확인 실패:', err.message);
    return false;
  }
}

async function createFixtureEventsTable() {
  console.log('🔨 fixture_events 테이블 생성 시도...');
  
  // Supabase 클라이언트로는 DDL 실행이 제한되므로 안내만 제공
  console.log('⚠️ Supabase 클라이언트로는 CREATE TABLE을 직접 실행할 수 없습니다.');
  console.log('');
  console.log('📋 다음 단계를 수행해주세요:');
  console.log('1. https://supabase.com/dashboard/project/whoszwxxwgmpdfckmcgh/sql-editor 접속');
  console.log('2. 다음 SQL을 복사하여 실행:');
  console.log('');
  
  const sql = `
-- fixture_events 테이블 생성 (API-Football 표준 + 중복 방지)
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

-- 성능 최적화 인덱스
CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_fixture_events_time ON fixture_events(elapsed_minutes);
  `;
  
  console.log(sql);
  
  return false;
}

async function main() {
  console.log('🚀 fixture_events 테이블 상태 확인');
  console.log('=====================================');
  
  const tableExists = await checkFixtureEventsTable();
  
  if (!tableExists) {
    await createFixtureEventsTable();
    console.log('');
    console.log('❗ 테이블 생성 후 다시 이 스크립트를 실행해주세요.');
    return false;
  }
  
  console.log('✅ fixture_events 테이블 준비 완료!');
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { checkFixtureEventsTable, main as checkAndCreateFixtureEvents };