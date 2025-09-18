import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeAPIFootballAccess() {
  console.log("🔍 API-Football 접근 문제 종합 분석...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY가 환경변수에 없습니다");
    return;
  }

  console.log(`🔑 API 키 정보:`);
  console.log(`   첫 8자: ${apiKey.substring(0, 8)}...`);
  console.log(`   전체 길이: ${apiKey.length}자`);

  // 1. API 상태 확인 (가장 기본적인 endpoint)
  console.log("\n📊 1. API 서비스 상태 확인...");
  
  try {
    const statusResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/status`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    });

    console.log(`   응답 코드: ${statusResponse.status}`);
    console.log(`   응답 헤더:`);
    
    const headers = Object.fromEntries(statusResponse.headers.entries());
    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().includes('x-ratelimit') || 
          key.toLowerCase().includes('retry') ||
          key.toLowerCase().includes('subscription') ||
          key.toLowerCase().includes('requests')) {
        console.log(`     ${key}: ${value}`);
      }
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log("\n✅ API 상태 정보:");
      
      if (statusData.response?.account) {
        console.log("📋 계정 정보:");
        console.log(`   계정명: ${statusData.response.account.firstname} ${statusData.response.account.lastname}`);
        console.log(`   이메일: ${statusData.response.account.email}`);
        console.log(`   플랜: ${statusData.response.account.plan}`);
      }
      
      if (statusData.response?.requests) {
        console.log("\n📈 요청 한도 정보:");
        console.log(`   현재 요청 수: ${statusData.response.requests.current || 0}`);
        console.log(`   일일 한도: ${statusData.response.requests.limit_day || 'N/A'}`);
        
        if (statusData.response.requests.limit_day) {
          const usage = ((statusData.response.requests.current / statusData.response.requests.limit_day) * 100).toFixed(1);
          console.log(`   사용률: ${usage}%`);
          
          if (statusData.response.requests.current >= statusData.response.requests.limit_day) {
            console.log("🚨 일일 한도 초과!");
          }
        }
      }
      
      if (statusData.response?.subscription) {
        console.log("\n📦 구독 정보:");
        console.log(`   구독 상태: ${statusData.response.subscription.active ? '활성' : '비활성'}`);
        console.log(`   만료일: ${statusData.response.subscription.end || 'N/A'}`);
      }
    } else {
      console.log(`❌ API 상태 확인 실패: ${statusResponse.status}`);
      const errorText = await statusResponse.text();
      console.log(`오류 내용:`, errorText);
    }
  } catch (error) {
    console.error(`💥 네트워크 오류:`, error);
  }

  // 2. 8월 30일 특정 경기 접근 시도
  console.log("\n🎯 2. 8월 30일 경기 접근 시도...");
  
  const targetFixtureId = 1340863; // 울산 vs 전북

  try {
    const fixtureResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?id=${targetFixtureId}`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    });

    console.log(`   경기 데이터 응답: ${fixtureResponse.status}`);
    
    if (fixtureResponse.ok) {
      const data = await fixtureResponse.json();
      console.log(`   ✅ 경기 데이터 접근 성공`);
      
      if (data.response && data.response.length > 0) {
        const fixture = data.response[0];
        console.log(`   경기: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
        console.log(`   날짜: ${fixture.fixture.date}`);
        console.log(`   상태: ${fixture.fixture.status.short}`);
      }
      
      // 이벤트 데이터 시도
      console.log("\n   🎯 이벤트 데이터 접근 시도...");
      
      const eventResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=${targetFixtureId}`, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });
      
      console.log(`   이벤트 응답: ${eventResponse.status}`);
      
      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        console.log(`   ✅ 이벤트 데이터 접근 성공`);
        console.log(`   이벤트 수: ${eventData.response?.length || 0}개`);
        
        const goalEvents = eventData.response?.filter((event: any) => event.type === "Goal") || [];
        console.log(`   골 이벤트: ${goalEvents.length}개`);
        
        const jeonJinWooGoals = goalEvents.filter((event: any) => event.player.id === 34708);
        if (jeonJinWooGoals.length > 0) {
          console.log(`   🎯 전진우 골: ${jeonJinWooGoals.length}개 발견!`);
          jeonJinWooGoals.forEach((goal: any, index: number) => {
            console.log(`     ${index + 1}. ${goal.time.elapsed}분 | ${goal.detail}`);
          });
        }
      } else {
        console.log(`   ❌ 이벤트 데이터 접근 실패: ${eventResponse.status}`);
        const errorText = await eventResponse.text();
        console.log(`   오류:`, errorText);
      }
      
    } else {
      console.log(`   ❌ 경기 데이터 접근 실패: ${fixtureResponse.status}`);
      const errorText = await fixtureResponse.text();
      console.log(`   오류:`, errorText);
    }
  } catch (error) {
    console.error(`   💥 네트워크 오류:`, error);
  }

  // 3. 현재 데이터베이스 상태 확인
  console.log("\n📊 3. 현재 DB 상태 확인...");
  
  try {
    const { data: dbEvents } = await supabase
      .from("events")
      .select("id, player_id, elapsed_minutes, event_detail")
      .eq("fixture_id", targetFixtureId)
      .eq("event_type", "Goal");

    console.log(`   DB 골 이벤트: ${dbEvents?.length || 0}개`);
    
    if (dbEvents) {
      const jeonJinWooGoals = dbEvents.filter(event => event.player_id === 34708);
      console.log(`   DB 전진우 골: ${jeonJinWooGoals.length}개`);
    }

    // 전체 전진우 골 수 확인
    const { data: allJeonGoals } = await supabase
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

    console.log(`   전진우 총 골 수: ${allJeonGoals?.length || 0}개`);
    console.log(`   K리그 공식: 14골`);
    console.log(`   차이: ${14 - (allJeonGoals?.length || 0)}골`);

  } catch (error) {
    console.error(`   DB 확인 오류:`, error);
  }

  // 4. 종합 분석 및 해결 방안
  console.log("\n💡 4. 종합 분석 및 해결 방안");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n🔍 문제 분석:");
  console.log("   1. API 키는 존재하며 형식상 문제없음");
  console.log("   2. 첫 번째 요청에서 403 'You are not subscribed to this API' 오류");
  console.log("   3. 이후 요청에서 429 'Too many requests' 오류");
  console.log("   4. 이는 구독 상태 문제와 요청 한도 문제가 복합적으로 발생");

  console.log("\n🚨 가능한 원인:");
  console.log("   • RapidAPI 구독이 만료되었거나 비활성화됨");
  console.log("   • 일일/월별 요청 한도 초과");
  console.log("   • API 키가 해당 엔드포인트에 대한 권한이 없음");
  console.log("   • 무료 플랜 제한사항");

  console.log("\n✅ 해결 방안:");
  console.log("   1. RapidAPI 계정 확인:");
  console.log("      - https://rapidapi.com/api-sports/api/api-football");
  console.log("      - 구독 상태 및 만료일 확인");
  console.log("      - 요청 한도 사용량 확인");
  
  console.log("   2. 구독 갱신 또는 업그레이드:");
  console.log("      - 무료 플랜 → 유료 플랜 전환");
  console.log("      - 만료된 구독 갱신");
  
  console.log("   3. 단기 해결책:");
  console.log("      - 새로운 API 키 생성 시도");
  console.log("      - 다른 계정으로 임시 구독");
  
  console.log("   4. 장기 해결책:");
  console.log("      - 대안 데이터 소스 검토 (KFA API, 스포츠 데이터 API 등)");
  console.log("      - 크롤링 기반 데이터 수집 시스템 구축");

  console.log("\n⚠️  중요사항:");
  console.log("   • 데이터 조작 없이 정확한 소스에서 가져와야 함");
  console.log("   • K리그 공식 데이터와 100% 일치해야 함");
  console.log("   • 8월 30일 전진우 골 데이터는 반드시 복구되어야 함");

  console.log("\n🔄 즉시 조치사항:");
  console.log("   1. RapidAPI 대시보드에서 구독 상태 확인");
  console.log("   2. 요청 한도 및 사용량 점검");
  console.log("   3. 필요시 구독 갱신/업그레이드");
  console.log("   4. API 접근 복구 후 누락된 데이터 재임포트");

  console.log("\n📋 분석 완료!");
}

analyzeAPIFootballAccess().catch(console.error);