import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = "4970b271c2989a1bd26b32b7518692b7";

const supabase = createClient(supabaseUrl, supabaseKey);

async function importMissingJeonGoal() {
  console.log("🎯 전진우 누락된 골 데이터 정식 임포트...\n");

  const fixtureId = 1340863; // 8월 30일 울산 vs 전북

  try {
    // 1. Direct API에서 정확한 데이터 가져오기
    console.log("📡 API-Football Direct API에서 데이터 가져오는 중...");
    
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
      method: 'GET',
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!response.ok) {
      console.log(`❌ API 요청 실패: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ API 데이터 수신: ${data.results}개 이벤트`);

    // 2. 골 이벤트만 필터링
    const goalEvents = data.response?.filter((event: any) => event.type === "Goal") || [];
    console.log(`⚽ 골 이벤트: ${goalEvents.length}개`);

    if (goalEvents.length === 0) {
      console.log("❌ 골 이벤트를 찾을 수 없습니다");
      return;
    }

    // 3. 데이터베이스에 현재 상태 확인
    console.log("\n📊 현재 데이터베이스 상태 확인...");
    
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id, player_id, elapsed_minutes, event_detail")
      .eq("fixture_id", fixtureId)
      .eq("event_type", "Goal");

    console.log(`DB 기존 골 이벤트: ${existingEvents?.length || 0}개`);
    
    if (existingEvents) {
      existingEvents.forEach(event => {
        console.log(`   - Player ${event.player_id} | ${event.elapsed_minutes}분 | ${event.event_detail}`);
      });
    }

    // 4. 각 골 이벤트 임포트
    console.log("\n🔄 골 이벤트 임포트 중...");
    
    for (const goalEvent of goalEvents) {
      console.log(`\n처리 중: ${goalEvent.player.name} (${goalEvent.time.elapsed}분)`);
      
      // 중복 확인
      const { data: duplicate } = await supabase
        .from("events")
        .select("id")
        .eq("fixture_id", fixtureId)
        .eq("player_id", goalEvent.player.id)
        .eq("elapsed_minutes", goalEvent.time.elapsed)
        .eq("event_type", "Goal")
        .eq("event_detail", goalEvent.detail)
        .maybeSingle();

      if (duplicate) {
        console.log(`   ⏭️ 이미 존재함 (ID: ${duplicate.id})`);
        continue;
      }

      // 새 이벤트 데이터 준비
      const eventData = {
        fixture_id: fixtureId,
        team_id: goalEvent.team.id,
        player_id: goalEvent.player.id,
        elapsed_minutes: goalEvent.time.elapsed,
        extra_minutes: goalEvent.time.extra,
        event_type: "Goal",
        event_detail: goalEvent.detail,
        comments: goalEvent.comments,
        assist_player_id: goalEvent.assist?.id || null
      };

      // 데이터베이스에 삽입
      const { data: insertedEvent, error: insertError } = await supabase
        .from("events")
        .insert(eventData)
        .select()
        .single();

      if (insertError) {
        console.error(`   ❌ 삽입 실패:`, insertError);
      } else {
        console.log(`   ✅ 추가 완료: ${goalEvent.player.name} (${goalEvent.time.elapsed}분) - ${goalEvent.detail}`);
        
        // 전진우 골인지 확인
        if (goalEvent.player.id === 34708) {
          console.log(`   🎯 전진우 골 추가 성공! (ID: ${insertedEvent.id})`);
        }
      }
    }

    // 5. 최종 확인
    console.log("\n📈 최종 전진우 골 수 확인...");
    
    const { data: finalJeonGoals } = await supabase
      .from("events")
      .select(`
        id,
        fixtures!inner(league_id, season_year)
      `)
      .eq("fixtures.league_id", 292)
      .eq("fixtures.season_year", 2025)
      .eq("event_type", "Goal")
      .eq("player_id", 34708)
      .not("event_detail", "ilike", "%own%");

    console.log(`🏆 전진우 최종 골 수: ${finalJeonGoals?.length || 0}개`);
    console.log(`🏆 K리그 공식: 14개`);
    
    if (finalJeonGoals?.length === 14) {
      console.log(`✅ 완벽 일치! 데이터 정확성 문제 해결 완료!`);
    } else {
      console.log(`⚠️  여전히 ${14 - (finalJeonGoals?.length || 0)}개 차이가 있습니다`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

importMissingJeonGoal().catch(console.error);