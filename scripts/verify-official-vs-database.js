// verify-official-vs-database.js - 공식 홈페이지와 데이터베이스 비교
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

// K-League 공식 홈페이지에서 확인한 Goal TOP5 (2025시즌)
const officialGoalRanking = [
  { rank: 1, name: "Jinwoo", goals: 14, team: "JEONBUK" },
  { rank: 2, name: "Unknown2", goals: 12, team: "JEONBUK" },
  { rank: 3, name: "Unknown3", goals: 12, team: "SUWON FC" },
  { rank: 4, name: "Hojae", goals: 12, team: "POHANG" },
  { rank: 5, name: "JOO Minkyu", goals: 11, team: "DAEJEON HANA" }
];

async function getDatabaseGoalRanking() {
  console.log('📊 데이터베이스에서 골 순위 조회...');
  
  try {
    // 2025시즌 K-League 1 골 데이터 조회
    const { data: goalEvents, error } = await supabase
      .from('events')
      .select(`
        player_id,
        players(name),
        fixtures!inner(season_year, league_id)
      `)
      .eq('type', 'Goal')
      .eq('fixtures.season_year', 2025)
      .eq('fixtures.league_id', 292)  // K-League 1
      .not('player_id', 'is', null);
    
    if (error) throw error;
    
    if (!goalEvents || goalEvents.length === 0) {
      console.log('❌ 2025 시즌 K-League 1 골 데이터가 없습니다.');
      
      // 전체 골 데이터로 대체 시도
      const { data: allGoals } = await supabase
        .from('events')
        .select('player_id, players(name)')
        .eq('type', 'Goal')
        .not('player_id', 'is', null)
        .limit(1000);
      
      if (allGoals && allGoals.length > 0) {
        console.log(`⚠️ 전체 골 데이터 ${allGoals.length}개로 분석 (시즌/리그 필터 없음)`);
        return analyzeGoalData(allGoals, false);
      }
      
      return [];
    }
    
    console.log(`✅ 2025 K-League 1 골 데이터 ${goalEvents.length}개 조회 성공`);
    return analyzeGoalData(goalEvents, true);
    
  } catch (error) {
    console.error('❌ 데이터베이스 조회 실패:', error.message);
    return [];
  }
}

function analyzeGoalData(goalEvents, isFiltered) {
  // 선수별 골 집계
  const goalCounts = {};
  
  goalEvents.forEach(event => {
    const playerId = event.player_id;
    const playerName = event.players?.name || `Player ${playerId}`;
    
    if (!goalCounts[playerId]) {
      goalCounts[playerId] = {
        name: playerName,
        goals: 0
      };
    }
    goalCounts[playerId].goals++;
  });
  
  // 정렬하여 TOP 10
  const topScorers = Object.values(goalCounts)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);
  
  console.log(`\n🏆 데이터베이스 득점 순위 (${isFiltered ? '2025 K-League 1' : '전체 데이터'}):`);
  topScorers.forEach((scorer, index) => {
    console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
  });
  
  return topScorers;
}

function compareRankings(official, database) {
  console.log('\n🔍 공식 홈페이지 vs 데이터베이스 비교:');
  console.log('=======================================');
  
  console.log('\n📋 공식 K-League 홈페이지 (2025시즌):');
  official.forEach(player => {
    console.log(`  ${player.rank}. ${player.name}: ${player.goals}골 (${player.team})`);
  });
  
  console.log('\n💾 현재 데이터베이스:');
  if (database.length === 0) {
    console.log('  ❌ 데이터 없음');
    return;
  }
  
  database.slice(0, 5).forEach((scorer, index) => {
    console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
  });
  
  // 주요 선수들 비교
  console.log('\n🎯 주요 선수 비교:');
  
  const comparisons = [
    { official: "Jinwoo", db: "Jeon Jin-Woo" },
    { official: "JOO Minkyu", db: "Joo Min-Kyu" },
    { official: "Hojae", db: "Lee Ho-Jae" }
  ];
  
  comparisons.forEach(comp => {
    const officialPlayer = official.find(p => p.name.includes(comp.official.split(' ')[0]));
    const dbPlayer = database.find(p => p.name.includes(comp.db.split(' ')[0]) || 
                                         p.name.includes(comp.official.split(' ')[0]));
    
    if (officialPlayer && dbPlayer) {
      const difference = dbPlayer.goals - officialPlayer.goals;
      console.log(`  ${comp.official}: 공식 ${officialPlayer.goals}골 vs DB ${dbPlayer.goals}골 (차이: ${difference > 0 ? '+' : ''}${difference})`);
    } else {
      console.log(`  ${comp.official}: 공식 ${officialPlayer?.goals || 'N/A'}골 vs DB ${dbPlayer?.goals || 'N/A'}골`);
    }
  });
}

async function checkWebApplication() {
  console.log('\n🌐 웹 애플리케이션 확인...');
  console.log('웹 페이지: http://localhost:5175/leagues/k-league-1');
  console.log('💡 수동으로 웹 페이지를 확인하여 표시되는 통계를 비교해주세요.');
}

async function main() {
  console.log('🔍 공식 K-League vs 데이터베이스 비교 검증');
  console.log('==========================================');
  
  // 1. 데이터베이스에서 골 순위 조회
  const databaseRanking = await getDatabaseGoalRanking();
  
  // 2. 공식 홈페이지와 비교
  compareRankings(officialGoalRanking, databaseRanking);
  
  // 3. 웹 애플리케이션 확인 안내
  await checkWebApplication();
  
  console.log('\n📊 결론:');
  if (databaseRanking.length === 0) {
    console.log('❌ 데이터베이스에 2025 K-League 1 골 데이터가 없거나 부족합니다.');
    console.log('🔧 해결 방법:');
    console.log('   1. fixture_events 테이블 생성');
    console.log('   2. API-Football에서 2025시즌 데이터 재임포트');
    console.log('   3. 중복 방지 제약조건으로 정확한 데이터 보장');
  } else {
    // 차이점 분석
    const topDbScorer = databaseRanking[0];
    const topOfficialScorer = officialGoalRanking[0];
    
    if (topDbScorer.goals !== topOfficialScorer.goals) {
      console.log('⚠️ 데이터 불일치 발견!');
      console.log(`   DB: ${topDbScorer.name} ${topDbScorer.goals}골`);
      console.log(`   공식: ${topOfficialScorer.name} ${topOfficialScorer.goals}골`);
      console.log('🔧 원인: 중복 데이터 또는 잘못된 집계');
    } else {
      console.log('✅ 데이터가 공식 기록과 일치합니다!');
    }
  }
}

main().catch(console.error);