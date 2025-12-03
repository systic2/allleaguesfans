// src/lib/database-fixtures-api.ts
// REFACTORED VERSION: This file now queries 'events_v2' and JOINS with 'teams_v2'.
import { supabase } from './supabaseClient';
import type { Match, Team } from '@/types/domain';

// The fixture type now includes the nested team objects
export interface DatabaseFixture extends Match {
  homeTeam: Team | null;
  awayTeam: Team | null;
}

const V2_FIXTURE_SELECT_QUERY = `
  *,
  homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
  awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
`;


/**
 * Get recent completed matches from the latest completed round using events_v2.
 */
export async function fetchRecentMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<DatabaseFixture[]> {
  console.log(`[v2 JOIN] 🔍 Fetching recent matches for ${leagueSlug}, season ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data: allRoundsData, error: roundError } = await supabase
      .from('events_v2')
      .select('round')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .eq('status', 'FINISHED');
    
    if (roundError) throw roundError;
    
    const uniqueRounds = [...new Set(allRoundsData?.map(r => parseInt(r.round || '0')).filter(r => !isNaN(r) && r > 0) || [])];
    if (uniqueRounds.length === 0) {
      console.log('❌ No completed matches found in events_v2');
      return [];
    }
    const latestRound = Math.max(...uniqueRounds);
    
    console.log(`[v2 JOIN] 📅 Latest completed round: ${latestRound}`);
    
    const { data, error } = await supabase
      .from('events_v2')
      .select(V2_FIXTURE_SELECT_QUERY)
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .eq('status', 'FINISHED')
      .eq('round', String(latestRound))
      .order('date', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`[v2 JOIN] ✅ Found ${data?.length || 0} recent matches from round ${latestRound}`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2 JOIN] Error fetching recent matches:', error);
    throw error;
  }
}

/**
 * Get upcoming matches from the next upcoming round using events_v2.
 */
export async function fetchUpcomingMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<DatabaseFixture[]> {
  console.log(`[v2 JOIN] 🔍 Fetching upcoming matches for ${leagueSlug}, season ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data: allUpcomingRoundsData, error: roundError } = await supabase
      .from('events_v2')
      .select('round')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .in('status', ['SCHEDULED', 'POSTPONED']);
    
    if (roundError) throw roundError;

    const uniqueUpcomingRounds = [...new Set(allUpcomingRoundsData?.map(r => parseInt(r.round || '0')).filter(r => !isNaN(r) && r > 0) || [])];
    if (uniqueUpcomingRounds.length === 0) {
      console.log('❌ No upcoming matches found in events_v2');
      return [];
    }
    const nextRound = Math.min(...uniqueUpcomingRounds);
    
    console.log(`[v2 JOIN] 📅 Next upcoming round: ${nextRound}`);
    
    const { data, error } = await supabase
      .from('events_v2')
      .select(V2_FIXTURE_SELECT_QUERY)
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .in('status', ['SCHEDULED', 'POSTPONED'])
      .eq('round', String(nextRound))
      .order('date', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`[v2 JOIN] ✅ Found ${data?.length || 0} upcoming matches from round ${nextRound}`);
    return data || [];
    
  } catch (error) {
    console.error('❌ [v2 JOIN] Error fetching upcoming matches:', error);
    throw error;
  }
}

/**
 * Get matches by specific round using events_v2.
 */
export async function fetchMatchesByRound(
  leagueSlug: string,
  round: number,
  season: number = 2025
): Promise<DatabaseFixture[]> {
  console.log(`[v2 JOIN] 🔍 Fetching round ${round} matches for ${leagueSlug}, season ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events_v2')
      .select(V2_FIXTURE_SELECT_QUERY)
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season))
      .eq('round', String(round))
      .order('date', { ascending: true });
      
    if (error) throw error;
    
    console.log(`[v2 JOIN] ✅ Found ${data?.length || 0} matches in round ${round}`);
    return data || [];
    
  } catch (error) {
    console.error(`❌ [v2 JOIN] Error fetching round ${round} matches:`, error);
    throw error;
  }
}

/**
 * Get all rounds with match counts for navigation using events_v2.
 */
export async function fetchRoundSummary(
  leagueSlug: string,
  season: number = 2025
): Promise<{ round: string; matchCount: number; status: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED' }[]> {
  console.log(`[v2] 🔍 Fetching round summary for ${leagueSlug}, season ${season}`);
  
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events_v2')
      .select('round, status')
      .eq('leagueId', theSportsDBLeagueId)
      .eq('season', String(season));
      
    if (error) throw error;
    
    const roundSummary = new Map<string, { matchCount: number; statuses: Match['status'][] }>();
    
    data?.forEach(event => {
      const round = event.round || 'N/A';
      if (!roundSummary.has(round)) {
        roundSummary.set(round, { matchCount: 0, statuses: [] });
      }
      const roundData = roundSummary.get(round)!;
      roundData.matchCount++;
      roundData.statuses.push(event.status as Match['status']);
    });
    
    const result = Array.from(roundSummary.entries()).map(([round, data]) => {
      const allFinished = data.statuses.every(status => status === 'FINISHED');
      const anyStarted = data.statuses.some(status => status !== 'SCHEDULED');
      
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED' = 'SCHEDULED';
      if (allFinished) {
        status = 'COMPLETED';
      } else if (anyStarted) {
        status = 'IN_PROGRESS';
      }
      
      return {
        round,
        matchCount: data.matchCount,
        status
      };
    }).sort((a, b) => (parseInt(a.round) || 0) - (parseInt(b.round) || 0));
    
    console.log(`[v2] ✅ Found ${result.length} rounds`);
    return result;
    
  } catch (error) {
    console.error('❌ [v2] Error fetching round summary:', error);
    throw error;
  }
}