import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeExistingLineup() {
  console.log("🔍 기존 라인업 데이터 분석...\n");

  try {
    // 1. 기존 라인업 데이터 확인
    const { data: existingLineups, error: lineupsError } = await supabase
      .from('lineups')
      .select('*')
      .limit(10);

    if (lineupsError) {
      console.log(`❌ 라인업 조회 오류: ${lineupsError.message}`);
      return;
    }

    console.log(`📊 전체 라인업 데이터: ${existingLineups?.length || 0}개`);

    if (existingLineups && existingLineups.length > 0) {
      console.log("\n📋 lineups 테이블 스키마:");
      const firstLineup = existingLineups[0];
      Object.keys(firstLineup).forEach(column => {
        const value = firstLineup[column];
        const type = value === null ? 'null' : typeof value;
        console.log(`   - ${column}: ${type} = ${JSON.stringify(value)}`);
      });

      console.log("\n📄 첫 번째 라인업 데이터:");
      console.log(JSON.stringify(firstLineup, null, 2));
    }

    // 2. coaches 테이블 확인
    console.log("\n👔 coaches 테이블 확인...");
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .limit(5);

    if (coachError) {
      console.log(`❌ coaches 테이블 조회 오류: ${coachError.message}`);
    } else {
      console.log(`📊 코치 데이터: ${coaches?.length || 0}개`);
      if (coaches && coaches.length > 0) {
        console.log("📋 coaches 테이블 스키마:");
        Object.keys(coaches[0]).forEach(column => {
          console.log(`   - ${column}: ${typeof coaches[0][column]}`);
        });
      }
    }

    // 3. lineup_players 테이블이 있는지 확인
    console.log("\n⚽ lineup_players 또는 관련 테이블 확인...");
    
    const possibleTables = ['lineup_players', 'lineups_players', 'player_lineups'];
    
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (!error) {
          console.log(`✅ ${tableName} 테이블 존재`);
          if (data && data.length > 0) {
            console.log(`📋 ${tableName} 스키마:`);
            Object.keys(data[0]).forEach(column => {
              console.log(`   - ${column}: ${typeof data[0][column]}`);
            });
          }
        }
      } catch (_e) {
        // 테이블이 없으면 무시
      }
    }

    // 4. 특정 경기의 라인업 데이터 상세 확인
    console.log("\n🎯 8월 30일 경기 라인업 상세 확인...");
    
    const { data: specificLineup } = await supabase
      .from('lineups')
      .select(`
        *,
        fixtures(home_team_id, away_team_id),
        coaches(name),
        teams(name)
      `)
      .eq('fixture_id', 1340863);

    if (specificLineup && specificLineup.length > 0) {
      console.log("📄 8월 30일 경기 라인업:");
      specificLineup.forEach((lineup, index) => {
        console.log(`\n${index + 1}. 팀 ID: ${lineup.team_id}`);
        console.log(`   포메이션: ${lineup.formation || '정보 없음'}`);
        console.log(`   코치: ${lineup.coaches?.name || lineup.coach_name || '정보 없음'}`);
        console.log(`   전체 데이터:`, JSON.stringify(lineup, null, 2));
      });
    } else {
      console.log("❌ 8월 30일 경기 라인업 데이터 없음");
    }

  } catch (error) {
    console.error("❌ 분석 오류:", error);
  }
}

analyzeExistingLineup().catch(console.error);