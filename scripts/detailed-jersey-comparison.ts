import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;
const apiKey = process.env.API_FOOTBALL_KEY;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAPIFootballData(endpoint: string) {
  try {
    const response = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
      headers: {
        'x-apisports-key': apiKey!,
        'x-apisports-host': 'v3.football.api-sports.io'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    return null;
  }
}

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPlayerMatch(apiPlayer: any, dbPlayers: any[]): any {
  const apiName = normalizePlayerName(apiPlayer.name);
  
  // 정확한 이름 매칭 시도
  let match = dbPlayers.find(db => normalizePlayerName(db.name) === apiName);
  
  if (!match) {
    // 부분 매칭 시도 (성 또는 이름)
    const nameParts = apiName.split(' ');
    match = dbPlayers.find(db => {
      const dbNameParts = normalizePlayerName(db.name).split(' ');
      return nameParts.some(part => dbNameParts.some(dbPart => 
        part.length > 2 && dbPart.includes(part)
      ));
    });
  }
  
  return match;
}

async function detailedJerseyComparison() {
  console.log('🔍 상세 등번호 비교 분석...\n');

  try {
    // 1. K League 1 팀들 가져오기
    const teamsData = await fetchAPIFootballData('teams?league=292&season=2025');
    
    if (!teamsData?.response) {
      console.error('❌ 팀 데이터를 가져올 수 없습니다.');
      return;
    }

    console.log(`📊 총 ${teamsData.response.length}개 팀 분석 시작...\n`);

    let totalAPIPlayers = 0;
    let totalDBPlayers = 0;
    let totalMatches = 0;
    let jerseyMatches = 0;
    let jerseyMismatches = 0;
    let missingInDB = 0;
    let missingInAPI = 0;

    // 처음 3개 팀만 상세 분석 (API 호출 제한 고려)
    const teamsToAnalyze = teamsData.response.slice(0, 3);

    for (const teamData of teamsToAnalyze) {
      const teamId = teamData.team.id;
      const teamName = teamData.team.name;
      
      console.log(`🏈 ${teamName} (ID: ${teamId}) 분석:`);

      // API에서 현재 스쿼드 가져오기
      const squadData = await fetchAPIFootballData(`players/squads?team=${teamId}`);
      
      if (!squadData?.response?.[0]) {
        console.log(`  ❌ ${teamName} 스쿼드 데이터 없음\n`);
        continue;
      }

      const apiPlayers = squadData.response[0].players || [];
      totalAPIPlayers += apiPlayers.length;

      // 데이터베이스에서 해당 팀 선수 가져오기
      const { data: dbPlayers } = await supabase
        .from('players')
        .select('id, name, jersey_number, position')
        .eq('team_id', teamId);

      const dbPlayerCount = dbPlayers?.length || 0;
      totalDBPlayers += dbPlayerCount;

      console.log(`  API 스쿼드: ${apiPlayers.length}명`);
      console.log(`  DB 선수: ${dbPlayerCount}명`);

      if (dbPlayerCount === 0) {
        console.log(`  ⚠️ 데이터베이스에 ${teamName} 선수 정보 없음\n`);
        missingInDB += apiPlayers.length;
        continue;
      }

      // 선수별 비교
      console.log(`\n  📋 선수별 등번호 비교:`);
      let teamMatches = 0;
      let teamJerseyMatches = 0;
      let teamJerseyMismatches = 0;
      let teamMissingInDB = 0;

      apiPlayers.forEach((apiPlayer: any) => {
        const matchedPlayer = findPlayerMatch(apiPlayer, dbPlayers!);
        
        if (matchedPlayer) {
          teamMatches++;
          totalMatches++;
          
          const apiJersey = apiPlayer.number;
          const dbJersey = matchedPlayer.jersey_number;
          
          if (apiJersey === dbJersey) {
            teamJerseyMatches++;
            jerseyMatches++;
            console.log(`    ✅ ${apiPlayer.name}: #${apiJersey} (일치)`);
          } else {
            teamJerseyMismatches++;
            jerseyMismatches++;
            console.log(`    ❌ ${apiPlayer.name}: API #${apiJersey} ≠ DB #${dbJersey || 'NULL'}`);
          }
        } else {
          teamMissingInDB++;
          missingInDB++;
          console.log(`    ❓ ${apiPlayer.name}: API #${apiPlayer.number} (DB에 없음)`);
        }
      });

      // DB에만 있는 선수 확인
      const dbOnlyPlayers = dbPlayers!.filter(dbPlayer => {
        return !apiPlayers.some((apiPlayer: any) => 
          findPlayerMatch(apiPlayer, [dbPlayer])
        );
      });

      missingInAPI += dbOnlyPlayers.length;

      if (dbOnlyPlayers.length > 0) {
        console.log(`\n  🔍 DB에만 있는 선수 (${dbOnlyPlayers.length}명):`);
        dbOnlyPlayers.slice(0, 5).forEach(player => {
          console.log(`    📝 ${player.name}: #${player.jersey_number || 'NULL'} (API에 없음)`);
        });
        if (dbOnlyPlayers.length > 5) {
          console.log(`    ... 및 ${dbOnlyPlayers.length - 5}명 추가`);
        }
      }

      console.log(`\n  📊 ${teamName} 요약:`);
      console.log(`    매칭된 선수: ${teamMatches}명`);
      console.log(`    등번호 일치: ${teamJerseyMatches}명`);
      console.log(`    등번호 불일치: ${teamJerseyMismatches}명`);
      console.log(`    DB 누락: ${teamMissingInDB}명`);
      console.log(`    API 누락: ${dbOnlyPlayers.length}명\n`);

      // API 호출 제한을 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 전체 요약
    console.log(`\n📈 전체 분석 요약 (${teamsToAnalyze.length}개 팀):`);
    console.log(`  총 API 선수: ${totalAPIPlayers}명`);
    console.log(`  총 DB 선수: ${totalDBPlayers}명`);
    console.log(`  매칭된 선수: ${totalMatches}명`);
    console.log(`  등번호 일치: ${jerseyMatches}명 (${((jerseyMatches/totalMatches)*100).toFixed(1)}%)`);
    console.log(`  등번호 불일치: ${jerseyMismatches}명 (${((jerseyMismatches/totalMatches)*100).toFixed(1)}%)`);
    console.log(`  DB 누락 선수: ${missingInDB}명`);
    console.log(`  API 누락 선수: ${missingInAPI}명`);

    // 문제 분석
    console.log(`\n🔍 주요 문제점:`);
    if (jerseyMismatches > jerseyMatches * 0.1) {
      console.log(`  ⚠️ 등번호 불일치율 높음 (${((jerseyMismatches/totalMatches)*100).toFixed(1)}%)`);
    }
    if (missingInDB > totalAPIPlayers * 0.1) {
      console.log(`  ⚠️ DB에 누락된 선수 많음 (${missingInDB}명)`);
    }
    if (missingInAPI > totalDBPlayers * 0.1) {
      console.log(`  ⚠️ API에 없는 선수 많음 (${missingInAPI}명 - 이적/은퇴 가능성)`);
    }

    console.log(`\n💡 개선 방안:`);
    console.log(`  1. 🔄 주기적 스쿼드 동기화 (주 1회)`);
    console.log(`  2. 📊 등번호 변경 감지 시스템`);
    console.log(`  3. 🏃‍♂️ 선수 이적/은퇴 상태 추적`);
    console.log(`  4. 🔗 선수 ID 매핑 테이블 구축`);
    console.log(`  5. ✅ 데이터 품질 모니터링 대시보드`);

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

detailedJerseyComparison().catch(console.error);