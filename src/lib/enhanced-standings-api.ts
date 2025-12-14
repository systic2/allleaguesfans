// Enhanced standings API using TheSportsDB data only
import { fetchLeagueStandings, type TeamStanding } from './api';

export interface EnhancedTeamStanding extends TeamStanding {
  recent_form: string; // Computed from recent fixtures (e.g., "WWDLL")
  form_details: {
    wins: number;
    draws: number;
    losses: number;
  };
  goal_difference_per_game: number;
}

/**
 * Generate recent form string from team form data
 */
function generateRecentForm(formString: string | null): string {
  if (!formString) return "N/A";
  
  // TheSportsDB form is like "DLWWL" - return first 5 characters
  return formString.substring(0, 5) || "N/A";
}

/**
 * Fetch enhanced league standings using TheSportsDB data
 * Now works with slug-based API calls
 */
export async function fetchEnhancedLeagueStandings(
  leagueSlug: string, 
  season: string = '2025'
): Promise<EnhancedTeamStanding[]> {
  console.log(`🔍 Fetching TheSportsDB standings for league slug: ${leagueSlug}, season ${season}`);
  
  try {
    // Use the updated fetchLeagueStandings that works with slug
    const basicStandings = await fetchLeagueStandings(leagueSlug, season);
    
    // Convert basic standings to enhanced format
    const enhancedStandings: EnhancedTeamStanding[] = basicStandings.map((standing): EnhancedTeamStanding => ({
      ...standing,
      recent_form: generateRecentForm(standing.form),
      form_details: {
        wins: standing.win,
        draws: standing.draw,
        losses: standing.lose,
      },
      goal_difference_per_game: standing.played > 0 ? standing.goals_diff / standing.played : 0,
    }));
    
    console.log(`✅ TheSportsDB: Successfully fetched ${enhancedStandings.length} teams for ${leagueSlug}`);
    return enhancedStandings;
  } catch (error) {
    console.error('❌ TheSportsDB standings failed:', error);
    throw error;
  }
}

/**
 * Legacy compatibility function - converts league ID to slug and calls new API
 * @deprecated Use fetchEnhancedLeagueStandings with slug instead
 */
export async function fetchEnhancedLeagueStandingsById(
  leagueId: number, 
  season: string = '2025'
): Promise<EnhancedTeamStanding[]> {
  console.warn('fetchEnhancedLeagueStandingsById is deprecated. Use slug-based API.');
  
  // Convert league ID to slug for compatibility
  let leagueSlug: string;
  if (leagueId === 249276) {
    leagueSlug = 'k-league-1';
  } else if (leagueId === 250127) {
    leagueSlug = 'k-league-2';
  } else {
    console.warn(`Unknown league ID ${leagueId}, defaulting to k-league-1`);
    leagueSlug = 'k-league-1';
  }
  
  return fetchEnhancedLeagueStandings(leagueSlug, season);
}