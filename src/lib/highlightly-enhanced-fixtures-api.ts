// Highlightly Enhanced fixtures API with statistics and real-time data
import { supabase } from './supabaseClient';

export interface HighlightlyEnhancedFixture {
  // TheSportsDB 기본 데이터
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
  
  // Highlightly 향상 데이터
  highlightly_event_id?: string;
  live_status?: string;
  live_minute?: number;
  live_period?: string;
  live_score_home?: number;
  live_score_away?: number;
  
  // 고급 통계
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
  
  // 특수 지표
  momentum?: number;
  intensity?: number;
  
  // 메타데이터
  highlightly_last_updated?: string;
  highlightly_sync_status?: string;
  
  // 파생 필드
  is_live?: boolean;
  possession_difference?: number;
  shot_accuracy_home?: number;
  shot_accuracy_away?: number;
  
  // 기존 호환성
  id: string;
  round: string;
  status: string;
  venue: string;
}

/**
 * 향상된 최근 경기 데이터 조회 (Highlightly 데이터 포함)
 */
export async function fetchHighlightlyEnhancedRecentMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`🔍 Highlightly 향상된 최근 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  // Convert slug to TheSportsDB league ID
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events_enhanced')
      .select('*')
      .eq('"idLeague"', theSportsDBLeagueId)
      .eq('"strSeason"', String(season))
      .eq('"strStatus"', 'Match Finished')
      .order('"dateEvent"', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`✅ ${data?.length || 0}개 Highlightly 향상된 최근 경기 조회됨`);
    
    return (data || []).map(mapToHighlightlyEnhancedFixture);
    
  } catch (error) {
    console.error('❌ Highlightly 향상된 최근 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 향상된 예정 경기 데이터 조회 (Highlightly 데이터 포함)
 */
export async function fetchHighlightlyEnhancedUpcomingMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`🔮 Highlightly 향상된 예정 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events_enhanced')
      .select('*')
      .eq('"idLeague"', theSportsDBLeagueId)
      .eq('"strSeason"', String(season))
      .eq('"strStatus"', 'Not Started')
      .order('"dateEvent"', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`✅ ${data?.length || 0}개 Highlightly 향상된 예정 경기 조회됨`);
    
    return (data || []).map(mapToHighlightlyEnhancedFixture);
    
  } catch (error) {
    console.error('❌ Highlightly 향상된 예정 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 라이브 경기 조회 (실시간 데이터 포함)
 */
export async function fetchHighlightlyLiveMatches(
  leagueSlug?: string,
  season: number = 2025
): Promise<HighlightlyEnhancedFixture[]> {
  console.log(`📺 Highlightly 라이브 경기 조회: ${leagueSlug || '전체'}, 시즌 ${season}`);
  
  try {
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
    
    console.log(`✅ ${data?.length || 0}개 Highlightly 라이브 경기 조회됨`);
    
    return (data || []).map(mapToHighlightlyEnhancedFixture);
    
  } catch (error) {
    console.error('❌ Highlightly 라이브 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 특정 경기의 향상된 데이터 조회
 */
export async function fetchHighlightlyEnhancedMatchDetails(
  eventId: string
): Promise<HighlightlyEnhancedFixture | null> {
  console.log(`🎯 Highlightly 향상된 경기 상세 조회: ${eventId}`);
  
  try {
    const { data, error } = await supabase
      .from('events_enhanced')
      .select('*')
      .eq('"idEvent"', eventId)
      .single();
      
    if (error) throw error;
    
    console.log(`✅ Highlightly 향상된 경기 상세 조회됨: ${eventId}`);
    
    return data ? mapToHighlightlyEnhancedFixture(data) : null;
    
  } catch (error) {
    console.error('❌ Highlightly 향상된 경기 상세 조회 실패:', error);
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
  console.log(`📊 Highlightly 통계 데이터 있는 경기 조회: ${leagueSlug}, 시즌 ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
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
    
    console.log(`✅ ${data?.length || 0}개 Highlightly 통계 데이터 있는 경기 조회됨`);
    
    return (data || []).map(mapToHighlightlyEnhancedFixture);
    
  } catch (error) {
    console.error('❌ Highlightly 통계 데이터 있는 경기 조회 실패:', error);
    throw error;
  }
}

/**
 * 데이터베이스 결과를 HighlightlyEnhancedFixture 형식으로 변환
 */
function mapToHighlightlyEnhancedFixture(data: any): HighlightlyEnhancedFixture {
  return {
    // TheSportsDB 기본 데이터
    idEvent: data.idEvent,
    strEvent: data.strEvent,
    strHomeTeam: data.strHomeTeam,
    strAwayTeam: data.strAwayTeam,
    dateEvent: data.dateEvent,
    strStatus: data.strStatus,
    intRound: data.intRound,
    intHomeScore: data.intHomeScore,
    intAwayScore: data.intAwayScore,
    strVenue: data.strVenue,
    idLeague: data.idLeague,
    strSeason: data.strSeason,
    
    // Highlightly 향상 데이터
    highlightly_event_id: data.highlightly_event_id,
    live_status: data.live_status,
    live_minute: data.live_minute,
    live_period: data.live_period,
    live_score_home: data.live_score_home,
    live_score_away: data.live_score_away,
    
    // 고급 통계
    possession_home: data.possession_home,
    possession_away: data.possession_away,
    shots_home: data.shots_home,
    shots_away: data.shots_away,
    shots_on_target_home: data.shots_on_target_home,
    shots_on_target_away: data.shots_on_target_away,
    corners_home: data.corners_home,
    corners_away: data.corners_away,
    fouls_home: data.fouls_home,
    fouls_away: data.fouls_away,
    yellow_cards_home: data.yellow_cards_home,
    yellow_cards_away: data.yellow_cards_away,
    red_cards_home: data.red_cards_home,
    red_cards_away: data.red_cards_away,
    ht_score_home: data.ht_score_home,
    ht_score_away: data.ht_score_away,
    
    // 특수 지표
    momentum: data.momentum,
    intensity: data.intensity,
    
    // 메타데이터
    highlightly_last_updated: data.highlightly_last_updated,
    highlightly_sync_status: data.highlightly_sync_status,
    
    // 파생 필드
    is_live: data.is_live,
    possession_difference: data.possession_difference,
    shot_accuracy_home: data.shot_accuracy_home,
    shot_accuracy_away: data.shot_accuracy_away,
    
    // 기존 호환성
    id: data.idEvent,
    round: String(data.intRound),
    status: data.strStatus,
    venue: data.strVenue || '',
  };
}

// 유틸리티 함수들

/**
 * 경기 상태 한국어 변환
 */
export function getHighlightlyMatchStatusKorean(status: string, liveStatus?: string): string {
  if (liveStatus === 'live') return '진행중';
  
  const statusMap: Record<string, string> = {
    'not_started': '예정',
    'finished': '종료',
    'Not Started': '예정',
    'Match Finished': '종료',
    'TBD': '미정',
    'Postponed': '연기',
    'Cancelled': '취소',
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
  if (!possessionHome || !possessionAway) {
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
  if (!shots || !shotsOnTarget || shots === 0) {
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

/**
 * 모멘텀 표시
 */
export function getHighlightlyMatchMomentum(momentum?: number): {
  direction: 'home' | 'away' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  display: string;
} {
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
  
  return {
    direction,
    strength,
    display: `${teamName} ${strengthName} 우세`
  };
}