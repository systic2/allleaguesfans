const apiKey = "4970b271c2989a1bd26b32b7518692b7";

async function testDirectAPI() {
  console.log("🔍 Direct API 엔드포인트로 8월 30일 전진우 골 데이터 확인...\n");

  try {
    // Direct API 엔드포인트 사용 (대시보드와 동일한 URL)
    const response = await fetch("https://v3.football.api-sports.io/fixtures/events?fixture=1340863&team=2762", {
      method: 'GET',
      headers: {
        "x-rapidapi-key": apiKey, // Direct API는 소문자 헤더 사용
        "x-rapidapi-host": "v3.football.api-sports.io"
      }
    });

    console.log(`응답 코드: ${response.status}`);
    console.log(`응답 상태: ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API 접근 성공!`);
      console.log(`전체 이벤트: ${data.results}개`);
      console.log(`응답 데이터: ${data.response?.length || 0}개\n`);
      
      // 골 이벤트 필터링
      const goalEvents = data.response?.filter((event: any) => event.type === "Goal") || [];
      console.log(`⚽ 골 이벤트: ${goalEvents.length}개`);
      
      // 전진우 골 확인
      const jeonJinWooGoals = goalEvents.filter((event: any) => 
        event.player.id === 34708 || event.player.name.includes("Jin-woo") || event.player.name.includes("Jeon")
      );
      
      if (jeonJinWooGoals.length > 0) {
        console.log(`\n🎯 전진우 골 발견: ${jeonJinWooGoals.length}개!`);
        jeonJinWooGoals.forEach((goal: any, index: number) => {
          console.log(`   ${index + 1}. ${goal.time.elapsed}분 ${goal.time.extra ? `+${goal.time.extra}` : ''}`);
          console.log(`      플레이어: ${goal.player.name} (ID: ${goal.player.id})`);
          console.log(`      타입: ${goal.detail}`);
          console.log(`      어시스트: ${goal.assist.name || '없음'}`);
        });
        
        console.log("\n✅ 성공! 이제 이 데이터를 데이터베이스에 임포트할 수 있습니다!");
        
      } else {
        console.log("❌ 전진우 골을 찾을 수 없습니다");
        console.log("\n전체 골 이벤트:");
        goalEvents.forEach((goal: any, index: number) => {
          console.log(`   ${index + 1}. ${goal.player.name} (${goal.player.id}) - ${goal.time.elapsed}분`);
        });
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ API 접근 실패`);
      console.log(`오류: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`💥 네트워크 오류:`, error);
  }

  // 다른 헤더 조합도 시도
  console.log("\n🔄 다른 헤더 조합 시도...");
  
  try {
    const response2 = await fetch("https://v3.football.api-sports.io/fixtures/events?fixture=1340863", {
      method: 'GET',
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    console.log(`헤더 최소화 응답: ${response2.status}`);
    
    if (response2.ok) {
      const data = await response2.json();
      console.log(`✅ 최소 헤더로도 성공: ${data.results}개 이벤트`);
    } else {
      const errorText = await response2.text();
      console.log(`❌ 최소 헤더 실패: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`💥 두 번째 테스트 오류:`, error);
  }
}

testDirectAPI();