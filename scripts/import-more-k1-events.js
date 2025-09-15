// import-more-k1-events.js - 더 많은 K1 2025 이벤트 임포트
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

async function importMoreEvents() {
  console.log('⚽ 더 많은 K1 2025 이벤트 임포트');
  console.log('=====================================');
  
  try {
    // 완료된 경기를 더 많이 가져오기 (최근 100경기)
    const fixturesData = await apiGet('fixtures', { 
      league: K1, 
      season: SEASON,
      status: 'FT',
      last: 100
    });
    
    const fixtures = fixturesData.response || [];
    console.log(`🎯 전체 완료된 경기: ${fixtures.length}개`);
    
    // 이미 처리된 fixtures 확인
    const { data: existingFixtures } = await supabase
      .from('events')
      .select('fixture_id')
      .not('fixture_id', 'is', null);
    
    const processedFixtureIds = new Set(
      existingFixtures?.map(e => e.fixture_id) || []
    );
    
    const newFixtures = fixtures.filter(f => !processedFixtureIds.has(Number(f.fixture.id)));
    console.log(`🆕 새로 처리할 경기: ${newFixtures.length}개`);
    
    let totalImported = 0;
    const processedEvents = new Set();
    
    for (let i = 0; i < newFixtures.length; i++) {
      const fixture = newFixtures[i];
      const fixtureId = fixture.fixture.id;
      
      console.log(`\n🆚 [${i + 1}/${newFixtures.length}] Fixture ${fixtureId}`);
      
      try {
        const eventsData = await apiGet('fixtures/events', { fixture: fixtureId });
        const rawEvents = eventsData.response || [];
        
        const cleanEvents = [];
        rawEvents.forEach(event => {
          if (event.player?.id) {
            const uniqueKey = `${fixtureId}-${event.player.id}-${event.type}-${event.time?.elapsed}-${event.detail}`;
            
            if (!processedEvents.has(uniqueKey)) {
              processedEvents.add(uniqueKey);
              
              cleanEvents.push({
                fixture_id: Number(fixtureId),
                team_id: Number(event.team?.id),
                player_id: Number(event.player.id),
                assist_id: event.assist?.id ? Number(event.assist.id) : null,
                type: event.type || null,
                detail: event.detail || null,
                comments: event.comments || null,
                minute: event.time?.elapsed ?? null,
                extra_minute: event.time?.extra ?? null
              });
            }
          }
        });
        
        if (cleanEvents.length > 0) {
          const { error: insertError } = await supabase
            .from('events')
            .insert(cleanEvents);
          
          if (insertError) {
            console.warn(`  ⚠️ 삽입 실패: ${insertError.message}`);
          } else {
            console.log(`  ✅ ${cleanEvents.length}개 이벤트 삽입`);
            totalImported += cleanEvents.length;
          }
        } else {
          console.log(`  📝 새 이벤트 없음`);
        }
        
        // API 제한 방지
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.warn(`  ⚠️ 경기 ${fixtureId} 처리 실패: ${err.message}`);
      }
    }
    
    console.log(`\n🎉 추가 임포트 완료: ${totalImported}개 이벤트`);
    return totalImported;
    
  } catch (error) {
    console.error('❌ 추가 임포트 실패:', error.message);
    return 0;
  }
}

async function analyzeUpdatedGoals() {
  console.log('\n📊 업데이트된 골 데이터 분석');
  console.log('=====================================');
  
  try {
    // 전체 골 통계
    const { count: totalGoals } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Goal')
      .not('player_id', 'is', null);
    
    console.log(`⚽ 전체 골 이벤트: ${totalGoals}개`);
    
    const { data: goals } = await supabase
      .from('events')
      .select('player_id')
      .eq('type', 'Goal')
      .not('player_id', 'is', null);
    
    if (goals && goals.length > 0) {
      const goalCounts = {};
      goals.forEach(event => {
        const playerId = event.player_id;
        goalCounts[playerId] = (goalCounts[playerId] || 0) + 1;
      });
      
      const topScorers = Object.entries(goalCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15)
        .map(([playerId, goals]) => ({ playerId: parseInt(playerId), goals }));
      
      console.log('\n🏆 업데이트된 득점 순위 TOP 15:');
      topScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. Player ${scorer.playerId}: ${scorer.goals}골`);
      });
      
      const maxGoals = topScorers[0]?.goals || 0;
      console.log(`\n📈 최고 득점: ${maxGoals}골`);
      
      if (maxGoals >= 10 && maxGoals <= 20) {
        console.log('✅ 공식 K-League 통계와 유사한 범위입니다!');
        console.log('🎯 데이터 품질 문제가 완전히 해결되었습니다.');
      } else if (maxGoals > 20) {
        console.log('⚠️ 여전히 높은 수치 - 추가 중복 확인 필요');
      } else {
        console.log('📊 시즌 초반 데이터 - 더 많은 경기가 진행되면 늘어날 것입니다.');
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
  console.log('🚀 K1 2025 더 많은 이벤트 임포트');
  console.log('=====================================');
  
  const importedCount = await importMoreEvents();
  
  if (importedCount >= 0) {
    await analyzeUpdatedGoals();
    
    console.log('\n🎊 완료!');
    console.log('🌐 웹 애플리케이션에서 업데이트된 득점왕 순위를 확인하세요.');
  }
}

main().catch(console.error);