import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface APIFootballEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

async function fixMissingAugust30Events() {
  console.log("🔧 8월 30일 울산 vs 전북 경기 이벤트 수정...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY not found in environment variables");
    return;
  }

  const fixtureId = 1340863; // 8월 30일 울산 vs 전북 경기

  console.log(`📋 Fixture ${fixtureId} 이벤트 가져오는 중...`);

  try {
    // 1. API-Football에서 이벤트 데이터 가져오기
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!response.ok) {
      console.log(`❌ API 요청 실패: ${response.status}`);
      return;
    }

    const data = await response.json() as { response: APIFootballEvent[] };
    
    if (!data.response || data.response.length === 0) {
      console.log("❌ API에서 이벤트 데이터 없음");
      return;
    }

    console.log(`✅ API에서 ${data.response.length}개 이벤트 발견`);

    // 2. 골 이벤트만 필터링
    const goalEvents = data.response.filter(event => event.type === "Goal");
    
    console.log(`⚽ 골 이벤트: ${goalEvents.length}개`);

    if (goalEvents.length === 0) {
      console.log("❌ 골 이벤트 없음");
      return;
    }

    // 3. 골 이벤트 데이터베이스에 추가
    for (const event of goalEvents) {
      console.log(`\n🔄 처리 중: ${event.player.name} (${event.time.elapsed}') - ${event.detail}`);

      // 중복 확인
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("fixture_id", fixtureId)
        .eq("player_id", event.player.id)
        .eq("elapsed_minutes", event.time.elapsed)
        .eq("event_type", "Goal")
        .eq("event_detail", event.detail)
        .maybeSingle();

      if (existing) {
        console.log(`  ⏭️ 이미 존재함 (ID: ${existing.id})`);
        continue;
      }

      // 새 이벤트 추가
      const eventData = {
        fixture_id: fixtureId,
        team_id: event.team.id,
        player_id: event.player.id,
        elapsed_minutes: event.time.elapsed,
        extra_minutes: event.time.extra,
        event_type: "Goal",
        event_detail: event.detail,
        comments: event.comments,
        assist_player_id: event.assist.id
      };

      const { error: insertError } = await supabase
        .from("events")
        .insert(eventData);

      if (insertError) {
        console.error(`  ❌ 삽입 실패:`, insertError);
      } else {
        console.log(`  ✅ 추가됨: ${event.player.name} (${event.time.elapsed}') - ${event.detail}`);
        
        // 전진우인지 확인
        if (event.player.id === 34708) {
          console.log(`  🎯 전진우 골 발견!`);
        }
      }
    }

    // 4. 결과 확인
    console.log("\n📊 수정 후 전진우 골 수 확인:");
    
    const { data: jeonGoals } = await supabase
      .from("events")
      .select("id")
      .eq("fixtures.league_id", 292)
      .eq("fixtures.season_year", 2025)
      .eq("event_type", "Goal")
      .eq("player_id", 34708)
      .not("event_detail", "ilike", "%own%");

    console.log(`🏆 전진우 총 골 수: ${jeonGoals?.length || 0}개`);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixMissingAugust30Events().catch(console.error);