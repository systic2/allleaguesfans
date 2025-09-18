const apiKey = process.env.API_FOOTBALL_KEY;

async function debugProPlanIssue() {
  console.log("🔍 Pro Plan 계정 이벤트 엔드포인트 403 오류 분석...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY 없음");
    return;
  }

  console.log("🎯 가능한 원인들:");
  console.log("   1. API 키가 올바른 앱/프로젝트에 연결되지 않음");
  console.log("   2. RapidAPI vs Direct API 혼동");
  console.log("   3. 특정 엔드포인트별 추가 권한 필요");
  console.log("   4. 캐시된 잘못된 인증 상태");
  console.log("   5. 요청 헤더 문제\n");

  // 1. 다른 헤더 조합으로 테스트
  console.log("📋 1. 다양한 헤더 조합으로 이벤트 엔드포인트 테스트...\n");
  
  const fixtureId = 1340863;
  const headerVariations = [
    {
      name: "표준 RapidAPI 헤더",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    },
    {
      name: "추가 헤더 포함",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    },
    {
      name: "User-Agent 추가",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        "User-Agent": "allleaguesfans-app/1.0"
      }
    }
  ];

  for (const variation of headerVariations) {
    console.log(`   🧪 테스트: ${variation.name}`);
    
    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=${fixtureId}`, {
        method: 'GET',
        headers: variation.headers
      });

      console.log(`      응답 코드: ${response.status}`);
      
      // 응답 헤더에서 유용한 정보 추출
      const rateLimitRemaining = response.headers.get('x-ratelimit-requests-remaining');
      const rateLimitLimit = response.headers.get('x-ratelimit-requests-limit');
      const subscription = response.headers.get('x-rapidapi-subscription');
      const version = response.headers.get('x-rapidapi-version');
      
      if (rateLimitRemaining) console.log(`      Rate Limit: ${rateLimitRemaining}/${rateLimitLimit}`);
      if (subscription) console.log(`      Subscription: ${subscription}`);
      if (version) console.log(`      API Version: ${version}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`      ✅ 성공! 이벤트 수: ${data.response?.length || 0}`);
        
        if (data.response && data.response.length > 0) {
          const goalEvents = data.response.filter((event: any) => event.type === "Goal");
          console.log(`      ⚽ 골 이벤트: ${goalEvents.length}개`);
          
          const jeonJinWooGoals = goalEvents.filter((event: any) => event.player.id === 34708);
          if (jeonJinWooGoals.length > 0) {
            console.log(`      🎯 전진우 골 발견: ${jeonJinWooGoals.length}개!`);
            break; // 성공하면 다른 테스트 중단
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`      ❌ 실패: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`      💥 네트워크 오류: ${error}`);
    }
    
    // 요청 간 간격
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 2. 다른 경기의 이벤트 테스트 (더 최근 경기)
  console.log("\n📋 2. 다른 경기 이벤트 테스트...");
  
  // 최근 경기들 시도
  const testFixtures = [
    { id: 1340870, name: "9월 13일 경기" },
    { id: 1340869, name: "9월 12일 경기" },
    { id: 1340868, name: "9월 11일 경기" }
  ];

  for (const fixture of testFixtures) {
    console.log(`\n   🎯 테스트: ${fixture.name} (ID: ${fixture.id})`);
    
    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=${fixture.id}`, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      console.log(`      응답 코드: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`      ✅ 성공! 이벤트 수: ${data.response?.length || 0}`);
        
        if (data.response && data.response.length > 0) {
          const goalEvents = data.response.filter((event: any) => event.type === "Goal");
          console.log(`      ⚽ 골 이벤트: ${goalEvents.length}개`);
        }
        
        // 하나라도 성공하면 API 자체는 문제없음
        console.log("      🔍 이 경기는 접근 가능! → 8월 30일 경기만 특별한 문제가 있을 수 있음");
        break;
        
      } else {
        const errorText = await response.text();
        console.log(`      ❌ 실패: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`      💥 오류: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 3. 대안 접근법 제안
  console.log("\n💡 3. 종합 분석 및 해결 방안");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n🔍 Pro Plan인데 이벤트 엔드포인트 403 오류 가능한 원인:");
  console.log("   • 8월 30일 특정 경기 데이터가 제한됨 (오래된 데이터 정책)");
  console.log("   • API 키가 다른 프로젝트/앱에 연결됨");
  console.log("   • RapidAPI 대시보드에서 이벤트 엔드포인트 비활성화됨");
  console.log("   • 캐싱된 잘못된 인증 정보");
  
  console.log("\n✅ 확인할 사항:");
  console.log("   1. RapidAPI 대시보드 → API-Football → Endpoints 탭에서 events 엔드포인트 활성화 여부");
  console.log("   2. 현재 API 키가 올바른 앱에 연결되어 있는지");
  console.log("   3. Pro Plan 구독이 올바른 API-Football 버전(v3)에 적용되었는지");
  
  console.log("\n🔄 시도해볼 방안:");
  console.log("   1. RapidAPI 대시보드에서 새 API 키 생성");
  console.log("   2. 브라우저에서 직접 이벤트 엔드포인트 테스트");
  console.log("   3. RapidAPI 지원팀 문의 (Pro Plan인데 403 오류)");
}

debugProPlanIssue().catch(console.error);