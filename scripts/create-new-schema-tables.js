// create-new-schema-tables.js - API-Football 기반 새 테이블 생성
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function analyzeCurrentState() {
  console.log('🔍 현재 데이터베이스 상태 분석...');
  console.log('=====================================');
  
  const tables = ['leagues', 'seasons', 'teams', 'players', 'squad_memberships', 'fixtures', 'events', 'standings'];
  const currentStats = {};
  
  for (const tableName of tables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      currentStats[tableName] = count;
      console.log(`  ${tableName}: ${count} 레코드`);
    } catch (err) {
      console.warn(`  ❌ ${tableName}: ${err.message}`);
      currentStats[tableName] = 'ERROR';
    }
  }
  
  return currentStats;
}

async function checkForDuplicateEvents() {
  console.log('\n🔍 이벤트 중복 현황 확인...');
  
  try {
    // 중복 이벤트 그룹 확인
    const { data: duplicates, error } = await supabase
      .from('events')
      .select('fixture_id, player_id, type, minute, COUNT(*)')
      .limit(10);
    
    if (error) throw error;
    
    // 전체 이벤트 수
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  전체 이벤트: ${totalEvents} 개`);
    
    // 중복 패턴 샘플 조회
    const { data: sampleEvents } = await supabase
      .from('events')
      .select('fixture_id, player_id, type, minute')
      .limit(5);
    
    console.log('  이벤트 샘플:');
    sampleEvents?.forEach(event => {
      console.log(`    fixture_id: ${event.fixture_id}, player_id: ${event.player_id}, type: ${event.type}, minute: ${event.minute}`);
    });
    
  } catch (err) {
    console.warn('  ⚠️ 이벤트 분석 실패:', err.message);
  }
}

async function createFixtureEventsTable() {
  console.log('\n⚽ 새로운 fixture_events 테이블 생성 시도...');
  
  try {
    // Supabase 클라이언트로는 DDL 실행이 제한적이므로 안내 메시지만 출력
    console.log('  ⚠️ Supabase 클라이언트로는 CREATE TABLE 실행이 제한됩니다.');
    console.log('  💡 다음 SQL을 Supabase Dashboard → SQL Editor에서 실행해주세요:');
    console.log(`
-- 새로운 fixture_events 테이블 생성 (중복 방지 제약조건 포함)
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
  -- 🔥 중복 방지 핵심 제약조건
  UNIQUE(fixture_id, player_id, event_type, elapsed_minutes, event_detail)
);

-- 인덱스 생성
CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_fixture_events_time ON fixture_events(elapsed_minutes);
    `);
    
  } catch (error) {
    console.error('  ❌ 테이블 생성 시도 실패:', error.message);
  }
}

async function demonstrateDataCleanup() {
  console.log('\n🧹 데이터 정리 전략...');
  
  console.log('  🎯 목표: API-Football 표준에 맞는 깨끗한 데이터');
  console.log('  ');
  console.log('  📋 정리 방안:');
  console.log('    1. 기존 events 테이블의 중복 데이터 문제');
  console.log('    2. 새로운 fixture_events 테이블로 교체');
  console.log('    3. UNIQUE 제약조건으로 중복 자동 방지');
  console.log('    4. API-Football에서 새로운 데이터 재임포트');
  
  console.log('  ');
  console.log('  🔄 추천 순서:');
  console.log('    1. Supabase Dashboard에서 fixture_events 테이블 생성');
  console.log('    2. master-import.ts 스크립트 수정 (fixture_events 사용)');
  console.log('    3. API-Football에서 깨끗한 데이터 재임포트');
  console.log('    4. 기존 events 테이블 삭제 (백업 후)');
  console.log('    5. 웹 애플리케이션 코드 업데이트 (events → fixture_events)');
}

async function updateMasterImportScript() {
  console.log('\n📝 master-import.ts 스크립트 업데이트 준비...');
  
  console.log('  수정해야 할 부분:');
  console.log('    1. events → fixture_events 테이블명 변경');
  console.log('    2. minute → elapsed_minutes 필드명 변경');
  console.log('    3. assist_id → assist_player_id 필드명 변경');
  console.log('    4. event_type, event_detail 필드 추가');
  console.log('');
  console.log('  새로운 이벤트 데이터 구조:');
  console.log(`    {
      fixture_id: Number(fixture.fixture.id),
      team_id: Number(event.team?.id),
      player_id: event.player?.id ? Number(event.player.id) : null,
      assist_player_id: event.assist?.id ? Number(event.assist.id) : null,
      elapsed_minutes: event.time?.elapsed ?? null,
      extra_minutes: event.time?.extra ?? null,
      event_type: event.type || null,
      event_detail: event.detail || null,
      comments: event.comments || null
    }`);
}

async function main() {
  console.log('🚀 API-Football 기반 스키마 전환 준비');
  console.log('=====================================');
  
  // 현재 상태 분석
  const currentStats = await analyzeCurrentState();
  
  // 중복 이벤트 확인
  await checkForDuplicateEvents();
  
  // 새 테이블 생성 안내
  await createFixtureEventsTable();
  
  // 데이터 정리 전략
  await demonstrateDataCleanup();
  
  // 임포트 스크립트 업데이트 안내
  await updateMasterImportScript();
  
  console.log('\n✅ 준비 완료!');
  console.log('\n🎯 다음 단계 실행 순서:');
  console.log('1. Supabase Dashboard → SQL Editor에서 fixture_events 테이블 생성');
  console.log('2. master-import.ts 스크립트 수정');
  console.log('3. SEASON_YEAR=2025 npx tsx scripts/master-import.ts 실행');
  console.log('4. 공식 K-League 데이터와 비교 검증');
}

main().catch(console.error);