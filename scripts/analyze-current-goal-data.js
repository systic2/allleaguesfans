// analyze-current-goal-data.js - 현재 데이터베이스의 골 데이터 분석
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function analyzeCurrentData() {
  console.log('📊 현재 데이터베이스 상태 분석');
  console.log('=====================================');
  
  try {
    // 전체 이벤트 수 확인
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📈 총 이벤트 수: ${totalEvents?.toLocaleString()}개`);
    
    // 골 이벤트만 확인
    const { count: goalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Goal');
    
    console.log(`⚽ 골 이벤트 수: ${goalEvents?.toLocaleString()}개`);
    
    // 2025 시즌 골 득점자 TOP 10
    console.log('\n🏆 2025시즌 K-League 1 득점 순위 (현재 DB):');
    
    const { data: goalScorers, error } = await supabase
      .from('events')
      .select(`
        player_id,
        players(name),
        fixtures!inner(season_year, league_id),
        COUNT(*) as goal_count
      `)
      .eq('type', 'Goal')
      .eq('fixtures.season_year', 2025)
      .eq('fixtures.league_id', 292)  // K-League 1
      .not('player_id', 'is', null)
      .group('player_id, players.name, fixtures.season_year, fixtures.league_id')
      .order('goal_count', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (goalScorers && goalScorers.length > 0) {
      goalScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. ${scorer.players?.name || 'Unknown'}: ${scorer.goal_count}골`);
      });
    } else {
      console.log('  데이터 없음 또는 조회 실패');
    }
    
    // 간단한 골 집계 방법으로 재시도
    console.log('\n📋 간단한 방법으로 골 집계:');
    
    const { data: simpleGoals } = await supabase
      .from('events')
      .select('player_id, players(name)')
      .eq('type', 'Goal')
      .not('player_id', 'is', null)
      .limit(1000);
    
    if (simpleGoals) {
      // 수동으로 집계
      const goalCounts = {};
      simpleGoals.forEach(event => {
        const playerId = event.player_id;
        const playerName = event.players?.name || `Player ${playerId}`;
        
        if (!goalCounts[playerId]) {
          goalCounts[playerId] = { name: playerName, goals: 0 };
        }
        goalCounts[playerId].goals++;
      });
      
      // 정렬
      const topScorers = Object.values(goalCounts)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
      
      topScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
      });
    }
    
    return goalScorers || [];
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    return [];
  }
}

async function main() {
  const currentData = await analyzeCurrentData();
  
  console.log('\n✅ 현재 데이터 분석 완료!');
  console.log('🎯 다음 단계: K-League 공식 홈페이지와 비교');
  
  return currentData;
}

main().catch(console.error);