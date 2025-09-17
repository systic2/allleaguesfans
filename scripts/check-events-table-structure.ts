import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEventsTableStructure() {
  console.log("🔍 이벤트 테이블 구조 검사...\n");

  try {
    // 1. Get any sample row to see actual column names
    const { data: sampleEvents, error: sampleError } = await supabase
      .from("events")
      .select("*")
      .limit(1);

    if (sampleError) {
      console.error("❌ 샘플 이벤트 조회 실패:", sampleError);
      return;
    }

    if (sampleEvents && sampleEvents.length > 0) {
      console.log("📋 실제 이벤트 테이블 컬럼들:");
      const columns = Object.keys(sampleEvents[0]);
      columns.forEach((col, index) => {
        console.log(`  ${index + 1}. ${col}: ${typeof sampleEvents[0][col]} = ${sampleEvents[0][col]}`);
      });

      console.log(`\n📊 총 이벤트 개수 확인...`);
      const { count: totalCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true });

      console.log(`📊 총 이벤트: ${totalCount}개`);

    } else {
      console.log("⚠️ 이벤트 테이블에 데이터가 없습니다.");
    }

    // 2. Check if specific fixtures have events
    console.log("\n🏟️ 특정 경기의 이벤트 확인 (fixture_id = 1340863):");
    const { data: fixtureEvents, error: fixtureError } = await supabase
      .from("events")
      .select("*")
      .eq("fixture_id", 1340863);

    if (fixtureError) {
      console.error("❌ 특정 경기 이벤트 조회 실패:", fixtureError);
    } else {
      console.log(`📋 경기 1340863 이벤트: ${fixtureEvents?.length || 0}개`);
      if (fixtureEvents && fixtureEvents.length > 0) {
        fixtureEvents.forEach((event, index) => {
          console.log(`\n이벤트 ${index + 1}:`);
          Object.entries(event).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });
      }
    }

  } catch (error) {
    console.error("❌ 검사 실패:", error);
  }
}

checkEventsTableStructure().catch(console.error);