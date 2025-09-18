const apiKey = "4970b271c2989a1bd26b32b7518692b7";

async function testLineupAPI() {
  console.log("🔍 API-Football 라인업 API 테스트...\n");

  // 최근 완료된 경기의 라인업 확인 (8월 30일 울산 vs 전북)
  const fixtureId = 1340863;

  try {
    console.log(`📋 Fixture ${fixtureId} 라인업 데이터 확인...`);
    
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    console.log(`응답 코드: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API 접근 성공!`);
      console.log(`결과 수: ${data.results}`);
      console.log(`라인업 데이터: ${data.response?.length || 0}팀\n`);
      
      if (data.response && data.response.length > 0) {
        data.response.forEach((teamLineup: any, index: number) => {
          console.log(`\n${index + 1}. 팀: ${teamLineup.team.name} (${teamLineup.team.id})`);
          console.log(`   코치: ${teamLineup.coach?.name || '정보 없음'}`);
          console.log(`   포메이션: ${teamLineup.formation || '정보 없음'}`);
          
          if (teamLineup.startXI && teamLineup.startXI.length > 0) {
            console.log(`   선발 라인업 (${teamLineup.startXI.length}명):`);
            teamLineup.startXI.forEach((player: any) => {
              console.log(`     ${player.player.number}. ${player.player.name} (${player.player.pos})`);
            });
          }
          
          if (teamLineup.substitutes && teamLineup.substitutes.length > 0) {
            console.log(`   후보 선수 (${teamLineup.substitutes.length}명):`);
            teamLineup.substitutes.slice(0, 5).forEach((player: any) => {
              console.log(`     ${player.player.number}. ${player.player.name} (${player.player.pos})`);
            });
            if (teamLineup.substitutes.length > 5) {
              console.log(`     ... 외 ${teamLineup.substitutes.length - 5}명`);
            }
          }
        });
      } else {
        console.log("❌ 라인업 데이터를 찾을 수 없음");
      }
      
      // JSON 구조 샘플 출력
      console.log("\n📄 API 응답 구조:");
      console.log(JSON.stringify(data, null, 2).substring(0, 1000) + "...");
      
    } else {
      const errorText = await response.text();
      console.log(`❌ API 요청 실패: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`💥 네트워크 오류:`, error);
  }

  // 다른 경기도 테스트해보기
  console.log("\n🔄 다른 경기 테스트...");
  const testFixtures = [1340870, 1340869]; // 최근 경기들
  
  for (const testFixture of testFixtures) {
    try {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${testFixture}`, {
        headers: {
          "x-rapidapi-key": apiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   Fixture ${testFixture}: ${data.results}개 결과, ${data.response?.length || 0}팀`);
      } else {
        console.log(`   Fixture ${testFixture}: ${response.status} 오류`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // API 제한 고려
      
    } catch (error) {
      console.log(`   Fixture ${testFixture}: 네트워크 오류`);
    }
  }
}

testLineupAPI();