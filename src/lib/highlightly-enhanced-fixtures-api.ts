// src/lib/highlightly-enhanced-fixtures-api.ts
// REFACTORED VERSION: This file now queries the new 'v2_events_enhanced' view.
import { supabase } from './supabaseClient';
import type { Match, Team } from '@/types/domain';

// This interface now largely reflects the 'v2_events_enhanced' view.
// It extends the base Match for compatibility and adds Highlightly-specific fields.
export interface HighlightlyEnhancedFixture extends Match {
  homeTeam: Team | null;
  awayTeam: Team | null;
  highlightly_event_id?: string;
  live_status?: string;
  live_minute?: number;
  live_period?: string;
  live_score_home?: number;
  live_score_away?: number;
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
  momentum?: number;
  intensity?: number;
  highlightly_last_updated?: string;
  highlightly_sync_status?: string;
  is_live?: boolean;
  possession_difference?: number;
  shot_accuracy_home?: number;
  shot_accuracy_away?: number;
}

/**
 * 향상된 최근 경기 데이터 조회 (Highlightly 데이터 포함)
 */
export async function fetchHighlightlyEnhancedRecentMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`[v2] 🔍 Highlightly 향상된 최근 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('v2_events_enhanced')
      .select('*')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .eq('status', 'FINISHED')
      .order('date', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`[v2] ✅ ${data?.length || 0}개 Highlightly 향상된 최근 경기 조회됨`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2] Highlightly 향상된 최근 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 향상된 예정 경기 데이터 조회 (Highlightly 데이터 포함)
 */
export async function fetchEnhancedUpcomingFixtures(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`[v2] 🔮 Highlightly 향상된 예정 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('v2_events_enhanced')
      .select('*')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .in('status', ['SCHEDULED', 'POSTPONED'])
      .order('date', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`[v2] ✅ ${data?.length || 0}개 Highlightly 향상된 예정 경기 조회됨`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2] Highlightly 향상된 예정 경기 조회 실패:', error);
    throw error;
  }
}

export async function fetchEnhancedTeamUpcomingFixtures(
  teamId: number,
  _limit: number = 10
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`[v2] 🔮 Highlightly 향상된 팀 예정 경기 조회: ${teamId}`);
  // This function can be implemented similarly to fetchHighlightlyEnhancedUpcomingMatches
  // but filtering by teamId. For now, returning empty array.
  return Promise.resolve([]);
}

/**
 * 라이브 경기 조회 (실시간 데이터 포함)
 */
export async function fetchHighlightlyLiveMatches(
  leagueSlug?: string,
  season: number = 2025
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`[v2] 📺 Highlightly 라이브 경기 조회: ${leagueSlug || '전체'}, 시즌 ${season}`);
  
  try {
    let query = supabase
      .from('v2_events_enhanced')
      .select('*')
      .eq('season', String(season))
      .eq('live_status', 'live') // This column comes from the 'events_highlightly_enhanced' table
      .order('date', { ascending: true });
    
    if (leagueSlug) {
      const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                                 leagueSlug === 'k-league-2' ? '4822' : 
                                 leagueSlug.replace('league-', '');
      query = query.eq('leagueId', theSportsDBLeagueId);
    }
    
    const { data, error } = await query;
      
    if (error) throw error;
    
    console.log(`[v2] ✅ ${data?.length || 0}개 Highlightly 라이브 경기 조회됨`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2] Highlightly 라이브 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 특정 경기의 향상된 데이터 조회
 */
export async function fetchHighlightlyEnhancedMatchDetails(
  eventId: string
): Promise<HighlightlyEnhancedFixture | null> {
  console.log(`[v2] 🎯 Highlightly 향상된 경기 상세 조회: ${eventId}`);
  
  try {
    const { data, error } = await supabase
      .from('v2_events_enhanced')
      .select('*')
      .eq('id', eventId) // <-- 변경: idEvent -> id
      .single();
      
    if (error) throw error;
    
    console.log(`[v2] ✅ Highlightly 향상된 경기 상세 조회됨: ${eventId}`);
    return data || null;
    
  } catch (error) {
    console.error(`❌ [v2] Highlightly 향상된 경기 상세 조회 실패:`, error);
    return null;
  }
}

/**
 * 통계가 있는 경기 조회 (점유율, 슈팅 등 통계 데이터가 있는 경기만)
 */
export async function fetchHighlightlyMatchesWithStatistics(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 20
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`[v2] 📊 Highlightly 통계 데이터 있는 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('v2_events_enhanced')
      .select('*')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .not('possession_home', 'is', null) // This column comes from the 'events_highlightly_enhanced' table
      .not('shots_home', 'is', null) // This column comes from the 'events_highlightly_enhanced' table
      .order('date', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`[v2] ✅ ${data?.length || 0}개 Highlightly 통계 데이터 있는 경기 조회됨`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2] Highlightly 통계 데이터 있는 경기 조회 실패:', error);
    throw error;
  }
}

// The mapToHighlightlyEnhancedFixture function is no longer needed as the view
// now returns data in the desired shape, and the interface extends Match.

// 유틸리티 함수들 (변경 필요 없음)

/**
 * 경기 상태 한국어 변환
 */
export function getHighlightlyMatchStatusKorean(status: string, liveStatus?: string): string {
  if (liveStatus === 'live') return '진행중';
  
  const statusMap: Record<string, string> = {
    'SCHEDULED': '예정',
    'FINISHED': '종료',
    'POSTPONED': '연기',
    'CANCELED': '취소',
    'IN_PLAY': '진행중',
    'UNKNOWN': '미정',
  };
  
  return statusMap[status] || status;
}

/**
 * 점유율 차이에 따른 우세팀 표시
 */
export function getHighlightlyPossessionAdvantage(possessionHome?: number, possessionAway?: number): {
  team: 'home' | 'away' | 'equal';
  difference: number;
  display: string;
} {
  if (possessionHome === undefined || possessionAway === undefined || possessionHome === null || possessionAway === null) {
    return { team: 'equal', difference: 0, display: '정보 없음' };
  }
  
  const difference = Math.abs(possessionHome - possessionAway);
  
  if (difference < 5) {
    return { team: 'equal', difference, display: '균등' };
  }
  
  const team = possessionHome > possessionAway ? 'home' : 'away';
  const teamName = team === 'home' ? '홈팀' : '원정팀';
  
  return {
    team,
    difference,
    display: `${teamName} +${difference}%`
  };
}

/**
 * 슈팅 정확도 계산
 */
export function calculateHighlightlyShotAccuracy(shots?: number, shotsOnTarget?: number): {
  accuracy: number | null;
  display: string;
} {
  if (shots === undefined || shotsOnTarget === undefined || shots === null || shotsOnTarget === null || shots === 0) {
    return { accuracy: null, display: '정보 없음' };
  }
  
  const accuracy = Math.round((shotsOnTarget / shots) * 100);
  return {
    accuracy,
    display: `${accuracy}% (${shotsOnTarget}/${shots})`
  };
}

/**
 * 경기 강도 표시
 */
export function getHighlightlyMatchIntensity(intensity?: number): {
  level: 'low' | 'medium' | 'high' | 'extreme';
  display: string;
  color: string;
} {
  if (intensity === undefined || intensity === null) {
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

/**
 * 모멘텀 표시
 */
export function getHighlightlyMatchMomentum(momentum?: number): {
  direction: 'home' | 'away' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  display: string;
} {
  if (momentum === undefined || momentum === null) {
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
  
  return {
    direction,
    strength,
    display: `${teamName} ${strengthName} 우세`
  };
}