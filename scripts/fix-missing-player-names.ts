import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface APIFootballPlayer {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  photo: string;
}

interface APIFootballPlayerResponse {
  response: Array<{
    player: APIFootballPlayer;
    statistics: Array<{
      team: {
        id: number;
        name: string;
        logo: string;
      };
    }>;
  }>;
}

// Player IDs with missing names from K League API
const MISSING_PLAYERS = [
  // 득점왕
  { playerId: 20250102, teamName: 'SUWON FC', teamId: 'K29', goals: 13, rank: 2, assists: 0 },
  { playerId: 20250061, teamName: 'JEONBUK', teamId: 'K05', goals: 12, rank: 3, assists: 0 },
  
  // 도움왕
  { playerId: 20240179, teamName: 'SEOUL', teamId: 'K09', assists: 7, rank: 2, goals: 0 },
  { playerId: 20230266, teamName: 'ANYANG', teamId: 'K27', assists: 6, rank: 4, goals: 0 },
  { playerId: 20230067, teamName: 'GIMCHEON', teamId: 'K35', assists: 6, rank: 5, goals: 0 },
];

// Team ID mapping from K League to API-Football
const TEAM_ID_MAPPING: Record<string, number> = {
  'K05': 2762, // 전북 (Jeonbuk Motors)
  'K09': 2764, // 서울 (FC Seoul)
  'K29': 2772, // 수원FC (Suwon FC)
  'K27': 8636, // 안양 (FC Anyang)
  'K35': 2773, // 김천 (Gimcheon Sangmu)
};

async function fetchPlayerNameFromAPIFootball(playerId: number, teamApiId: number): Promise<string | null> {
  try {
    console.log(`  🔍 API-Football에서 선수 정보 조회: playerId=${playerId}, teamId=${teamApiId}`);
    
    // Try to find player in current season
    const response = await fetch(
      `https://v3.football.api-sports.io/players?id=${playerId}&season=2025&team=${teamApiId}`,
      {
        headers: {
          'x-rapidapi-key': apiKey!,
        },
      }
    );

    const data: APIFootballPlayerResponse = await response.json();
    
    if (data.response && data.response.length > 0) {
      const playerName = data.response[0].player.name;
      console.log(`    ✅ 발견: ${playerName}`);
      return playerName;
    }
    
    console.log(`    ⚠️ 2025시즌에서 찾을 수 없음, 2024시즌 확인...`);
    
    // Try 2024 season if not found in 2025
    const response2024 = await fetch(
      `https://v3.football.api-sports.io/players?id=${playerId}&season=2024&team=${teamApiId}`,
      {
        headers: {
          'x-rapidapi-key': apiKey!,
        },
      }
    );

    const data2024: APIFootballPlayerResponse = await response2024.json();
    
    if (data2024.response && data2024.response.length > 0) {
      const playerName = data2024.response[0].player.name;
      console.log(`    ✅ 2024시즌에서 발견: ${playerName}`);
      return playerName;
    }
    
    console.log(`    ❌ API-Football에서 찾을 수 없음`);
    return null;
    
  } catch (error) {
    console.error(`    ❌ API 호출 에러:`, error);
    return null;
  }
}

async function fixMissingPlayerNames() {
  console.log('🔧 빈 선수 이름 수정 시작...\n');
  
  if (!apiKey) {
    console.error('❌ API_FOOTBALL_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  for (const player of MISSING_PLAYERS) {
    console.log(`\n📝 처리 중: ${player.teamName} 선수 (playerId: ${player.playerId})`);
    
    const teamApiId = TEAM_ID_MAPPING[player.teamId];
    if (!teamApiId) {
      console.log(`  ⚠️ 팀 ID 매핑 없음: ${player.teamId}`);
      continue;
    }
    
    const playerName = await fetchPlayerNameFromAPIFootball(player.playerId, teamApiId);
    
    if (playerName) {
      // Update top_scorers if this is a scorer
      if (player.goals > 0) {
        console.log(`  📊 득점왕 테이블 업데이트...`);
        const { error: scorerError } = await supabase
          .from('top_scorers')
          .update({ player_name: playerName })
          .eq('player_id', player.playerId)
          .eq('league_id', 292)
          .eq('season_year', 2025);
          
        if (scorerError) {
          console.error(`    ❌ 득점왕 업데이트 에러:`, scorerError);
        } else {
          console.log(`    ✅ 득점왕 업데이트 완료: ${playerName}`);
        }
      }
      
      // Update top_assists if this is an assist leader
      if (player.assists > 0) {
        console.log(`  🎯 도움왕 테이블 업데이트...`);
        const { error: assistError } = await supabase
          .from('top_assists')
          .update({ player_name: playerName })
          .eq('player_id', player.playerId)
          .eq('league_id', 292)
          .eq('season_year', 2025);
          
        if (assistError) {
          console.error(`    ❌ 도움왕 업데이트 에러:`, assistError);
        } else {
          console.log(`    ✅ 도움왕 업데이트 완료: ${playerName}`);
        }
      }
    } else {
      console.log(`  ❌ 선수 이름을 찾을 수 없음 - 수동 조사 필요`);
    }
    
    // Rate limiting - wait 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n======================================================================');
  console.log('🎉 빈 선수 이름 수정 완료!');
  console.log('💡 일부 선수 이름이 여전히 비어있다면 수동으로 업데이트가 필요할 수 있습니다.');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixMissingPlayerNames().catch((error) => {
    console.error('❌ 선수 이름 수정 실패:', error);
    process.exit(1);
  });
}

export { fixMissingPlayerNames };