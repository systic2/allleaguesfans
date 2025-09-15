// k1-2025-quick-fix.js - K-League 1 2025시즌만 빠른 수정
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

async function importFixturesAndEvents() {
  console.log('⚽ K-League 1 2025 fixtures와 events 임포트...');
  
  try {
    // 1. 전체 fixtures 가져오기
    console.log('📅 2025시즌 K-League 1 fixtures 조회...');
    const fixturesData = await apiGet('fixtures', { 
      league: K1, 
      season: SEASON
    });
    
    const fixtures = fixturesData.response || [];
    console.log(`🎯 총 fixtures: ${fixtures.length}개`);
    
    let fixtureCount = 0;
    let eventCount = 0;
    
    // 2. fixtures 임포트
    for (const fixture of fixtures) {
      try {
        const s = fixture.score || {};
        const ht = s.halftime || {}, ft = s.fulltime || {}, et = s.extratime || {}, pen = s.penalty || {};
        
        const fixtureRow = {
          id: Number(fixture.fixture.id),
          league_id: K1,
          season_year: SEASON,
          round: fixture.league?.round || null,
          kickoff_utc: fixture.fixture?.date || null,
          status_short: fixture.fixture?.status?.short || null,
          status_long: fixture.fixture?.status?.long || null,
          elapsed: fixture.fixture?.status?.elapsed ?? null,
          venue: fixture.fixture?.venue?.name || null,
          referee: fixture.fixture?.referee || null,
          home_team_id: Number(fixture.teams?.home?.id),
          away_team_id: Number(fixture.teams?.away?.id),
          goals_home: fixture.goals?.home ?? null,
          goals_away: fixture.goals?.away ?? null,
          ht_home: ht.home ?? null, ht_away: ht.away ?? null,
          ft_home: ft.home ?? null, ft_away: ft.away ?? null,
          et_home: et.home ?? null, et_away: et.away ?? null,
          pk_home: pen.home ?? null, pk_away: pen.away ?? null,
          updated_at: new Date().toISOString()
        };
        
        const { error: fixtureError } = await supabase.from('fixtures').upsert([fixtureRow], { onConflict: 'id' });
        if (!fixtureError) fixtureCount++;
        
      } catch (err) {
        console.warn(`  ⚠️ Fixture ${fixture.fixture?.id} 실패: ${err.message}`);
      }
    }
    
    console.log(`✅ Fixtures 임포트 완료: ${fixtureCount}개`);
    
    // 3. 완료된 경기의 events 임포트 (fixture_events 테이블 사용)
    console.log('\n⚽ Events 임포트 시작...');
    
    const completedFixtures = fixtures.filter(f => f.fixture?.status?.short === 'FT');
    console.log(`🏁 완료된 경기: ${completedFixtures.length}개`);
    
    for (const fixture of completedFixtures.slice(0, 30)) { // 처음 30경기만 테스트
      try {
        const eventsData = await apiGet('fixtures/events', { fixture: fixture.fixture.id });
        const rawEvents = eventsData.response || [];
        
        if (rawEvents.length > 0) {
          const events = rawEvents.map(event => ({
            fixture_id: Number(fixture.fixture.id),
            team_id: Number(event.team?.id),
            player_id: event.player?.id ? Number(event.player.id) : null,
            assist_player_id: event.assist?.id ? Number(event.assist.id) : null,
            elapsed_minutes: event.time?.elapsed ?? null,
            extra_minutes: event.time?.extra ?? null,
            event_type: event.type || null,
            event_detail: event.detail || null,
            comments: event.comments || null
          }));
          
          // fixture_events 테이블에 upsert 시도
          const { error: eventsError, count } = await supabase
            .from('fixture_events')
            .upsert(events, {
              onConflict: 'fixture_id,player_id,event_type,elapsed_minutes,event_detail',
              ignoreDuplicates: true
            });
          
          if (eventsError) {
            console.warn(`  ⚠️ Events 삽입 실패 (Fixture ${fixture.fixture.id}): ${eventsError.message}`);
          } else {
            console.log(`  ✅ Fixture ${fixture.fixture.id}: ${events.length}개 events 삽입`);
            eventCount += events.length;
          }
        }
        
        // API 제한 방지
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.warn(`  ⚠️ Events 가져오기 실패 (Fixture ${fixture.fixture.id}): ${err.message}`);
      }
    }
    
    console.log(`\n🎉 임포트 완료!`);
    console.log(`📊 Fixtures: ${fixtureCount}개`);
    console.log(`⚽ Events: ${eventCount}개`);
    
    return { fixtureCount, eventCount };
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error.message);
    return { fixtureCount: 0, eventCount: 0 };
  }
}

async function analyzeResults() {
  console.log('\n📊 결과 분석...');
  
  try {
    // fixture_events 테이블에서 골 데이터 분석
    const { data: goals, error } = await supabase
      .from('fixture_events')
      .select('player_id, fixtures!inner(season_year, league_id)')
      .eq('event_type', 'Goal')
      .eq('fixtures.season_year', 2025)
      .eq('fixtures.league_id', 292)
      .not('player_id', 'is', null);
    
    if (error) throw error;
    
    if (goals && goals.length > 0) {
      // 골 집계
      const goalCounts = {};
      goals.forEach(event => {
        const playerId = event.player_id;
        goalCounts[playerId] = (goalCounts[playerId] || 0) + 1;
      });
      
      // TOP 5
      const topScorers = Object.entries(goalCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([playerId, goals]) => ({ playerId: parseInt(playerId), goals }));
      
      console.log('\n🏆 fixture_events 테이블 득점 순위:');
      topScorers.forEach((scorer, index) => {
        console.log(`  ${index + 1}. Player ${scorer.playerId}: ${scorer.goals}골`);
      });
      
      return topScorers;
    } else {
      console.log('❌ fixture_events에서 골 데이터를 찾을 수 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
  }
  
  return [];
}

async function main() {
  console.log('🚀 K-League 1 2025 빠른 수정');
  console.log('=====================================');
  
  const result = await importFixturesAndEvents();
  
  if (result.eventCount > 0) {
    const topScorers = await analyzeResults();
    console.log('\n✅ 성공! fixture_events 테이블에 깔끔한 데이터가 임포트되었습니다.');
  } else {
    console.log('\n❌ Events 임포트에 문제가 있습니다. fixture_events 테이블 생성을 확인해주세요.');
  }
}

main().catch(console.error);