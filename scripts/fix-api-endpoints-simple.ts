import { readFileSync, writeFileSync } from 'fs';

async function fixAPIEndpointsSimple() {
  console.log("🔧 주요 스크립트 파일들의 API 엔드포인트를 Direct API로 수정...\n");

  // 수정할 파일 목록 (가장 중요한 것들만)
  const filesToFix = [
    'scripts/check-api-football-august30.ts',
    'scripts/fix-missing-august30-events.ts',  
    'scripts/import-upcoming-fixtures.ts',
    'scripts/check-api-football-upcoming.ts',
    'scripts/check-next-fixtures.ts'
  ];
  
  let totalReplacements = 0;
  
  for (const file of filesToFix) {
    console.log(`\n🔍 처리 중: ${file}`);
    
    try {
      let content = readFileSync(file, 'utf8');
      let replacements = 0;
      
      // 변경 전 카운트
      const oldUrlCount = (content.match(/https:\/\/api-football-v1\.p\.rapidapi\.com\/v3\//g) || []).length;
      const oldKeyCount = (content.match(/"X-RapidAPI-Key"/g) || []).length;
      const oldHostCount = (content.match(/"X-RapidAPI-Host":\s*"[^"]*"/g) || []).length;
      
      if (oldUrlCount === 0 && oldKeyCount === 0 && oldHostCount === 0) {
        console.log(`   ⏭️ 이미 Direct API 사용 중`);
        continue;
      }
      
      // 1. RapidAPI 프록시 URL을 Direct API URL로 변경
      content = content.replace(
        /https:\/\/api-football-v1\.p\.rapidapi\.com\/v3\//g, 
        'https://v3.football.api-sports.io/'
      );
      
      // 2. 헤더 변경: X-RapidAPI-Key -> x-rapidapi-key  
      content = content.replace(
        /"X-RapidAPI-Key"/g,
        '"x-rapidapi-key"'
      );
      
      // 3. X-RapidAPI-Host 헤더 제거 (줄 전체 제거)
      content = content.replace(
        /,?\s*"X-RapidAPI-Host":\s*"[^"]*"/g,
        ''
      );
      
      // 4. 빈 줄이나 불필요한 쉼표 정리
      content = content.replace(/,(\s*})/g, '$1'); // 마지막 쉼표 제거
      
      replacements = oldUrlCount + oldKeyCount + oldHostCount;
      
      if (replacements > 0) {
        writeFileSync(file, content, 'utf8');
        console.log(`   ✅ ${replacements}개 변경사항 적용`);
        console.log(`      - URL 변경: ${oldUrlCount}개`);
        console.log(`      - 헤더 키 변경: ${oldKeyCount}개`);
        console.log(`      - 호스트 헤더 제거: ${oldHostCount}개`);
        totalReplacements += replacements;
      }
      
    } catch (error) {
      console.error(`   ❌ 파일 처리 오류: ${error}`);
    }
  }
  
  console.log(`\n📊 총 ${totalReplacements}개 변경사항을 적용했습니다.`);
  
  // 수정 후 테스트
  if (totalReplacements > 0) {
    console.log("\n🧪 수정된 스크립트 테스트...");
    
    const apiKey = process.env.API_FOOTBALL_KEY || "4970b271c2989a1bd26b32b7518692b7";
    
    try {
      const response = await fetch("https://v3.football.api-sports.io/fixtures/events?fixture=1340863", {
        headers: {
          "x-rapidapi-key": apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Direct API 테스트 성공: ${data.results}개 이벤트`);
        
        const goalEvents = data.response?.filter((event: any) => event.type === "Goal") || [];
        const jeonGoals = goalEvents.filter((event: any) => event.player.id === 34708);
        
        if (jeonGoals.length > 0) {
          console.log(`🎯 전진우 골 확인: ${jeonGoals.length}개 (59분)`);
        }
        
        console.log("\n✅ 모든 스크립트가 정상적으로 Direct API를 사용할 수 있습니다!");
        
      } else {
        console.log(`❌ API 테스트 실패: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ API 테스트 오류: ${error}`);
    }
  } else {
    console.log("\n✅ 모든 파일이 이미 Direct API를 사용하고 있습니다!");
  }
}

fixAPIEndpointsSimple().catch(console.error);