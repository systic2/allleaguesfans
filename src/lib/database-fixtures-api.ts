// Database-based fixtures API - No CORS issues
import { supabase } from './supabaseClient';

export interface DatabaseFixture {
  id: string;
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
  round: string;
  status: string;
  venue: string;
}

/**
 * Get recent completed matches (highest round with "Match Finished")
 */
export async function fetchRecentMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<DatabaseFixture[]> {
  console.log(`🔍 Fetching recent matches for ${leagueSlug}, season ${season}`);
  
  // Convert slug to TheSportsDB league ID
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    // Get all completed rounds and sort numerically in JavaScript
    const { data: allRoundsData, error: roundError } = await supabase
      .from('events')
      .select('intRound')
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season))
      .eq('strStatus', 'Match Finished');
    
    if (roundError) throw roundError;
    
    // Find the highest round number numerically
    const uniqueRounds = [...new Set(allRoundsData?.map(r => parseInt(r.intRound)).filter(r => !isNaN(r)) || [])];
    const latestRound = Math.max(...uniqueRounds);
    
    if (uniqueRounds.length === 0) {
      console.log('❌ No completed matches found');
      return [];
    }
    
    console.log(`📅 Latest completed round: ${latestRound}`);
    
    // Get matches from the latest completed round
    const { data, error } = await supabase
      .from('events')
      .select(`
        idEvent,
        strEvent,
        strHomeTeam,
        strAwayTeam,
        dateEvent,
        strStatus,
        intRound,
        intHomeScore,
        intAwayScore,
        strVenue,
        idLeague,
        strSeason
      `)
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season))
      .eq('strStatus', 'Match Finished')
      .eq('intRound', String(latestRound))
      .order('dateEvent', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`✅ Found ${data?.length || 0} recent matches from round ${latestRound}`);
    
    // Map database fields to interface
    const mappedData = (data || []).map(fixture => ({
      ...fixture,
      id: fixture.idEvent,
      round: String(fixture.intRound),
      status: fixture.strStatus,
      venue: fixture.strVenue || ''
    }));
    
    return mappedData;
    
  } catch (error) {
    console.error('❌ Error fetching recent matches:', error);
    throw error;
  }
}

/**
 * Get upcoming matches (lowest round with "Not Started")
 */
export async function fetchUpcomingMatches(
  leagueSlug: string,
  season: number = 2025,
  limit: number = 10
): Promise<DatabaseFixture[]> {
  console.log(`🔍 Fetching upcoming matches for ${leagueSlug}, season ${season}`);
  
  // Convert slug to TheSportsDB league ID
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    // Get all upcoming rounds and sort numerically in JavaScript
    const { data: allUpcomingRoundsData, error: roundError } = await supabase
      .from('events')
      .select('intRound')
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season))
      .eq('strStatus', 'Not Started');
    
    if (roundError) throw roundError;
    
    // Find the lowest round number numerically
    const uniqueUpcomingRounds = [...new Set(allUpcomingRoundsData?.map(r => parseInt(r.intRound)).filter(r => !isNaN(r)) || [])];
    const nextRound = Math.min(...uniqueUpcomingRounds);
    
    if (uniqueUpcomingRounds.length === 0) {
      console.log('❌ No upcoming matches found');
      return [];
    }
    
    console.log(`📅 Next upcoming round: ${nextRound}`);
    
    // Get matches from the next upcoming round
    const { data, error } = await supabase
      .from('events')
      .select(`
        idEvent,
        strEvent,
        strHomeTeam,
        strAwayTeam,
        dateEvent,
        strStatus,
        intRound,
        intHomeScore,
        intAwayScore,
        strVenue,
        idLeague,
        strSeason
      `)
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season))
      .eq('strStatus', 'Not Started')
      .eq('intRound', String(nextRound))
      .order('dateEvent', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    
    console.log(`✅ Found ${data?.length || 0} upcoming matches from round ${nextRound}`);
    
    // Map database fields to interface
    const mappedData = (data || []).map(fixture => ({
      ...fixture,
      id: fixture.idEvent,
      round: String(fixture.intRound),
      status: fixture.strStatus,
      venue: fixture.strVenue || ''
    }));
    
    return mappedData;
    
  } catch (error) {
    console.error('❌ Error fetching upcoming matches:', error);
    throw error;
  }
}

/**
 * Get matches by specific round
 */
export async function fetchMatchesByRound(
  leagueSlug: string,
  round: number,
  season: number = 2025
): Promise<DatabaseFixture[]> {
  console.log(`🔍 Fetching round ${round} matches for ${leagueSlug}, season ${season}`);
  
  // Convert slug to TheSportsDB league ID
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        idEvent,
        strEvent,
        strHomeTeam,
        strAwayTeam,
        dateEvent,
        strStatus,
        intRound,
        intHomeScore,
        intAwayScore,
        strVenue,
        idLeague,
        strSeason
      `)
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season))
      .eq('intRound', round)
      .order('dateEvent', { ascending: true });
      
    if (error) throw error;
    
    console.log(`✅ Found ${data?.length || 0} matches in round ${round}`);
    
    // Map database fields to interface
    const mappedData = (data || []).map(fixture => ({
      ...fixture,
      id: fixture.idEvent,
      round: String(fixture.intRound),
      status: fixture.strStatus,
      venue: fixture.strVenue || ''
    }));
    
    return mappedData;
    
  } catch (error) {
    console.error(`❌ Error fetching round ${round} matches:`, error);
    throw error;
  }
}

/**
 * Get all rounds with match counts for navigation
 */
export async function fetchRoundSummary(
  leagueSlug: string,
  season: number = 2025
): Promise<{ round: number; matchCount: number; status: string }[]> {
  console.log(`🔍 Fetching round summary for ${leagueSlug}, season ${season}`);
  
  // Convert slug to TheSportsDB league ID
  const theSportsDBLeagueId = leagueSlug === 'k-league-1' ? '4689' : 
                             leagueSlug === 'k-league-2' ? '4822' : 
                             leagueSlug.replace('league-', '');
  
  try {
    const { data, error } = await supabase
      .from('events')
      .select('intRound, strStatus')
      .eq('idLeague', theSportsDBLeagueId)
      .eq('strSeason', String(season));
      
    if (error) throw error;
    
    // Group by round and count matches
    const roundSummary = new Map<number, { matchCount: number; statuses: string[] }>();
    
    data?.forEach(event => {
      const round = event.intRound;
      if (!roundSummary.has(round)) {
        roundSummary.set(round, { matchCount: 0, statuses: [] });
      }
      const roundData = roundSummary.get(round)!;
      roundData.matchCount++;
      roundData.statuses.push(event.strStatus);
    });
    
    // Convert to array and determine overall status
    const result = Array.from(roundSummary.entries()).map(([round, data]) => {
      const allFinished = data.statuses.every(status => status === 'Match Finished');
      const anyStarted = data.statuses.some(status => status !== 'Not Started');
      
      let status = 'Not Started';
      if (allFinished) status = 'Completed';
      else if (anyStarted) status = 'In Progress';
      
      return {
        round,
        matchCount: data.matchCount,
        status
      };
    }).sort((a, b) => a.round - b.round);
    
    console.log(`✅ Found ${result.length} rounds`);
    return result;
    
  } catch (error) {
    console.error('❌ Error fetching round summary:', error);
    throw error;
  }
}