import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLineupsTable() {
  console.log("🔍 lineups 테이블 스키마 및 데이터 확인...\n");

  try {
    // 1. lineups 테이블의 기존 데이터 확인
    const { data: existingLineups, error: selectError } = await supabase
      .from('lineups')
      .select('*')
      .limit(5);

    if (selectError) {
      console.log(`❌ lineups 테이블 조회 오류: ${selectError.message}`);
      return;
    }

    console.log(`📊 기존 라인업 데이터: ${existingLineups?.length || 0}개`);
    
    if (existingLineups && existingLineups.length > 0) {
      console.log("\n📋 lineups 테이블 스키마:");
      Object.keys(existingLineups[0]).forEach(column => {
        console.log(`   - ${column}: ${typeof existingLineups[0][column]}`);
      });

      console.log("\n📄 샘플 데이터:");
      console.log(JSON.stringify(existingLineups[0], null, 2));
    } else {
      console.log("📄 기존 라인업 데이터가 없습니다. 테이블 스키마를 추정해야 합니다.");
      
      // 빈 테이블에 테스트 데이터를 삽입해서 스키마 확인
      console.log("\n🧪 테스트 데이터로 스키마 확인...");
      
      const testData = {
        fixture_id: 1340863,
        team_id: 2767,
        formation: "4-1-4-1",
        coach_id: 3040,
        coach_name: "Tae-Yong Shin"
      };
      
      const { error: insertError } = await supabase
        .from('lineups')
        .insert(testData)
        .select();

      if (insertError) {
        console.log(`테스트 삽입 오류: ${insertError.message}`);
        console.log("이는 스키마 정보를 파악하는 데 도움이 됩니다.");
      } else {
        console.log("✅ 테스트 데이터 삽입 성공");
        
        // 삽입된 데이터 확인
        const { data: testResult } = await supabase
          .from('lineups')
          .select('*')
          .eq('fixture_id', 1340863)
          .limit(1);

        if (testResult && testResult.length > 0) {
          console.log("\n📋 확인된 스키마:");
          Object.keys(testResult[0]).forEach(column => {
            console.log(`   - ${column}: ${typeof testResult[0][column]}`);
          });
        }

        // 테스트 데이터 삭제
        await supabase
          .from('lineups')
          .delete()
          .eq('fixture_id', 1340863);
        console.log("🗑️ 테스트 데이터 정리 완료");
      }
    }

    // 2. master-import.ts 에서 라인업 임포트 여부 확인
    console.log("\n🔍 기존 임포트 현황 확인...");
    
    const { data: fixtureCheck } = await supabase
      .from('fixtures')
      .select('id')
      .eq('id', 1340863)
      .single();

    if (fixtureCheck) {
      console.log("✅ 테스트 경기(1340863)가 fixtures 테이블에 존재");
      
      const { data: lineupCheck } = await supabase
        .from('lineups')
        .select('count')
        .eq('fixture_id', 1340863);

      console.log(`📊 해당 경기의 라인업 데이터: ${lineupCheck?.length || 0}개`);
    } else {
      console.log("❌ 테스트 경기가 fixtures 테이블에 없음");
    }

  } catch (error) {
    console.error("❌ 전체 오류:", error);
  }
}

checkLineupsTable().catch(console.error);