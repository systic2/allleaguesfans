// simple-goal-analysis.js - 현재 골 데이터 간단 분석
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function analyzeCurrentGoals() {
  console.log('📊 현재 골 데이터 간단 분석');
  console.log('=====================================');
  
  try {
    // 전체 이벤트 수
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📈 총 이벤트 수: ${totalEvents?.toLocaleString()}개`);
    
    // 골 이벤트 수
    const { count: goalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Goal');
    
    console.log(`⚽ 골 이벤트 수: ${goalEvents?.toLocaleString()}개`);
    
    // 2025시즌 골 데이터 (간단한 방법)
    const { data: goals2025 } = await supabase
      .from('events')
      .select('player_id, players(name)')
      .eq('type', 'Goal')
      .not('player_id', 'is', null)
      .limit(1000);
    
    if (goals2025 && goals2025.length > 0) {
      // 수동으로 집계
      const goalCounts = {};
      goals2025.forEach(event => {
        const playerId = event.player_id;
        const playerName = event.players?.name || `Player ${playerId}`;
        
        if (!goalCounts[playerId]) {
          goalCounts[playerId] = { name: playerName, goals: 0 };
        }
        goalCounts[playerId].goals++;
      });
      
      // 정렬하여 TOP 10
      const topScorers = Object.values(goalCounts)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
      
      console.log('\n🏆 현재 DB 득점 순위 (전체 시즌):');
      topScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
      });
      
      return topScorers;
    }
    
    return [];
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    return [];
  }
}

// 공식 홈페이지 데이터 (이전에 추출한 내용)
const officialGoalRanking = [
  { rank: 1, name: "Jinwoo", goals: 14, team: "JEONBUK" },
  { rank: 2, name: "Unknown2", goals: 12, team: "JEONBUK" },
  { rank: 3, name: "Unknown3", goals: 12, team: "SUWON FC" },
  { rank: 4, name: "Hojae", goals: 12, team: "POHANG" },
  { rank: 5, name: "JOO Minkyu", goals: 11, team: "DAEJEON HANA" }
];

function compareWithOfficial(databaseRanking) {
  console.log('\n🔍 공식 홈페이지 vs 현재 데이터베이스 비교:');
  console.log('=======================================');
  
  console.log('\n📋 공식 K-League 홈페이지 (2025시즌):');
  officialGoalRanking.forEach(player => {
    console.log(`  ${player.rank}. ${player.name}: ${player.goals}골 (${player.team})`);
  });
  
  console.log('\n💾 현재 데이터베이스:');
  if (databaseRanking.length === 0) {
    console.log('  ❌ 데이터 없음');
    return;
  }
  
  databaseRanking.slice(0, 5).forEach((scorer, index) => {
    console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
  });
  
  // 주요 선수들 비교
  console.log('\n🎯 주요 선수 비교:');
  
  const comparisons = [
    { official: "Jinwoo", officialGoals: 14, db: "Jeon Jin-Woo" },
    { official: "JOO Minkyu", officialGoals: 11, db: "Joo Min-Kyu" },
    { official: "Hojae", officialGoals: 12, db: "Lee Ho-Jae" }
  ];
  
  comparisons.forEach(comp => {
    const dbPlayer = databaseRanking.find(p => 
      p.name.includes(comp.db.split(' ')[0]) || 
      p.name.includes(comp.official.split(' ')[0])
    );
    
    if (dbPlayer) {
      const difference = dbPlayer.goals - comp.officialGoals;
      console.log(`  ${comp.official}: 공식 ${comp.officialGoals}골 vs DB ${dbPlayer.goals}골 (차이: ${difference > 0 ? '+' : ''}${difference})`);
    } else {
      console.log(`  ${comp.official}: 공식 ${comp.officialGoals}골 vs DB 데이터 없음`);
    }
  });
}

async function main() {
  const databaseRanking = await analyzeCurrentGoals();
  compareWithOfficial(databaseRanking);
  
  console.log('\n📊 결론:');
  if (databaseRanking.length > 0) {
    const topDbScorer = databaseRanking[0];
    const topOfficialScorer = officialGoalRanking[0];
    
    if (topDbScorer.goals > topOfficialScorer.goals * 1.5) {
      console.log('⚠️ 데이터 불일치 발견 - 중복 데이터 문제');
      console.log(`   DB: ${topDbScorer.name} ${topDbScorer.goals}골`);
      console.log(`   공식: ${topOfficialScorer.name} ${topOfficialScorer.goals}골`);
      console.log('🔧 원인: 중복 데이터로 인한 부풀려진 통계');
    } else {
      console.log('✅ 데이터가 공식 기록과 유사한 범위입니다.');
    }
  } else {
    console.log('❌ 데이터베이스에 골 데이터가 없습니다.');
  }
  
  console.log('\n🔧 해결책:');
  console.log('1. create-fixture-events-table.sql을 Supabase 대시보드에서 실행');
  console.log('2. 중복 방지 제약조건이 있는 새로운 테이블 구조 사용');
  console.log('3. master-import.ts로 깔끔한 데이터 재임포트');
}

main().catch(console.error);