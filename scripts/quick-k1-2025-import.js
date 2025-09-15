// quick-k1-2025-import.js - K-League 1 2025 시즌만 빠른 임포트
import { createClient } from '@supabase/supabase-js';

// API 함수 직접 구현
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

async function quickImportK1Events() {
  console.log('⚽ K-League 1 2025 이벤트 데이터 빠른 임포트...');
  
  try {
    // 완료된 경기만 가져오기 (최근 20경기)
    console.log('📅 완료된 경기 목록 조회...');
    const fixturesData = await apiGet('fixtures', { 
      league: K1, 
      season: SEASON,
      status: 'FT',  // 완료된 경기만
      last: 20  // 최근 20경기
    });
    
    const fixtures = fixturesData.response || [];
    console.log(`🎯 처리할 경기: ${fixtures.length}개`);
    
    let totalEventsImported = 0;
    let uniqueEventsImported = 0;
    
    for (const fixture of fixtures) {
      const fixtureId = fixture.fixture.id;
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const fixtureDate = new Date(fixture.fixture.date).toLocaleDateString();
      
      console.log(`\n🆚 ${homeTeam} vs ${awayTeam} (${fixtureDate})`);
      
      try {
        // API에서 이벤트 가져오기
        const eventsData = await apiGet('fixtures/events', { fixture: fixtureId });
        const rawEvents = eventsData.response || [];
        
        console.log(`  📋 API 이벤트: ${rawEvents.length}개`);
        
        // 이벤트 데이터 변환 (fixture_events 테이블 구조에 맞춤)
        const events = rawEvents.map(event => ({
          fixture_id: Number(fixtureId),
          team_id: Number(event.team?.id),
          player_id: event.player?.id ? Number(event.player.id) : null,
          assist_player_id: event.assist?.id ? Number(event.assist.id) : null,
          elapsed_minutes: event.time?.elapsed ?? null,
          extra_minutes: event.time?.extra ?? null,
          event_type: event.type || null,
          event_detail: event.detail || null,
          comments: event.comments || null
        }));
        
        if (events.length > 0) {
          // fixture_events 테이블에 삽입 (중복 방지)
          const { error: insertError, count } = await supabase
            .from('fixture_events')
            .upsert(events, {
              onConflict: 'fixture_id,player_id,event_type,elapsed_minutes,event_detail',
              ignoreDuplicates: true
            });
          
          if (insertError) {
            console.warn(`  ⚠️ 삽입 실패: ${insertError.message}`);
          } else {
            console.log(`  ✅ ${events.length}개 이벤트 삽입`);
            totalEventsImported += rawEvents.length;
            uniqueEventsImported += events.length;
          }
        }
        
        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.warn(`  ⚠️ 경기 ${fixtureId} 처리 실패: ${err.message}`);
      }
    }
    
    console.log(`\n🎉 임포트 완료!`);
    console.log(`📊 API에서 가져온 이벤트: ${totalEventsImported}개`);
    console.log(`✨ 데이터베이스에 저장된 이벤트: ${uniqueEventsImported}개`);
    
    return uniqueEventsImported;
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error.message);
    return 0;
  }
}

async function analyzeGoalData() {
  console.log('\n📊 골 데이터 분석...');
  
  try {
    // 골 이벤트 분석 (fixture_events 테이블에서)
    const { data: goalEvents, error } = await supabase
      .from('fixture_events')
      .select(`
        player_id,
        players(name),
        fixtures!inner(season_year, league_id)
      `)
      .eq('event_type', 'Goal')
      .eq('fixtures.season_year', 2025)
      .eq('fixtures.league_id', 292)  // K-League 1
      .not('player_id', 'is', null);
    
    if (error) throw error;
    
    // 선수별 골 집계
    const goalCounts = {};
    goalEvents.forEach(event => {
      const playerId = event.player_id;
      const playerName = event.players?.name || 'Unknown';
      
      if (!goalCounts[playerId]) {
        goalCounts[playerId] = {
          name: playerName,
          goals: 0
        };
      }
      goalCounts[playerId].goals++;
    });
    
    // TOP 10 득점자
    const topScorers = Object.values(goalCounts)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);
    
    console.log('\n🏆 K-League 1 2025 득점 순위 (fixture_events 테이블):');
    topScorers.forEach((scorer, index) => {
      console.log(`  ${index + 1}. ${scorer.name}: ${scorer.goals}골`);
    });
    
    return topScorers;
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 K-League 1 2025 빠른 임포트 및 분석');
  console.log('=====================================');
  
  // 1. 이벤트 데이터 임포트
  const importedCount = await quickImportK1Events();
  
  if (importedCount > 0) {
    // 2. 골 데이터 분석
    const topScorers = await analyzeGoalData();
    
    console.log('\n✅ 빠른 테스트 완료!');
    console.log('🎯 다음 단계: 공식 K-League 홈페이지와 비교');
  } else {
    console.log('❌ 임포트 실패');
  }
}

main().catch(console.error);