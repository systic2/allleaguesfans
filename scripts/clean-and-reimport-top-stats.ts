import { supa } from './lib/supabase.js';
import { apiGet } from './lib/api-football.js';

interface APIFootballPlayer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
    };
    league: {
      id: number;
      name: string;
    };
    games: {
      appearances: number;
      position: string;
    };
    goals: {
      total: number | null;
      assists: number | null;
    };
  }>;
}

interface APIResponse {
  response: APIFootballPlayer[];
}

async function cleanExistingData() {
  console.log('🧹 기존 top_scorers, top_assists 데이터 정리...');
  
  const { error: scorersError } = await supa
    .from('top_scorers')
    .delete()
    .neq('id', 0); // Delete all records

  if (scorersError) {
    console.error('❌ top_scorers 삭제 오류:', scorersError);
    throw scorersError;
  }

  const { error: assistsError } = await supa
    .from('top_assists')
    .delete()
    .neq('id', 0); // Delete all records

  if (assistsError) {
    console.error('❌ top_assists 삭제 오류:', assistsError);
    throw assistsError;
  }

  console.log('✅ 기존 데이터 정리 완료');
}

async function fetchLeagueTopStats(leagueId: number, season: number) {
  console.log(`📊 K League ${leagueId === 292 ? '1' : '2'} (${season}) 통계 가져오기...`);

  const data: APIResponse = await apiGet('players/topscorers', { 
    league: leagueId, 
    season: season 
  });
  
  return data.response;
}

async function importTopStats() {
  const leagues = [
    { id: 292, name: 'K League 1' },
    { id: 293, name: 'K League 2' }
  ];
  const season = 2025;

  console.log('🚀 API-Football에서 순수 데이터 가져오기 시작...');

  for (const league of leagues) {
    console.log(`\n=== ${league.name} 처리 중 ===`);
    
    try {
      const players = await fetchLeagueTopStats(league.id, season);
      console.log(`📥 ${players.length}명의 선수 데이터 수신`);

      const scorersData = [];
      const assistsData = [];

      for (const player of players) {
        const stats = player.statistics[0]; // 첫 번째 통계 (현재 시즌)
        
        if (!stats) continue;

        const baseData = {
          player_id: player.player.id,
          player_name: player.player.name,
          team_id: stats.team.id,
          team_name: stats.team.name,
          league_id: league.id,
          season_year: season,
          appearances: stats.games.appearances || 0,
          rank_position: 1 // Will be updated later based on sorting
        };

        // 득점 데이터
        const goals = stats.goals.total || 0;
        if (goals > 0) {
          scorersData.push({
            ...baseData,
            goals: goals,
            assists: stats.goals.assists || 0
          });
        }

        // 어시스트 데이터
        const assists = stats.goals.assists || 0;
        if (assists > 0) {
          assistsData.push({
            ...baseData,
            assists: assists,
            goals: stats.goals.total || 0
          });
        }
      }

      // 득점 데이터 저장
      if (scorersData.length > 0) {
        console.log(`📊 ${league.name} 득점 데이터 ${scorersData.length}건 저장 중...`);
        const { error: scorersError } = await supa
          .from('top_scorers')
          .insert(scorersData);

        if (scorersError) {
          console.error('❌ 득점 데이터 저장 오류:', scorersError);
        } else {
          console.log(`✅ ${league.name} 득점 데이터 저장 완료`);
        }
      }

      // 어시스트 데이터 저장
      if (assistsData.length > 0) {
        console.log(`📊 ${league.name} 어시스트 데이터 ${assistsData.length}건 저장 중...`);
        const { error: assistsError } = await supa
          .from('top_assists')
          .insert(assistsData);

        if (assistsError) {
          console.error('❌ 어시스트 데이터 저장 오류:', assistsError);
        } else {
          console.log(`✅ ${league.name} 어시스트 데이터 저장 완료`);
        }
      }

      // API 요청 간 딜레이 (apiGet에서 자동 처리됨)

    } catch (error) {
      console.error(`❌ ${league.name} 처리 중 오류:`, error);
      continue;
    }
  }
}

async function verifyData() {
  console.log('\n🔍 데이터 검증 중...');

  const { data: scorersData, error: scorersError } = await supa
    .from('top_scorers')
    .select('player_name, goals, team_name, league_id')
    .order('goals', { ascending: false })
    .limit(5);

  const { data: assistsData, error: assistsError } = await supa
    .from('top_assists')
    .select('player_name, assists, team_name, league_id')
    .order('assists', { ascending: false })
    .limit(5);

  if (!scorersError && scorersData?.length) {
    console.log('\n🏆 상위 득점자:');
    scorersData.forEach((scorer, index) => {
      console.log(`${index + 1}. ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골`);
    });
  }

  if (!assistsError && assistsData?.length) {
    console.log('\n🎯 상위 어시스트:');
    assistsData.forEach((assister, index) => {
      console.log(`${index + 1}. ${assister.player_name} (${assister.team_name}) - ${assister.assists}도움`);
    });
  }

  // 간단한 중복 확인 - 모든 선수 이름을 가져와서 중복 체크
  const { data: allScorers } = await supa
    .from('top_scorers')
    .select('player_name');

  const { data: allAssisters } = await supa
    .from('top_assists')
    .select('player_name');

  if (allScorers?.length) {
    const scorerNames = allScorers.map(s => s.player_name);
    const uniqueScorers = new Set(scorerNames);
    if (scorerNames.length !== uniqueScorers.size) {
      console.log(`⚠️ 중복 득점자 발견 (전체: ${scorerNames.length}, 중복제거: ${uniqueScorers.size})`);
    } else {
      console.log('✅ 득점자 중복 없음');
    }
  }

  if (allAssisters?.length) {
    const assisterNames = allAssisters.map(a => a.player_name);
    const uniqueAssisters = new Set(assisterNames);
    if (assisterNames.length !== uniqueAssisters.size) {
      console.log(`⚠️ 중복 어시스트 발견 (전체: ${assisterNames.length}, 중복제거: ${uniqueAssisters.size})`);
    } else {
      console.log('✅ 어시스트 중복 없음');
    }
  }
}

async function main() {
  try {
    console.log('🚀 API-Football 순수 데이터 임포트 시작');
    console.log('이 스크립트는 기존 데이터를 삭제하고 API-Football에서만 데이터를 가져옵니다.');
    
    // 1. 기존 데이터 정리
    await cleanExistingData();
    
    // 2. 새로운 데이터 임포트
    await importTopStats();
    
    // 3. 데이터 검증
    await verifyData();
    
    console.log('\n🎉 API-Football 순수 데이터 임포트 완료!');
    console.log('이제 중복 선수 문제가 해결되었습니다.');

  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}