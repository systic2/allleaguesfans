const apiKey = process.env.API_FOOTBALL_KEY;

async function testSpecificEndpoints() {
  console.log("🔍 API-Football 특정 엔드포인트 테스트...\n");

  if (!apiKey) {
    console.log("❌ API_FOOTBALL_KEY 없음");
    return;
  }

  const endpoints = [
    {
      name: "Status (기본)",
      url: "https://api-football-v1.p.rapidapi.com/v3/status"
    },
    {
      name: "Leagues (리그 목록)", 
      url: "https://api-football-v1.p.rapidapi.com/v3/leagues"
    },
    {
      name: "Teams (팀 목록)",
      url: "https://api-football-v1.p.rapidapi.com/v3/teams?league=292&season=2025"
    },
    {
      name: "Fixtures (경기 목록)",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?league=292&season=2025"
    },
    {
      name: "Specific Fixture (8월 30일)",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures?id=1340863"
    },
    {
      name: "Events (8월 30일 이벤트)",
      url: "https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=1340863"
    },
    {
      name: "Players (선수 목록)",
      url: "https://api-football-v1.p.rapidapi.com/v3/players?team=2767&season=2025"
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📍 테스트: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    try {
      const response = await fetch(endpoint.url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });

      console.log(`   응답 코드: ${response.status}`);
      
      // Rate limit 헤더 확인
      const rateLimitRemaining = response.headers.get('x-ratelimit-requests-remaining');
      const rateLimitLimit = response.headers.get('x-ratelimit-requests-limit');
      
      if (rateLimitRemaining && rateLimitLimit) {
        console.log(`   요청 한도: ${rateLimitRemaining}/${rateLimitLimit}`);
      }

      if (response.ok) {
        const data = await response.json();
        
        if (data.response) {
          console.log(`   ✅ 성공: ${data.response.length || 'N/A'}개 항목`);
          
          // 이벤트 엔드포인트의 경우 골 이벤트 확인
          if (endpoint.name.includes("Events")) {
            const goalEvents = data.response.filter((event: any) => event.type === "Goal");
            console.log(`   ⚽ 골 이벤트: ${goalEvents.length}개`);
            
            const jeonJinWooGoals = goalEvents.filter((event: any) => event.player.id === 34708);
            if (jeonJinWooGoals.length > 0) {
              console.log(`   🎯 전진우 골: ${jeonJinWooGoals.length}개`);
              jeonJinWooGoals.forEach((goal: any) => {
                console.log(`      ${goal.time.elapsed}분 | ${goal.detail}`);
              });
            }
          }
          
          // 경기 엔드포인트의 경우 경기 정보 확인
          if (endpoint.name.includes("Fixture") && data.response.length > 0) {
            const fixture = data.response[0];
            if (fixture.teams) {
              console.log(`   경기: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
              console.log(`   날짜: ${fixture.fixture.date}`);
              console.log(`   상태: ${fixture.fixture.status.short} (${fixture.fixture.status.long})`);
            }
          }
        } else {
          console.log(`   ⚠️  응답 데이터 구조 확인 필요`);
          console.log(`   응답 샘플:`, JSON.stringify(data, null, 2).substring(0, 200) + "...");
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ 실패: ${response.status}`);
        console.log(`   오류:`, errorText.substring(0, 200));
      }
      
      // 요청 사이 간격 (rate limit 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   💥 네트워크 오류:`, error);
    }
  }

  console.log("\n🔍 추가 분석:");
  console.log("   • 모든 엔드포인트가 200 OK면 API 키는 정상");
  console.log("   • 특정 엔드포인트만 실패하면 권한/데이터 문제");
  console.log("   • 이벤트 엔드포인트에서 전진우 골이 보이면 데이터 존재");
  console.log("   • 임포트 스크립트에서 특정 조건 문제 가능성");
}

testSpecificEndpoints().catch(console.error);