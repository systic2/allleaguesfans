// migrate-schema-step-by-step.js - API-Football 기반 단계별 스키마 마이그레이션
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function executeSQL(sql) {
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) throw error;
  return data;
}

async function step1_CreateNewTables() {
  console.log('🔧 1단계: 새로운 테이블 생성...');
  
  try {
    // COUNTRIES 테이블 생성
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS countries (
        code VARCHAR(2) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        flag_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ countries 테이블 생성');
    
    // 기본 국가 데이터 삽입
    await executeSQL(`
      INSERT INTO countries (code, name, flag_url) VALUES
      ('KR', 'South-Korea', 'https://media.api-sports.io/flags/kr.svg'),
      ('JP', 'Japan', 'https://media.api-sports.io/flags/jp.svg')
      ON CONFLICT (code) DO NOTHING
    `);
    
    // VENUES 테이블 생성
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS venues (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT,
        city VARCHAR(50),
        country_code VARCHAR(2) REFERENCES countries(code),
        capacity INTEGER,
        surface VARCHAR(20),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ venues 테이블 생성');
    
  } catch (error) {
    console.error('  ❌ 새 테이블 생성 실패:', error.message);
    throw error;
  }
}

async function step2_BackupExistingData() {
  console.log('📦 2단계: 기존 데이터 백업...');
  
  try {
    // 기존 데이터를 임시 저장할 변수들 (메모리에 백업)
    const backupData = {};
    
    const tables = ['leagues', 'seasons', 'teams', 'players', 'fixtures', 'events', 'standings', 'squad_memberships'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error && !error.message.includes('does not exist')) throw error;
        
        backupData[table] = data || [];
        console.log(`  ✅ ${table}: ${data?.length || 0} 레코드 백업`);
      } catch (err) {
        console.warn(`  ⚠️ ${table} 백업 실패: ${err.message}`);
        backupData[table] = [];
      }
    }
    
    return backupData;
    
  } catch (error) {
    console.error('  ❌ 데이터 백업 실패:', error.message);
    throw error;
  }
}

async function step3_CreateNewLeaguesTable() {
  console.log('🏆 3단계: 새로운 leagues 테이블 생성...');
  
  try {
    // 기존 leagues 테이블 드롭 (강제)
    try {
      await executeSQL('DROP TABLE IF EXISTS leagues CASCADE');
    } catch (err) {
      console.warn('  기존 leagues 테이블 삭제 시도:', err.message);
    }
    
    // 새 leagues 테이블 생성
    await executeSQL(`
      CREATE TABLE leagues (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        country_code VARCHAR(2) REFERENCES countries(code),
        type VARCHAR(50),
        logo_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // K-League 데이터 삽입
    const { error } = await supabase.from('leagues').insert([
      {
        id: 292,
        name: 'K League 1',
        country_code: 'KR',
        type: 'League',
        logo_url: 'https://media.api-sports.io/football/leagues/292.png',
        is_active: true
      },
      {
        id: 293,
        name: 'K League 2', 
        country_code: 'KR',
        type: 'League',
        logo_url: 'https://media.api-sports.io/football/leagues/293.png',
        is_active: true
      }
    ]);
    
    if (error) throw error;
    console.log('  ✅ 새로운 leagues 테이블 생성 및 데이터 삽입');
    
  } catch (error) {
    console.error('  ❌ leagues 테이블 생성 실패:', error.message);
    throw error;
  }
}

async function step4_RecreateSeasons() {
  console.log('📅 4단계: seasons 테이블 재생성...');
  
  try {
    // 기존 seasons 드롭
    try {
      await executeSQL('DROP TABLE IF EXISTS seasons CASCADE');
    } catch (err) {
      console.warn('  기존 seasons 테이블 삭제:', err.message);
    }
    
    // 새 seasons 테이블 생성
    await executeSQL(`
      CREATE TABLE seasons (
        id SERIAL PRIMARY KEY,
        league_id INTEGER REFERENCES leagues(id),
        year INTEGER NOT NULL,
        start_date DATE,
        end_date DATE,
        is_current BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(league_id, year)
      )
    `);
    
    // 시즌 데이터 삽입
    const { error } = await supabase.from('seasons').insert([
      { league_id: 292, year: 2024, is_current: false },
      { league_id: 292, year: 2025, is_current: true },
      { league_id: 293, year: 2024, is_current: false },
      { league_id: 293, year: 2025, is_current: true }
    ]);
    
    if (error) throw error;
    console.log('  ✅ seasons 테이블 재생성 완료');
    
  } catch (error) {
    console.error('  ❌ seasons 테이블 재생성 실패:', error.message);
    throw error;
  }
}

async function step5_RecreateFixtureEventsTable() {
  console.log('⚽ 5단계: fixture_events 테이블 생성 (events 대체)...');
  
  try {
    // 기존 events 테이블 드롭
    try {
      await executeSQL('DROP TABLE IF EXISTS events CASCADE');
    } catch (err) {
      console.warn('  기존 events 테이블 삭제:', err.message);
    }
    
    // 새 fixture_events 테이블 생성 (중복 방지 제약조건 포함)
    await executeSQL(`
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
      )
    `);
    
    // 인덱스 생성
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_fixture_events_fixture ON fixture_events(fixture_id)');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_fixture_events_player ON fixture_events(player_id)');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_fixture_events_type ON fixture_events(event_type)');
    
    console.log('  ✅ fixture_events 테이블 생성 완료 (중복 방지 제약조건 적용)');
    
  } catch (error) {
    console.error('  ❌ fixture_events 테이블 생성 실패:', error.message);
    throw error;
  }
}

async function checkMigrationResults() {
  console.log('📊 마이그레이션 결과 확인...');
  
  const newTables = [
    'countries', 'venues', 'leagues', 'seasons', 
    'teams', 'players', 'fixtures', 'fixture_events', 'standings'
  ];
  
  for (const table of newTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      console.log(`  ${table}: ${count || 0} 레코드`);
    } catch (err) {
      console.log(`  ${table}: 존재하지 않음 또는 오류 - ${err.message}`);
    }
  }
}

async function executeMigration() {
  console.log('🚀 API-Football 기반 스키마 마이그레이션 시작');
  console.log('=====================================');
  
  try {
    // 백업 데이터 저장
    const backupData = await step2_BackupExistingData();
    
    // 1단계: 새 테이블 생성
    await step1_CreateNewTables();
    
    // 3단계: leagues 테이블 재생성
    await step3_CreateNewLeaguesTable();
    
    // 4단계: seasons 테이블 재생성
    await step4_RecreateSeasons();
    
    // 5단계: fixture_events 테이블 생성 (가장 중요)
    await step5_RecreateFixtureEventsTable();
    
    // 결과 확인
    await checkMigrationResults();
    
    console.log('\n✅ 마이그레이션 완료!');
    console.log('\n🎯 다음 단계:');
    console.log('1. 새 구조로 API-Football 데이터 재임포트');
    console.log('2. 중복 방지 제약조건으로 자동 중복 제거');
    console.log('3. 공식 K-League 데이터 비교 검증');
    
    return { success: true, backupData };
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    console.error('💡 Supabase Dashboard에서 수동으로 테이블 구조를 확인/수정할 수 있습니다.');
    return { success: false, error };
  }
}

async function main() {
  const result = await executeMigration();
  if (!result.success) {
    process.exit(1);
  }
}

// Supabase에서 직접 SQL 실행이 어려우므로, 대안 방법 안내
console.log('⚠️ 중요: Supabase에서는 복잡한 DDL 명령이 제한될 수 있습니다.');
console.log('대안 방법: Supabase Dashboard → SQL Editor에서 migrate-to-new-schema.sql 직접 실행');
console.log('또는 이 스크립트로 단계별 실행을 시도합니다...\n');

main().catch(console.error);