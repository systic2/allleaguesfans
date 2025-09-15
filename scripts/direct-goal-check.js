// direct-goal-check.js - 직접 골 데이터 확인
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function checkDirectGoals() {
  console.log('🔍 직접 골 데이터 확인');
  console.log('=====================================');
  
  try {
    // events 테이블 전체 상태
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📈 events 테이블 총 레코드: ${totalEvents?.toLocaleString()}개`);
    
    // Goal 타입 이벤트만
    const { data: goalEvents, count: goalCount } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('type', 'Goal')
      .limit(10);
    
    console.log(`⚽ Goal 이벤트 총 개수: ${goalCount?.toLocaleString()}개`);
    
    if (goalEvents && goalEvents.length > 0) {
      console.log('\n📋 Goal 이벤트 샘플:');
      goalEvents.slice(0, 5).forEach((event, index) => {
        console.log(`  ${index + 1}. Player ${event.player_id}, Fixture ${event.fixture_id}, Minute ${event.minute}`);
      });
      
      // player_id별로 골 집계 (직접 계산)
      if (goalCount > 0) {
        const { data: allGoals } = await supabase
          .from('events')
          .select('player_id')
          .eq('type', 'Goal')
          .not('player_id', 'is', null)
          .limit(1000);
        
        if (allGoals && allGoals.length > 0) {
          const playerGoals = {};
          allGoals.forEach(event => {
            const playerId = event.player_id;
            playerGoals[playerId] = (playerGoals[playerId] || 0) + 1;
          });
          
          // TOP 10 득점자 (ID만)
          const topScorers = Object.entries(playerGoals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([playerId, goals]) => ({ playerId: parseInt(playerId), goals }));
          
          console.log('\n🏆 득점 순위 (Player ID만):');
          topScorers.forEach((scorer, index) => {
            console.log(`  ${index + 1}. Player ${scorer.playerId}: ${scorer.goals}골`);
          });
          
          return topScorers;
        }
      }
    } else {
      console.log('❌ Goal 이벤트가 없습니다.');
    }
    
    return [];
    
  } catch (error) {
    console.error('❌ 확인 실패:', error.message);
    return [];
  }
}

async function main() {
  const result = await checkDirectGoals();
  
  if (result.length > 0) {
    console.log('\n📊 결론: events 테이블에 골 데이터가 존재합니다.');
    console.log('🔍 선수명을 조회하려면 players 테이블과 join이 필요합니다.');
  } else {
    console.log('\n📊 결론: events 테이블이 비어있거나 골 데이터가 없습니다.');
  }
}

main().catch(console.error);