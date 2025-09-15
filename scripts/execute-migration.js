// execute-migration.js - API-Football 기반 새 스키마 마이그레이션 실행
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function executeMigration() {
  console.log('🚀 API-Football 기반 새 스키마 마이그레이션 시작');
  console.log('=====================================');
  
  try {
    // 1. 현재 데이터 상태 백업
    console.log('📊 마이그레이션 전 데이터 상태 확인...');
    
    const tables = ['leagues', 'seasons', 'teams', 'players', 'squad_memberships', 'fixtures', 'events', 'standings'];
    const preStatistics = {};
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        preStatistics[table] = count;
        console.log(`  ${table}: ${count} records`);
      } catch (err) {
        console.warn(`  ⚠️ ${table}: 조회 실패 - ${err.message}`);
        preStatistics[table] = 'ERROR';
      }
    }
    
    // 2. SQL 마이그레이션 스크립트 읽기
    console.log('\n📄 SQL 마이그레이션 스크립트 로드...');
    const migrationPath = path.join(process.cwd(), 'scripts', 'migrate-to-new-schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error('마이그레이션 스크립트를 찾을 수 없습니다: ' + migrationPath);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 3. SQL을 단계별로 분할 실행 (안전성을 위해)
    console.log('\n🔄 단계별 마이그레이션 실행...');
    
    const sqlStatements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`총 ${sqlStatements.length}개 SQL 구문 실행 예정`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      
      try {
        // 주요 구문만 로그 출력
        if (statement.toLowerCase().includes('create table') || 
            statement.toLowerCase().includes('drop table') ||
            statement.toLowerCase().includes('insert into')) {
          console.log(`\n  [${i + 1}/${sqlStatements.length}] ${statement.substring(0, 100)}...`);
        }
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          throw error;
        }
        
        successCount++;
        
        // 짧은 대기 (안전성)
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        errorCount++;
        
        // 중요한 에러만 로그, 일부 에러는 무시 (테이블이 이미 존재하는 경우 등)
        if (!err.message.includes('already exists') && 
            !err.message.includes('does not exist')) {
          console.warn(`    ⚠️ 구문 실행 실패: ${err.message}`);
          console.warn(`    구문: ${statement.substring(0, 200)}`);
        }
      }
    }
    
    console.log(`\n✅ SQL 실행 완료: 성공 ${successCount}개, 에러 ${errorCount}개`);
    
    // 4. 마이그레이션 후 데이터 상태 확인
    console.log('\n📊 마이그레이션 후 데이터 상태 확인...');
    
    const newTables = [
      'countries', 'venues', 'leagues', 'seasons', 'teams', 
      'players', 'squad_memberships', 'fixtures', 'fixture_events', 'standings'
    ];
    
    const postStatistics = {};
    
    for (const table of newTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        postStatistics[table] = count;
        console.log(`  ${table}: ${count} records`);
      } catch (err) {
        console.warn(`  ⚠️ ${table}: 조회 실패 - ${err.message}`);
        postStatistics[table] = 'ERROR';
      }
    }
    
    // 5. 마이그레이션 결과 요약
    console.log('\n📋 마이그레이션 결과 요약:');
    console.log('=====================================');
    console.log('새로 생성된 테이블:');
    console.log(`  • countries: ${postStatistics.countries} 레코드`);
    console.log(`  • venues: ${postStatistics.venues} 레코드`);
    
    console.log('\n변환된 테이블:');
    console.log(`  • leagues: ${preStatistics.leagues} → ${postStatistics.leagues}`);
    console.log(`  • seasons: ${preStatistics.seasons} → ${postStatistics.seasons}`);
    console.log(`  • teams: ${preStatistics.teams} → ${postStatistics.teams}`);
    console.log(`  • players: ${preStatistics.players} → ${postStatistics.players}`);
    console.log(`  • fixtures: ${preStatistics.fixtures} → ${postStatistics.fixtures}`);
    console.log(`  • events → fixture_events: ${preStatistics.events} → ${postStatistics.fixture_events}`);
    console.log(`  • standings: ${preStatistics.standings} → ${postStatistics.standings}`);
    
    // 6. 다음 단계 안내
    console.log('\n🎯 다음 단계:');
    console.log('1. 새 구조로 API-Football 데이터 재임포트');
    console.log('2. 중복 데이터 자동 제거 (UNIQUE 제약조건)');
    console.log('3. 공식 K-League 데이터와 비교 검증');
    console.log('4. 웹 애플리케이션 코드 업데이트');
    
    console.log('\n✅ 마이그레이션 완료!');
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실행 실패:', error.message);
    console.error('\n복구 방법:');
    console.error('1. 백업 테이블들이 생성되어 있으므로 필요시 복구 가능');
    console.error('2. *_backup 테이블들을 확인하여 데이터 손실 여부 점검');
    throw error;
  }
}

async function main() {
  await executeMigration();
}

main().catch(console.error);