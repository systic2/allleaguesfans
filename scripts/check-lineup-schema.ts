import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLineupSchema() {
  console.log("🔍 라인업 관련 데이터베이스 스키마 확인...\n");

  try {
    // 1. 현재 테이블 목록 확인
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%lineup%');

    if (tablesError) {
      console.log("테이블 목록을 직접 확인해보겠습니다...");
      
      // lineups 테이블 존재 여부 확인
      const { data: lineupsTest, error: lineupsError } = await supabase
        .from('lineups')
        .select('count')
        .limit(1);

      if (lineupsError) {
        console.log("❌ lineups 테이블이 존재하지 않습니다");
        console.log(`   오류: ${lineupsError.message}`);
      } else {
        console.log("✅ lineups 테이블 존재");
      }

      // fixtures 테이블에 lineup 관련 컬럼이 있는지 확인
      const { data: fixturesTest } = await supabase
        .from('fixtures')
        .select('*')
        .limit(1);

      if (fixturesTest && fixturesTest.length > 0) {
        console.log("\n📋 fixtures 테이블 컬럼:");
        Object.keys(fixturesTest[0]).forEach(column => {
          console.log(`   - ${column}`);
        });
      }

    } else if (tables) {
      console.log("📋 라인업 관련 테이블:");
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }

    // 2. master-import.ts에서 라인업 임포트가 구현되어 있는지 확인
    console.log("\n🔍 master-import.ts에서 라인업 처리 확인...");
    
    // master-import에 대한 정보는 이미 확인했으므로, 새로운 라인업 임포트 스크립트를 만들어야 함을 알 수 있음
    
  } catch (error) {
    console.error("❌ 스키마 확인 오류:", error);
  }
}

checkLineupSchema().catch(console.error);