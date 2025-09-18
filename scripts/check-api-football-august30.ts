import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAPIFootballAugust30() {
  console.log("🔍 8월 30일 울산 vs 전북 경기 API-Football 데이터 확인...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY not found in environment variables");
    return;
  }

  const fixtureId = 1340863; // 8월 30일 울산 vs 전북 경기

  try {
    // 1. 경기 기본 정보 확인
    console.log(`📋 Fixture ${fixtureId} 기본 정보 확인...`);
    
    const fixtureResponse = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!fixtureResponse.ok) {
      console.log(`❌ 경기 정보 요청 실패: ${fixtureResponse.status}`);
      return;
    }

    const fixtureData = await fixtureResponse.json();
    
    if (!fixtureData.response || fixtureData.response.length === 0) {
      console.log("❌ API에서 경기 정보 없음");
      return;
    }

    const fixture = fixtureData.response[0];
    console.log(`✅ 경기 발견: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
    console.log(`📅 날짜: ${fixture.fixture.date}`);
    console.log(`📊 상태: ${fixture.fixture.status.short} (${fixture.fixture.status.long})`);
    console.log(`⚽ 스코어: ${fixture.goals.home}-${fixture.goals.away}`);

    // 2. 이벤트 데이터 확인
    console.log(`\n🔍 Fixture ${fixtureId} 이벤트 데이터 확인...`);
    
    const eventResponse = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!eventResponse.ok) {
      console.log(`❌ 이벤트 요청 실패: ${eventResponse.status}`);
      return;
    }

    const eventData = await eventResponse.json();
    
    if (!eventData.response || eventData.response.length === 0) {
      console.log("❌ API에서 이벤트 데이터 없음");
      return;
    }

    console.log(`✅ API에서 ${eventData.response.length}개 이벤트 발견`);

    // 3. 골 이벤트만 필터링
    const goalEvents = eventData.response.filter((event: any) => event.type === "Goal");
    
    console.log(`\n⚽ 골 이벤트: ${goalEvents.length}개`);

    goalEvents.forEach((event: any, index: number) => {
      const isJeonJinWoo = event.player.id === 34708;
      const marker = isJeonJinWoo ? '🎯' : '⚽';
      console.log(`${marker} ${index + 1}. ${event.player.name} (${event.team.name}) | ${event.time.elapsed}' | ${event.detail} ${isJeonJinWoo ? '[전진우!]' : ''}`);
    });

    // 4. 전진우 골 확인
    const jeonJinWooGoals = goalEvents.filter((event: any) => event.player.id === 34708);
    
    if (jeonJinWooGoals.length > 0) {
      console.log(`\n🎯 전진우 골 ${jeonJinWooGoals.length}개 발견!`);
      jeonJinWooGoals.forEach((goal: any, index: number) => {
        console.log(`  ${index + 1}. ${goal.time.elapsed}' | ${goal.detail}`);
      });
    } else {
      console.log(`\n❌ 전진우 골 없음`);
    }

    // 5. 데이터베이스 현재 상태 확인
    console.log(`\n📊 데이터베이스 현재 상태 확인...`);
    
    const { data: dbEvents } = await supabase
      .from("events")
      .select("id, player_id, elapsed_minutes, event_detail")
      .eq("fixture_id", fixtureId)
      .eq("event_type", "Goal");

    console.log(`📊 DB에 저장된 골 이벤트: ${dbEvents?.length || 0}개`);
    
    if (dbEvents && dbEvents.length > 0) {
      dbEvents.forEach((event, index) => {
        const isJeonJinWoo = event.player_id === 34708;
        const marker = isJeonJinWoo ? '🎯' : '⚽';
        console.log(`${marker} ${index + 1}. Player ${event.player_id} | ${event.elapsed_minutes}' | ${event.event_detail} ${isJeonJinWoo ? '[전진우!]' : ''}`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkAPIFootballAugust30().catch(console.error);