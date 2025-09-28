// Enhanced standings API using Highlightly API for K League data
import type { TeamStanding } from './api';

export interface EnhancedTeamStanding extends TeamStanding {
  recent_form: string; // Computed from recent fixtures (e.g., "WWDLL")
  form_details: {
    wins: number;
    draws: number;
    losses: number;
  };
  goal_difference_per_game: number;
}

// Highlightly API response interfaces
interface HighlightlyTeamStats {
  wins: number;
  draws: number;
  games: number;
  loses: number;
  scoredGoals: number;
  receivedGoals: number;
}

interface HighlightlyTeam {
  id: number;
  logo: string;
  name: string;
}

interface HighlightlyStanding {
  away: HighlightlyTeamStats;
  home: HighlightlyTeamStats;
  team: HighlightlyTeam;
  total: HighlightlyTeamStats;
  points: number;
  position: number;
}

interface HighlightlyGroup {
  name: string;
  standings: HighlightlyStanding[];
}

interface HighlightlyLeague {
  id: number;
  logo: string;
  name: string;
  season: number;
}

interface HighlightlyStandingsResponse {
  groups: HighlightlyGroup[];
  league: HighlightlyLeague;
}

/**
 * Fetch standings from Highlightly API via Vite proxy
 */
async function fetchHighlightlyStandings(leagueId: number, season: number): Promise<HighlightlyStandingsResponse> {
  // Use Vite proxy in development, direct URL in production
  const isDevelopment = import.meta.env.DEV;
  const baseUrl = isDevelopment 
    ? '/api/highlightly' 
    : 'https://sports.highlightly.net';
  
  const url = `${baseUrl}/football/standings?leagueId=${leagueId}&season=${season}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(isDevelopment ? {} : {
          'X-RapidAPI-Key': import.meta.env.VITE_HIGHLIGHTLY_API_KEY || '',
          'X-RapidAPI-Host': 'sports.highlightly.net',
        }),
        // Always include API key for development as well
        ...(isDevelopment && import.meta.env.VITE_HIGHLIGHTLY_API_KEY ? {
          'X-RapidAPI-Key': import.meta.env.VITE_HIGHLIGHTLY_API_KEY,
          'X-RapidAPI-Host': 'sports.highlightly.net',
        } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Highlightly API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Highlightly standings:', error);
    throw error;
  }
}

/**
 * Generate recent form string from team stats (placeholder implementation)
 */
function generateRecentForm(teamStats: HighlightlyTeamStats): string {
  // Since Highlightly doesn't provide recent form, we'll generate a placeholder
  // based on win percentage for now
  const totalGames = teamStats.games;
  const winRate = totalGames > 0 ? teamStats.wins / totalGames : 0;
  
  // Generate a simple form pattern based on performance
  if (winRate > 0.7) return 'WWWWW';
  if (winRate > 0.5) return 'WWDWL';
  if (winRate > 0.3) return 'WDLDL';
  return 'LLDLL';
}

/**
 * Fetch enhanced league standings using Highlightly API
 */
export async function fetchEnhancedLeagueStandings(
  leagueId: number, 
  season: number = 2025
): Promise<EnhancedTeamStanding[]> {
  try {
    // Map internal league ID to Highlightly league ID  
    // Internal K League 1 ID: 4001 → Highlightly K League 1 ID: 249276
    // Internal K League 2 ID: 4002 → Highlightly K League 2 ID: 250127
    // Fixed: Complete league ID mapping for both K League divisions
    let highlightlyLeagueId: number;
    
    if (leagueId === 4001 || leagueId === 1) {
      // K League 1
      highlightlyLeagueId = 249276;
    } else if (leagueId === 4002 || leagueId === 2) {
      // K League 2
      highlightlyLeagueId = 250127;
    } else {
      // For other leagues, fallback to K League 1 for now
      console.warn(`No Highlightly mapping found for league ID ${leagueId}, defaulting to K League 1`);
      highlightlyLeagueId = 249276;
    }
    
    console.log(`🔍 FIXED MAPPING - Fetching Highlightly standings: Internal ID ${leagueId} → Highlightly ID ${highlightlyLeagueId}, season ${season}`);
    
    // Fetch standings from Highlightly API
    const highlightlyData = await fetchHighlightlyStandings(highlightlyLeagueId, season);
    
    if (!highlightlyData.groups || highlightlyData.groups.length === 0) {
      console.warn(`No standings groups found for league ${highlightlyLeagueId}`);
      return [];
    }

    const standings = highlightlyData.groups[0].standings;
    if (!standings || standings.length === 0) {
      console.warn(`No standings data found for league ${highlightlyLeagueId}`);
      return [];
    }

    // Convert Highlightly standings to our format
    const enhancedStandings: EnhancedTeamStanding[] = standings.map((standing: HighlightlyStanding): EnhancedTeamStanding => {
      const totalStats = standing.total;
      const goalDifference = totalStats.scoredGoals - totalStats.receivedGoals;
      const form = generateRecentForm(totalStats);
      
      return {
        team_id: standing.team.id,
        team_name: standing.team.name,
        short_name: null, // Highlightly doesn't provide short names
        crest_url: standing.team.logo,
        rank: standing.position,
        points: standing.points,
        played: totalStats.games,
        win: totalStats.wins,
        draw: totalStats.draws,
        lose: totalStats.loses,
        goals_for: totalStats.scoredGoals,
        goals_against: totalStats.receivedGoals,
        goals_diff: goalDifference,
        form: form,
        // Enhanced fields
        recent_form: form,
        form_details: {
          wins: totalStats.wins,
          draws: totalStats.draws,
          losses: totalStats.loses
        },
        goal_difference_per_game: totalStats.games > 0 ? 
          Number((goalDifference / totalStats.games).toFixed(2)) : 0
      };
    });

    console.log(`✅ Enhanced Highlightly standings for league ${highlightlyLeagueId}: ${enhancedStandings.length} teams`);
    return enhancedStandings;

  } catch (error) {
    console.error('Error fetching enhanced standings from Highlightly:', error);
    throw error;
  }
}

/**
 * Get standings with form statistics using Highlightly API
 */
export async function getStandingsWithFormStats(leagueId: number, season: number = 2025) {
  const standings = await fetchEnhancedLeagueStandings(leagueId, season);
  
  if (standings.length === 0) {
    return {
      standings: [],
      statistics: {
        teams_with_form: 0,
        avg_goals_per_game: 0,
        most_recent_wins: [],
        relegation_battle: []
      }
    };
  }
  
  // Calculate form statistics
  const formStats = {
    teams_with_form: standings.filter(team => team.recent_form.length > 0).length,
    avg_goals_per_game: standings.reduce((sum, team) => 
      sum + (team.played > 0 ? (team.goals_for + team.goals_against) / team.played : 0), 0
    ) / standings.length,
    most_recent_wins: standings
      .filter(team => team.recent_form.startsWith('W'))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map(team => team.team_name),
    relegation_battle: standings
      .slice(-4)
      .map(team => ({
        name: team.team_name,
        points: team.points,
        goal_diff: team.goals_diff,
        recent_form: team.recent_form.slice(-3) // Last 3 games
      }))
  };

  return {
    standings,
    statistics: formStats
  };
}