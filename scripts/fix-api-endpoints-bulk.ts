import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

async function fixAPIEndpoints() {
  console.log("🔧 모든 스크립트 파일의 API 엔드포인트를 Direct API로 일괄 수정...\n");

  // scripts 디렉토리의 모든 .ts 파일 찾기 (lib 제외)
  const files = await glob('scripts/*.ts', { ignore: 'scripts/lib/**' });
  
  console.log(`📁 대상 파일: ${files.length}개`);
  
  let totalReplacements = 0;
  
  for (const file of files) {
    console.log(`\n🔍 처리 중: ${file}`);
    
    try {
      let content = readFileSync(file, 'utf8');
      let replacements = 0;
      
      // RapidAPI 프록시 URL을 Direct API URL로 변경
      const oldContent = content;
      content = content.replace(
        /https:\/\/api-football-v1\.p\.rapidapi\.com\/v3\//g, 
        'https://v3.football.api-sports.io/'
      );
      
      // 헤더 변경: X-RapidAPI-Key -> x-rapidapi-key
      content = content.replace(
        /"X-RapidAPI-Key"/g,
        '"x-rapidapi-key"'
      );
      
      // 헤더 변경: X-RapidAPI-Host 제거 (Direct API에서는 불필요)
      content = content.replace(
        /,?\s*"X-RapidAPI-Host":\s*"[^"]*"/g,
        ''
      );
      
      // 변경사항 계산
      const urlMatches = (oldContent.match(/api-football-v1\.p\.rapidapi\.com/g) || []).length;
      const headerMatches = (oldContent.match(/"X-RapidAPI-Key"/g) || []).length;
      const hostMatches = (oldContent.match(/"X-RapidAPI-Host"/g) || []).length;
      
      replacements = urlMatches + headerMatches + hostMatches;
      
      if (replacements > 0) {
        writeFileSync(file, content, 'utf8');
        console.log(`   ✅ ${replacements}개 변경사항 적용`);
        console.log(`      - URL 변경: ${urlMatches}개`);
        console.log(`      - 헤더 변경: ${headerMatches}개`);
        console.log(`      - 호스트 헤더 제거: ${hostMatches}개`);
        totalReplacements += replacements;
      } else {
        console.log(`   ⏭️ 변경사항 없음`);
      }
      
    } catch (error) {
      console.error(`   ❌ 오류 발생: ${error}`);
    }
  }
  
  console.log(`\n📊 총 ${totalReplacements}개 변경사항을 ${files.length}개 파일에 적용했습니다.`);
  console.log("\n✅ 모든 스크립트가 Direct API를 사용하도록 수정 완료!");
  
  // 수정 후 간단한 테스트
  console.log("\n🧪 수정 후 API 접근 테스트...");
  
  const apiKey = process.env.API_FOOTBALL_KEY || "4970b271c2989a1bd26b32b7518692b7";
  
  try {
    const response = await fetch("https://v3.football.api-sports.io/fixtures/events?fixture=1340863", {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API 테스트 성공: ${data.results}개 이벤트 수신`);
    } else {
      console.log(`❌ API 테스트 실패: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ API 테스트 오류: ${error}`);
  }
}

fixAPIEndpoints().catch(console.error);