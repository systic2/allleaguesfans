// clean-and-reimport.js - 기존 events 테이블 완전 정리 후 새 데이터 임포트
import { createClient } from '@supabase/supabase-js';

// API 함수
async function apiGet(path, params = {}) {
  const API = 'https://v3.football.api-sports.io';
  const KEY = process.env.API_FOOTBALL_KEY || 'your-api-key-here';
  
  const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v!=null));
  const res = await fetch(`${API}/${path}?${qs}`, { 
    headers: { 'x-apisports-key': KEY } 
  });
  
  if (!res.ok) {
    throw new Error(`API-FOOTBALL ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

const K1 = 292;
const SEASON = 2025;

async function clearEventsTable() {
  console.log('🗑️ events 테이블 완전 정리...');
  
  try {
    // 현재 레코드 수 확인
    const { count: beforeCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 정리 전: ${beforeCount?.toLocaleString()}개 레코드`);
    
    // 모든 events 삭제
    const { error, count } = await supabase
      .from('events')
      .delete()
      .gte('id', 0); // 모든 레코드 삭제
    
    if (error) {
      console.error('❌ 삭제 실패:', error.message);
      return false;
    }
    
    // 최종 확인
    const { count: afterCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ 정리 완료! 남은 레코드: ${afterCount}개`);
    return true;
    
  } catch (error) {
    console.error('❌ events 테이블 정리 실패:', error.message);
    return false;
  }
}

async function importCleanEvents() {
  console.log('\n⚽ K-League 1 2025 깔끔한 이벤트 임포트...');
  
  try {
    // 완료된 경기만 가져오기 (최근 50경기)
    const fixturesData = await apiGet('fixtures', { 
      league: K1, 
      season: SEASON,
      status: 'FT',
      last: 50
    });
    
    const fixtures = fixturesData.response || [];
    console.log(`🎯 처리할 완료된 경기: ${fixtures.length}개`);
    
    let totalEventsImported = 0;
    const processedEvents = new Set(); // 중복 방지용
    
    for (const fixture of fixtures) {
      const fixtureId = fixture.fixture.id;
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      
      console.log(`\n🆚 ${homeTeam} vs ${awayTeam}`);
      
      try {
        // API에서 이벤트 가져오기
        const eventsData = await apiGet('fixtures/events', { fixture: fixtureId });
        const rawEvents = eventsData.response || [];
        
        console.log(`  📋 API 이벤트: ${rawEvents.length}개`);
        
        // 이벤트 데이터 변환 및 중복 제거
        const events = [];
        
        rawEvents.forEach(event => {
          // 고유 키 생성 (중복 방지)
          const uniqueKey = `${fixtureId}-${event.player?.id || 'null'}-${event.type}-${event.time?.elapsed}-${event.detail}`;
          
          if (!processedEvents.has(uniqueKey)) {
            processedEvents.add(uniqueKey);
            
            events.push({
              fixture_id: Number(fixtureId),
              team_id: Number(event.team?.id),
              player_id: event.player?.id ? Number(event.player.id) : null,
              assist_id: event.assist?.id ? Number(event.assist.id) : null,
              type: event.type || null,
              detail: event.detail || null,
              comments: event.comments || null,
              minute: event.time?.elapsed ?? null,
              extra_minute: event.time?.extra ?? null
            });
          }
        });
        
        if (events.length > 0) {
          // events 테이블에 삽입
          const { error: insertError } = await supabase
            .from('events')
            .insert(events);
          
          if (insertError) {
            console.warn(`  ⚠️ 삽입 실패: ${insertError.message}`);
          } else {
            console.log(`  ✅ ${events.length}개 깔끔한 이벤트 삽입`);
            totalEventsImported += events.length;
          }
        }
        
        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.warn(`  ⚠️ 경기 ${fixtureId} 처리 실패: ${err.message}`);
      }
    }
    
    console.log(`\n🎉 깔끔한 임포트 완료!`);
    console.log(`⚽ 총 이벤트: ${totalEventsImported}개`);
    console.log(`🔄 중복 제거된 이벤트: ${processedEvents.size}개`);
    
    return totalEventsImported;
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error.message);
    return 0;
  }
}

async function analyzeCleanGoals() {
  console.log('\n📊 깔끔한 골 데이터 분석...');
  
  try {
    // 골 이벤트만 조회
    const { data: goals } = await supabase
      .from('events')
      .select('player_id')
      .eq('type', 'Goal')
      .not('player_id', 'is', null);
    
    if (goals && goals.length > 0) {
      // 골 집계
      const goalCounts = {};
      goals.forEach(event => {
        const playerId = event.player_id;
        goalCounts[playerId] = (goalCounts[playerId] || 0) + 1;
      });
      
      // TOP 10
      const topScorers = Object.entries(goalCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([playerId, goals]) => ({ playerId: parseInt(playerId), goals }));
      
      console.log('\n🏆 깔끔한 득점 순위:');
      topScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. Player ${scorer.playerId}: ${scorer.goals}골`);
      });
      
      // 공식 통계와 비교
      if (topScorers.length > 0) {
        const topGoals = topScorers[0].goals;
        if (topGoals >= 10 && topGoals <= 20) {
          console.log('\n✅ 공식 통계와 유사한 범위입니다! (10-20골)');
        } else if (topGoals > 20) {
          console.log('\n⚠️ 여전히 높은 골 수치 - 추가 중복 제거 필요');
        } else {
          console.log('\n🤔 예상보다 낮은 골 수치 - 데이터 확인 필요');
        }
      }
      
      return topScorers;
    }
    
    return [];
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Events 테이블 완전 정리 및 깔끔한 재임포트');
  console.log('=====================================');
  
  // 1. 기존 데이터 완전 정리
  const cleanSuccess = await clearEventsTable();
  
  if (cleanSuccess) {
    // 2. 깔끔한 데이터 임포트
    const importedCount = await importCleanEvents();
    
    if (importedCount > 0) {
      // 3. 결과 분석
      await analyzeCleanGoals();
      
      console.log('\n✅ 깔끔한 데이터로 교체 완료!');
      console.log('🎯 다음: 웹 애플리케이션에서 통계 확인');
    } else {
      console.log('\n❌ 임포트 실패');
    }
  } else {
    console.log('\n❌ 정리 실패');
  }
}

main().catch(console.error);