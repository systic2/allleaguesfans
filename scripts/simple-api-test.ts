const apiKey = "4970b271c2989a1bd26b32b7518692b7";

async function simpleAPITest() {
  console.log("🔍 새 API 키로 간단한 테스트...\n");

  try {
    console.log("📡 가장 기본적인 엔드포인트 테스트 (timezone)...");
    
    const response = await fetch("https://api-football-v1.p.rapidapi.com/v3/timezone", {
      method: 'GET',
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
      }
    });

    console.log(`응답 코드: ${response.status}`);
    console.log(`응답 상태: ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`응답 내용: ${responseText}`);
    
    if (response.ok) {
      console.log("✅ API 접근 성공!");
      
      // 성공하면 8월 30일 경기 시도
      console.log("\n📋 8월 30일 경기 데이터 시도...");
      
      const fixtureResponse = await fetch("https://api-football-v1.p.rapidapi.com/v3/fixtures?id=1340863", {
        method: 'GET',
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
      });
      
      console.log(`경기 데이터 응답: ${fixtureResponse.status}`);
      
      if (fixtureResponse.ok) {
        const fixtureData = await fixtureResponse.json();
        console.log(`✅ 경기 데이터 성공: ${fixtureData.response?.length || 0}개`);
        
        // 이벤트 데이터 시도
        console.log("\n⚽ 이벤트 데이터 시도...");
        
        const eventResponse = await fetch("https://api-football-v1.p.rapidapi.com/v3/fixtures/events?fixture=1340863", {
          method: 'GET',
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
          }
        });
        
        console.log(`이벤트 데이터 응답: ${eventResponse.status}`);
        
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          console.log(`✅ 이벤트 데이터 성공: ${eventData.response?.length || 0}개`);
          
          const goalEvents = eventData.response?.filter((event: any) => event.type === "Goal") || [];
          console.log(`⚽ 골 이벤트: ${goalEvents.length}개`);
          
          const jeonJinWooGoals = goalEvents.filter((event: any) => event.player.id === 34708);
          if (jeonJinWooGoals.length > 0) {
            console.log(`🎯 전진우 골 발견: ${jeonJinWooGoals.length}개!`);
            jeonJinWooGoals.forEach((goal: any, index: number) => {
              console.log(`   ${index + 1}. ${goal.time.elapsed}분 | ${goal.detail}`);
            });
            
            console.log("\n✅ 문제 해결! 전진우 골 데이터를 찾았습니다!");
          } else {
            console.log("❌ 전진우 골을 찾을 수 없음");
          }
        } else {
          const errorText = await eventResponse.text();
          console.log(`❌ 이벤트 실패: ${errorText}`);
        }
      } else {
        const errorText = await fixtureResponse.text();
        console.log(`❌ 경기 데이터 실패: ${errorText}`);
      }
    } else {
      console.log(`❌ API 접근 실패`);
      console.log(`오류: ${responseText}`);
    }
    
  } catch (error) {
    console.error(`💥 네트워크 오류:`, error);
  }
}

simpleAPITest();