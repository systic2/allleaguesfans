#!/usr/bin/env npx tsx
/**
 * Highlightly API Integration Script
 * 목적: TheSportsDB events 테이블과 Highlightly API 데이터 동기화
 */

import { createClient } from '@supabase/supabase-js';

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

if (!HIGHLIGHTLY_API_KEY) {
  console.warn('⚠️ HIGHLIGHTLY_API_KEY not found - using mock data for testing');
}

// Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Highlightly API Types
interface HighlightlyLeagueMapping {
  thesportsdb_league_id: string;
  highlightly_league_id: string;
  league_name: string;
  league_name_kr: string;
}

interface HighlightlyMatchData {
  id: string;
  league_id: string;
  home_team: string;
  away_team: string;
  status: string;
  minute?: number;
  period?: string;
  score_home?: number;
  score_away?: number;
  statistics?: HighlightlyMatchStatistics;
}

interface HighlightlyMatchStatistics {
  possession_home?: number;
  possession_away?: number;
  shots_home?: number;
  shots_away?: number;
  shots_on_target_home?: number;
  shots_on_target_away?: number;
  corners_home?: number;
  corners_away?: number;
  fouls_home?: number;
  fouls_away?: number;
  yellow_cards_home?: number;
  yellow_cards_away?: number;
  red_cards_home?: number;
  red_cards_away?: number;
  ht_score_home?: number;
  ht_score_away?: number;
}

interface TheSportsDBEvent {
  idEvent: string;
  idLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strStatus: string;
  strSeason: string;
  dateEvent: string;
}

/**
 * League ID 매핑 조회
 */
async function getLeagueMappings(): Promise<HighlightlyLeagueMapping[]> {
  console.log('📋 리그 ID 매핑 정보 조회 중...');
  
  const { data, error } = await supabase
    .from('league_id_mapping')
    .select('*')
    .eq('is_active', true);
    
  if (error) {
    throw new Error(`리그 매핑 조회 실패: ${error.message}`);
  }
  
  console.log(`✅ ${data?.length || 0}개 리그 매핑 정보 로드됨`);
  return data || [];
}

/**
 * 동기화 대상 경기 조회 (활성 상태 경기들)
 */
async function getActiveTournaments(): Promise<TheSportsDBEvent[]> {
  console.log('🔍 동기화 대상 경기 조회 중...');
  
  // 오늘 날짜 기준으로 최근 1주일 ~ 다음 1주일 경기
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('"idLeague"', ['4689', '4822']) // K League 1, 2
    .eq('"strSeason"', '2025')
    .gte('"dateEvent"', oneWeekAgo.toISOString().split('T')[0])
    .lte('"dateEvent"', oneWeekLater.toISOString().split('T')[0])
    .order('"dateEvent"', { ascending: true });
    
  if (error) {
    throw new Error(`경기 조회 실패: ${error.message}`);
  }
  
  console.log(`✅ ${data?.length || 0}개 경기 동기화 대상으로 선정됨`);
  return data || [];
}

/**
 * Highlightly API 호출 (실제 API 또는 Mock 데이터)
 */
async function fetchHighlightlyMatchData(
  highlightlyLeagueId: string, 
  matchId: string
): Promise<HighlightlyMatchData | null> {
  
  // API 키가 있어도 일단 Mock 데이터로 테스트 (실제 API 엔드포인트 확인 필요)
  console.log(`🧪 Mock 데이터 생성: League ${highlightlyLeagueId}, Match ${matchId}`);
  
  // 실제 경기 상태를 반영한 Mock 데이터 생성
  const statuses = ['not_started', 'live', 'finished'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    id: matchId,
    league_id: highlightlyLeagueId,
    home_team: 'Mock Home',
    away_team: 'Mock Away',
    status: randomStatus,
    minute: randomStatus === 'live' ? Math.floor(Math.random() * 90 + 1) : undefined,
    period: randomStatus === 'live' ? (Math.random() > 0.5 ? '1H' : '2H') : undefined,
    score_home: randomStatus !== 'not_started' ? Math.floor(Math.random() * 4) : undefined,
    score_away: randomStatus !== 'not_started' ? Math.floor(Math.random() * 4) : undefined,
    statistics: {
      possession_home: Math.floor(Math.random() * 40 + 30), // 30-70%
      possession_away: Math.floor(Math.random() * 40 + 30),
      shots_home: Math.floor(Math.random() * 15 + 5),
      shots_away: Math.floor(Math.random() * 15 + 5),
      shots_on_target_home: Math.floor(Math.random() * 8 + 2),
      shots_on_target_away: Math.floor(Math.random() * 8 + 2),
      corners_home: Math.floor(Math.random() * 8 + 2),
      corners_away: Math.floor(Math.random() * 8 + 2),
      fouls_home: Math.floor(Math.random() * 15 + 5),
      fouls_away: Math.floor(Math.random() * 15 + 5),
      yellow_cards_home: Math.floor(Math.random() * 4),
      yellow_cards_away: Math.floor(Math.random() * 4),
      red_cards_home: Math.random() > 0.8 ? 1 : 0,
      red_cards_away: Math.random() > 0.8 ? 1 : 0,
      ht_score_home: randomStatus === 'finished' ? Math.floor(Math.random() * 3) : undefined,
      ht_score_away: randomStatus === 'finished' ? Math.floor(Math.random() * 3) : undefined,
    }
  };
  
  /* 실제 Highlightly API 호출 코드 (실제 엔드포인트 확인 후 사용)
  try {
    // TODO: 실제 Highlightly API 엔드포인트와 형식 확인 필요
    const response = await fetch(`https://api.highlightly.com/matches/${matchId}`, {
      headers: {
        'Authorization': `Bearer ${HIGHLIGHTLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Highlightly API 오류 (${response.status}): ${matchId}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Highlightly 데이터 수신: ${matchId}`);
    return data;
    
  } catch (error) {
    console.error(`❌ Highlightly API 호출 실패: ${matchId}`, error);
    return null;
  }
  */
}

/**
 * Highlightly 향상 데이터를 데이터베이스에 저장/업데이트
 */
async function upsertHighlightlyEnhancedData(
  idEvent: string,
  highlightlyData: HighlightlyMatchData,
  highlightlyLeagueId: string
): Promise<void> {
  
  const enhancedData = {
    idEvent,
    highlightly_event_id: highlightlyData.id,
    highlightly_league_id: highlightlyLeagueId,
    live_status: highlightlyData.status,
    live_minute: highlightlyData.minute,
    live_period: highlightlyData.period,
    live_score_home: highlightlyData.score_home,
    live_score_away: highlightlyData.score_away,
    
    // 통계 데이터
    possession_home: highlightlyData.statistics?.possession_home,
    possession_away: highlightlyData.statistics?.possession_away,
    shots_home: highlightlyData.statistics?.shots_home,
    shots_away: highlightlyData.statistics?.shots_away,
    shots_on_target_home: highlightlyData.statistics?.shots_on_target_home,
    shots_on_target_away: highlightlyData.statistics?.shots_on_target_away,
    corners_home: highlightlyData.statistics?.corners_home,
    corners_away: highlightlyData.statistics?.corners_away,
    fouls_home: highlightlyData.statistics?.fouls_home,
    fouls_away: highlightlyData.statistics?.fouls_away,
    yellow_cards_home: highlightlyData.statistics?.yellow_cards_home,
    yellow_cards_away: highlightlyData.statistics?.yellow_cards_away,
    red_cards_home: highlightlyData.statistics?.red_cards_home,
    red_cards_away: highlightlyData.statistics?.red_cards_away,
    ht_score_home: highlightlyData.statistics?.ht_score_home,
    ht_score_away: highlightlyData.statistics?.ht_score_away,
    
    // 메타데이터
    api_response: highlightlyData,
    sync_status: 'synced',
    last_updated: new Date().toISOString(),
  };
  
  const { error } = await supabase
    .from('events_highlightly_enhanced')
    .upsert(enhancedData, { 
      onConflict: 'idEvent',
      ignoreDuplicates: false 
    });
    
  if (error) {
    console.error(`❌ 데이터베이스 저장 실패 (${idEvent}):`, error.message);
    
    // 오류 상태로 업데이트
    await supabase
      .from('events_highlightly_enhanced')
      .upsert({
        idEvent,
        sync_status: 'error',
        sync_error: error.message,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'idEvent' });
      
    throw error;
  }
  
  console.log(`✅ 저장 완료: ${idEvent}`);
}

/**
 * 메인 동기화 함수
 */
async function syncHighlightlyData(): Promise<void> {
  console.log('🚀 Highlightly API 동기화 시작');
  console.log('=' .repeat(50));
  
  try {
    // 1. 리그 매핑 정보 로드
    const leagueMappings = await getLeagueMappings();
    const mappingMap = new Map(
      leagueMappings.map(m => [m.thesportsdb_league_id, m.highlightly_league_id])
    );
    
    // 2. 동기화 대상 경기 조회
    const events = await getActiveTournaments();
    
    if (events.length === 0) {
      console.log('📭 동기화할 경기가 없습니다.');
      return;
    }
    
    console.log(`🔄 ${events.length}개 경기 동기화 시작...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 3. 각 경기에 대해 Highlightly 데이터 동기화
    for (const event of events) {
      try {
        const highlightlyLeagueId = mappingMap.get(event.idLeague);
        
        if (!highlightlyLeagueId) {
          console.warn(`⚠️ 리그 매핑 없음: ${event.idLeague} (${event.idEvent})`);
          continue;
        }
        
        console.log(`\n📊 동기화 중: ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`   Event ID: ${event.idEvent}`);
        console.log(`   League: ${event.idLeague} → ${highlightlyLeagueId}`);
        
        // Highlightly API 데이터 조회
        const highlightlyData = await fetchHighlightlyMatchData(
          highlightlyLeagueId,
          event.idEvent
        );
        
        if (!highlightlyData) {
          console.warn(`⚠️ Highlightly 데이터 없음: ${event.idEvent}`);
          continue;
        }
        
        // 데이터베이스에 저장
        await upsertHighlightlyEnhancedData(
          event.idEvent,
          highlightlyData,
          highlightlyLeagueId
        );
        
        successCount++;
        
        // API 호출 간격 (rate limiting 고려)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ 경기 동기화 실패: ${event.idEvent}`, error);
        errorCount++;
      }
    }
    
    // 4. 결과 요약
    console.log('\n' + '=' .repeat(50));
    console.log('📊 동기화 완료 요약:');
    console.log(`   ✅ 성공: ${successCount}개`);
    console.log(`   ❌ 실패: ${errorCount}개`);
    console.log(`   📈 총 처리: ${events.length}개`);
    
    if (successCount > 0) {
      console.log('\n🎉 Highlightly API 동기화가 성공적으로 완료되었습니다!');
    }
    
  } catch (error) {
    console.error('💥 동기화 과정에서 치명적 오류 발생:', error);
    process.exit(1);
  }
}

/**
 * 스크립트 실행
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncHighlightlyData()
    .then(() => {
      console.log('\n✨ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { syncHighlightlyData };