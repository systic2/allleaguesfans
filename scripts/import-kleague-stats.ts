import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

interface KLeaguePlayerRecord {
  year: number;
  leagueId: number;
  recordType: string;
  rank: number;
  name: string;
  playerId: number;
  teamId: number;
  teamName: string;
  qty: number;
  qtyPerGame: number;
  gameQty: number;
  backNo?: number;
  playTime?: number;
  playerImageUrl?: string;
}

interface KLeagueAPIResponse {
  resultCode: string;
  resultMsg: string;
  resultMsgEn: string | null;
  data: {
    goal: {
      league1: KLeaguePlayerRecord[];
      league2: KLeaguePlayerRecord[];
    };
    assist: {
      league1: KLeaguePlayerRecord[];
      league2: KLeaguePlayerRecord[];
    };
    clean: {
      league1: KLeaguePlayerRecord[];
      league2: KLeaguePlayerRecord[];
    };
  };
}

// Team ID mapping from K League to our database IDs (API-Football IDs)
const TEAM_ID_MAPPING: Record<string, number> = {
  // K League 1 teams (league 292)
  'K05': 2762, // 전북 (Jeonbuk Motors)
  'K09': 2764, // 서울 (FC Seoul)
  'K03': 2766, // 포항 (Pohang Steelers)
  'K22': 2767, // 광주 (Gwangju FC)
  'K17': 2768, // 대구 (Daegu FC)
  'K35': 2773, // 김천 (Gimcheon Sangmu)
  'K29': 2772, // 수원FC (Suwon FC)
  'K04': 2771, // 제주 (Jeju United)
  'K10': 8635, // 대전 (Daejeon Hana Citizen)
  'K27': 8636, // 안양 (FC Anyang)
  'K01': 2763, // 울산 (Ulsan HD)
  'K21': 2770, // 강원 (Gangwon FC)
  
  // K League 2 teams (league 293)
  'K18': 2769, // 인천 (Incheon United)
  'K06': 2774, // 부산 (Busan IPark)
  'K08': 2775, // 성남 (Seongnam FC)
  'K07': 2776, // 전남 (Jeonnam Dragons)
  'K02': 2765, // 수원 (Suwon Samsung)
  'K31': 15194, // 서울E (Seoul E-Land)
  'K26': 15195, // 부천 (Bucheon FC 1995)
  'K36': 15196, // 김포 (Gimpo FC)
  'K34': 15197, // 충남아산 (Chungnam Asan FC)
  
  // Default fallback - use a high number for unmapped teams
};

async function importKLeagueTopScorers(leagueId: number, seasonYear: number) {
  console.log(`🏆 K League 공식 득점왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

  try {
    const response = await fetch('https://www.kleague.com/api/playerRecord.do');
    const data: KLeagueAPIResponse = await response.json();
    
    // Select the appropriate league data
    const goalData = leagueId === 292 ? data.data.goal.league1 : data.data.goal.league2;
    
    if (!goalData || goalData.length === 0) {
      console.log('  ⚠️ K League 득점왕 데이터 없음');
      return;
    }

    const scorersData = goalData.map((player: KLeaguePlayerRecord) => {
      const mappedTeamId = TEAM_ID_MAPPING[player.teamId] || 99999; // Use high number for unmapped teams
      
      return {
        league_id: leagueId,
        season_year: seasonYear,
        player_id: player.playerId,
        player_name: player.name,
        player_photo: player.playerImageUrl || null,
        team_id: mappedTeamId,
        team_name: player.teamName,
        team_logo: null, // K League API doesn't provide team logos
        rank_position: player.rank,
        goals: player.qty,
        assists: 0, // Goals data doesn't include assists
        appearances: player.gameQty,
        minutes: player.playTime || 0,
        penalties_scored: 0, // Not available in K League API
        penalties_missed: 0, // Not available in K League API
        yellow_cards: 0, // Not available in K League API
        red_cards: 0, // Not available in K League API
        player_rating: null // Not available in K League API
      };
    });

    // Clear existing data for this league/season to avoid duplicates
    await supabase
      .from('top_scorers')
      .delete()
      .eq('league_id', leagueId)
      .eq('season_year', seasonYear);

    const { error } = await supabase
      .from('top_scorers')
      .insert(scorersData);

    if (error) {
      console.error('  ❌ K League 득점왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${scorersData.length}명 K League 득점왕 순위 임포트 완료`);
      
      // Show top 3 for verification
      console.log('  🏆 Top 3 득점왕:');
      scorersData.slice(0, 3).forEach((player, index) => {
        console.log(`    ${index + 1}. ${player.player_name} (${player.team_name}) - ${player.goals}골`);
      });
    }
  } catch (error) {
    console.error('  ❌ K League API 호출 에러:', error);
  }
}

async function importKLeagueTopAssists(leagueId: number, seasonYear: number) {
  console.log(`🎯 K League 공식 도움왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

  try {
    const response = await fetch('https://www.kleague.com/api/playerRecord.do');
    const data: KLeagueAPIResponse = await response.json();
    
    // Select the appropriate league data
    const assistData = leagueId === 292 ? data.data.assist.league1 : data.data.assist.league2;
    
    if (!assistData || assistData.length === 0) {
      console.log('  ⚠️ K League 도움왕 데이터 없음');
      return;
    }

    const assistsData = assistData.map((player: KLeaguePlayerRecord) => {
      const mappedTeamId = TEAM_ID_MAPPING[player.teamId] || 99999; // Use high number for unmapped teams
      
      return {
        league_id: leagueId,
        season_year: seasonYear,
        player_id: player.playerId,
        player_name: player.name,
        player_photo: player.playerImageUrl || null,
        team_id: mappedTeamId,
        team_name: player.teamName,
        team_logo: null, // K League API doesn't provide team logos
        rank_position: player.rank,
        assists: player.qty,
        goals: 0, // Assists data doesn't include goals
        appearances: player.gameQty,
        minutes: player.playTime || 0,
        key_passes: 0, // Not available in K League API
        yellow_cards: 0, // Not available in K League API
        red_cards: 0, // Not available in K League API
        player_rating: null // Not available in K League API
      };
    });

    // Clear existing data for this league/season to avoid duplicates
    await supabase
      .from('top_assists')
      .delete()
      .eq('league_id', leagueId)
      .eq('season_year', seasonYear);

    const { error } = await supabase
      .from('top_assists')
      .insert(assistsData);

    if (error) {
      console.error('  ❌ K League 도움왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${assistsData.length}명 K League 도움왕 순위 임포트 완료`);
      
      // Show top 3 for verification
      console.log('  🎯 Top 3 도움왕:');
      assistsData.slice(0, 3).forEach((player, index) => {
        console.log(`    ${index + 1}. ${player.player_name} (${player.team_name}) - ${player.assists}도움`);
      });
    }
  } catch (error) {
    console.error('  ❌ K League API 호출 에러:', error);
  }
}

async function main() {
  console.log('🔥 K League 공식 득점왕 및 도움왕 데이터 임포트 시작');
  console.log('======================================================================');

  const seasonYear = parseInt(process.env.SEASON_YEAR || '2025');
  const leagues = [
    { id: 292, name: 'K League 1' },
    { id: 293, name: 'K League 2' }
  ];

  console.log(`📅 시즌: ${seasonYear}`);
  console.log(`🏆 리그: ${leagues.map(l => l.name).join(', ')}`);
  console.log(`📊 데이터 소스: K League 공식 API\n`);

  for (const league of leagues) {
    console.log(`\n${league.name} (${league.id}) 처리 중...`);
    await importKLeagueTopScorers(league.id, seasonYear);
    await importKLeagueTopAssists(league.id, seasonYear);
  }

  console.log('\n======================================================================');
  console.log('🎉 K League 공식 득점왕 및 도움왕 임포트 완료!');
  console.log('💡 정확한 K League 공식 데이터를 사용합니다.');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ K League 임포트 실패:', error);
    process.exit(1);
  });
}

export { importKLeagueTopScorers, importKLeagueTopAssists };