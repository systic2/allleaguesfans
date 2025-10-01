#!/usr/bin/env npx tsx
/**
 * Highlightly API 통합 테스트 스크립트
 * 목적: 통합된 Highlightly 데이터 조회 및 표시 테스트
 */

import { createClient } from '@supabase/supabase-js';

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Direct Supabase client for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Test functions (inline implementation)
interface HighlightlyEnhancedFixture {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strStatus: string;
  intRound: number;
  intHomeScore?: number;
  intAwayScore?: number;
  strVenue?: string;
  idLeague: string;
  strSeason: string;
  possession_home?: number;
  possession_away?: number;
  shots_home?: number;
  shots_away?: number;
  shots_on_target_home?: number;
  shots_on_target_away?: number;
  corners_home?: number;
  corners_away?: number;
  yellow_cards_home?: number;
  yellow_cards_away?: number;
  intensity?: number;
  momentum?: number;
  id: string;
  round: string;
  status: string;
  venue: string;
}

async function fetchHighlightlyEnhancedRecentMatches(leagueSlug: string, season: number = 2025, limit: number = 10): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`🔍 Highlightly 향상된 최근 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  const { data, error } = await supabase
    .from('events_enhanced')
    .select('*')
    .eq('"idLeague"', theSportsDBLeagueId)
    .eq('"strSeason"', String(season))
    .eq('"strStatus"', 'Match Finished')
    .order('"dateEvent"', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    ...item,
    id: item.idEvent,
    round: String(item.intRound),
    status: item.strStatus,
    venue: item.strVenue || ''
  }));
}

async function fetchHighlightlyEnhancedUpcomingMatches(leagueSlug: string, season: number = 2025, limit: number = 10): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`🔮 Highlightly 향상된 예정 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  const { data, error } = await supabase
    .from('events_enhanced')
    .select('*')
    .eq('"idLeague"', theSportsDBLeagueId)
    .eq('"strSeason"', String(season))
    .eq('"strStatus"', 'Not Started')
    .order('"dateEvent"', { ascending: true })
    .limit(limit);
    
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    ...item,
    id: item.idEvent,
    round: String(item.intRound),
    status: item.strStatus,
    venue: item.strVenue || ''
  }));
}

async function fetchHighlightlyLiveMatches(leagueSlug?: string, season: number = 2025): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`📺 Highlightly 라이브 경기 조회: ${leagueSlug || '전체'}, 시즌 ${season}`);
  
  let query = supabase
    .from('events_enhanced')
    .select('*')
    .eq('"strSeason"', String(season))
    .eq('live_status', 'live')
    .order('"dateEvent"', { ascending: true });

  if (leagueSlug) {
    const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                               leagueSlug === 'k-league-2' ? '4822' : 
                               leagueSlug.replace('league-', '');
    query = query.eq('"idLeague"', theSportsDBLeagueId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    id: item.idEvent,
    round: String(item.intRound),
    status: item.strStatus,
    venue: item.strVenue || ''
  }));
}

async function fetchHighlightlyMatchesWithStatistics(leagueSlug: string, season: number = 2025, limit: number = 20): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`📊 Highlightly 통계 데이터 있는 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  const { data, error } = await supabase
    .from('events_enhanced')
    .select('*')
    .eq('"idLeague"', theSportsDBLeagueId)
    .eq('"strSeason"', String(season))
    .not('possession_home', 'is', null)
    .not('shots_home', 'is', null)
    .order('"dateEvent"', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    ...item,
    id: item.idEvent,
    round: String(item.intRound),
    status: item.strStatus,
    venue: item.strVenue || ''
  }));
}

// Utility functions
function getHighlightlyPossessionAdvantage(possessionHome?: number, possessionAway?: number) {
  if (!possessionHome || !possessionAway) {
    return { team: 'equal', difference: 0, display: '정보 없음' };
  }
  
  const difference = Math.abs(possessionHome - possessionAway);
  
  if (difference < 5) {
    return { team: 'equal', difference, display: '균등' };
  }
  
  const team = possessionHome > possessionAway ? 'home' : 'away';
  const teamName = team === 'home' ? '홈팀' : '원정팀';
  
  return { team, difference, display: `${teamName} +${difference}%` };
}

function calculateHighlightlyShotAccuracy(shots?: number, shotsOnTarget?: number) {
  if (!shots || !shotsOnTarget || shots === 0) {
    return { accuracy: null, display: '정보 없음' };
  }
  
  const accuracy = Math.round((shotsOnTarget / shots) * 100);
  return { accuracy, display: `${accuracy}% (${shotsOnTarget}/${shots})` };
}

function getHighlightlyMatchIntensity(intensity?: number) {
  if (!intensity) {
    return { level: 'medium', display: '보통', color: 'gray' };
  }
  
  if (intensity < 3) {
    return { level: 'low', display: '낮음', color: 'green' };
  } else if (intensity < 6) {
    return { level: 'medium', display: '보통', color: 'yellow' };
  } else if (intensity < 8) {
    return { level: 'high', display: '높음', color: 'orange' };
  } else {
    return { level: 'extreme', display: '매우 높음', color: 'red' };
  }
}

function getHighlightlyMatchMomentum(momentum?: number) {
  if (!momentum) {
    return { direction: 'neutral', strength: 'weak', display: '균등' };
  }
  
  const absValue = Math.abs(momentum);
  const direction = momentum > 0 ? 'home' : momentum < 0 ? 'away' : 'neutral';
  
  let strength: 'weak' | 'moderate' | 'strong';
  if (absValue < 20) strength = 'weak';
  else if (absValue < 50) strength = 'moderate';
  else strength = 'strong';
  
  if (direction === 'neutral') {
    return { direction, strength, display: '균등' };
  }
  
  const teamName = direction === 'home' ? '홈팀' : '원정팀';
  const strengthName = strength === 'weak' ? '약간' : strength === 'moderate' ? '중간' : '강한';
  
  return { direction, strength, display: `${teamName} ${strengthName} 우세` };
}

async function testHighlightlyAPI() {
  console.log('🚀 Highlightly API 통합 테스트 시작');
  console.log('=' .repeat(60));
  
  try {
    // 1. 최근 경기 조회 테스트
    console.log('\n📊 1. K League 1 최근 경기 조회 테스트');
    const recentMatches = await fetchHighlightlyEnhancedRecentMatches('k-league-1', 2025, 5);
    console.log(`조회된 최근 경기: ${recentMatches.length}개`);
    
    if (recentMatches.length > 0) {
      const match = recentMatches[0];
      console.log(`\n🏟️ 첫 번째 경기 상세:`);
      console.log(`  경기: ${match.strHomeTeam} vs ${match.strAwayTeam}`);
      console.log(`  날짜: ${match.dateEvent}`);
      console.log(`  상태: ${match.strStatus}`);
      console.log(`  스코어: ${match.intHomeScore || 0} - ${match.intAwayScore || 0}`);
      
      // Highlightly 데이터 확인
      if (match.possession_home && match.possession_away) {
        console.log(`\n📈 Highlightly 통계:`);
        console.log(`  점유율: ${match.possession_home}% - ${match.possession_away}%`);
        
        const possessionAdvantage = getHighlightlyPossessionAdvantage(match.possession_home, match.possession_away);
        console.log(`  점유율 우세: ${possessionAdvantage.display}`);
      }
      
      if (match.shots_home && match.shots_away) {
        console.log(`  슈팅: ${match.shots_home} - ${match.shots_away}`);
        
        const homeAccuracy = calculateHighlightlyShotAccuracy(match.shots_home, match.shots_on_target_home);
        const awayAccuracy = calculateHighlightlyShotAccuracy(match.shots_away, match.shots_on_target_away);
        console.log(`  슈팅 정확도: ${homeAccuracy.display} - ${awayAccuracy.display}`);
      }
      
      if (match.intensity) {
        const intensity = getHighlightlyMatchIntensity(match.intensity);
        console.log(`  경기 강도: ${intensity.display}`);
      }
      
      if (match.momentum) {
        const momentum = getHighlightlyMatchMomentum(match.momentum);
        console.log(`  모멘텀: ${momentum.display}`);
      }
    }
    
    // 2. 예정 경기 조회 테스트
    console.log('\n\n🔮 2. K League 1 예정 경기 조회 테스트');
    const upcomingMatches = await fetchHighlightlyEnhancedUpcomingMatches('k-league-1', 2025, 5);
    console.log(`조회된 예정 경기: ${upcomingMatches.length}개`);
    
    if (upcomingMatches.length > 0) {
      const match = upcomingMatches[0];
      console.log(`\n🏟️ 첫 번째 예정 경기:`);
      console.log(`  경기: ${match.strHomeTeam} vs ${match.strAwayTeam}`);
      console.log(`  날짜: ${match.dateEvent}`);
      console.log(`  상태: ${match.strStatus}`);
      console.log(`  라운드: ${match.round}`);
    }
    
    // 3. 라이브 경기 조회 테스트
    console.log('\n\n📺 3. 라이브 경기 조회 테스트');
    const liveMatches = await fetchHighlightlyLiveMatches('k-league-1', 2025);
    console.log(`조회된 라이브 경기: ${liveMatches.length}개`);
    
    if (liveMatches.length > 0) {
      const match = liveMatches[0];
      console.log(`\n⚽ 라이브 경기:`);
      console.log(`  경기: ${match.strHomeTeam} vs ${match.strAwayTeam}`);
      console.log(`  진행 시간: ${match.live_minute}분 (${match.live_period})`);
      console.log(`  라이브 스코어: ${match.live_score_home || 0} - ${match.live_score_away || 0}`);
    }
    
    // 4. 통계가 있는 경기 조회 테스트
    console.log('\n\n📊 4. 통계 데이터 있는 경기 조회 테스트');
    const statisticsMatches = await fetchHighlightlyMatchesWithStatistics('k-league-1', 2025, 3);
    console.log(`통계 데이터 있는 경기: ${statisticsMatches.length}개`);
    
    if (statisticsMatches.length > 0) {
      console.log(`\n📈 통계 요약:`);
      statisticsMatches.forEach((match, index) => {
        console.log(`\n  ${index + 1}. ${match.strHomeTeam} vs ${match.strAwayTeam}`);
        if (match.possession_home && match.possession_away) {
          console.log(`     점유율: ${match.possession_home}% - ${match.possession_away}%`);
        }
        if (match.shots_home && match.shots_away) {
          console.log(`     슈팅: ${match.shots_home} - ${match.shots_away}`);
        }
        if (match.corners_home && match.corners_away) {
          console.log(`     코너킥: ${match.corners_home} - ${match.corners_away}`);
        }
        if (match.yellow_cards_home !== undefined && match.yellow_cards_away !== undefined) {
          console.log(`     옐로카드: ${match.yellow_cards_home} - ${match.yellow_cards_away}`);
        }
      });
    }
    
    // 5. K League 2 테스트
    console.log('\n\n🔄 5. K League 2 데이터 테스트');
    const kl2Recent = await fetchHighlightlyEnhancedRecentMatches('k-league-2', 2025, 3);
    console.log(`K League 2 최근 경기: ${kl2Recent.length}개`);
    
    // 6. 전체 요약
    console.log('\n\n' + '=' .repeat(60));
    console.log('📋 테스트 결과 요약:');
    console.log(`  ✅ K League 1 최근 경기: ${recentMatches.length}개`);
    console.log(`  ✅ K League 1 예정 경기: ${upcomingMatches.length}개`);
    console.log(`  ✅ 라이브 경기: ${liveMatches.length}개`);
    console.log(`  ✅ 통계 데이터 있는 경기: ${statisticsMatches.length}개`);
    console.log(`  ✅ K League 2 최근 경기: ${kl2Recent.length}개`);
    
    const totalMatches = recentMatches.length + upcomingMatches.length + liveMatches.length + statisticsMatches.length + kl2Recent.length;
    console.log(`\n🎉 총 ${totalMatches}개 경기 데이터가 성공적으로 조회되었습니다!`);
    
    // Highlightly 데이터 보강 통계
    const enhancedCount = [
      ...recentMatches,
      ...upcomingMatches,
      ...liveMatches,
      ...statisticsMatches,
      ...kl2Recent
    ].filter(match => 
      match.possession_home || 
      match.shots_home || 
      match.highlightly_event_id
    ).length;
    
    console.log(`📊 Highlightly 데이터 보강된 경기: ${enhancedCount}개`);
    
  } catch (error) {
    console.error('❌ Highlightly API 테스트 실패:', error);
    process.exit(1);
  }
}

/**
 * 스크립트 실행
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  testHighlightlyAPI()
    .then(() => {
      console.log('\n✨ Highlightly API 테스트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Highlightly API 테스트 실패:', error);
      process.exit(1);
    });
}

export { testHighlightlyAPI };