// Enhanced fixtures API using Highlightly API for accurate team logos
import { fetchEnhancedLeagueStandings, type EnhancedTeamStanding } from './enhanced-standings-api';
import { fetchUpcomingFixtures as fetchDatabaseFixtures, type UpcomingFixture } from './api';

export interface EnhancedUpcomingFixture extends Omit<UpcomingFixture, 'home_team' | 'away_team' | 'league_id'> {
  home_team: {
    id: string;
    name: string;
    logo_url: string | null;
    highlightly_logo?: string | null; // Enhanced logo from Highlightly
  };
  away_team: {
    id: string;
    name: string;
    logo_url: string | null;
    highlightly_logo?: string | null; // Enhanced logo from Highlightly
  };
  league_id: string; // Updated to string
}

/**
 * Team logo cache for performance optimization
 */
class TeamLogoCache {
  private cache = new Map<string, { logos: Map<string, string>, timestamp: number }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  getCacheKey(leagueId: string, season: number): string {
    return `${leagueId}-${season}`;
  }

  get(leagueId: string, season: number): Map<string, string> | null {
    const key = this.getCacheKey(leagueId, season);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.logos;
  }

  set(leagueId: string, season: number, logos: Map<string, string>): void {
    const key = this.getCacheKey(leagueId, season);
    this.cache.set(key, {
      logos,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const logoCache = new TeamLogoCache();

/**
 * Fetch team logos from enhanced standings API
 */
async function fetchTeamLogosFromStandings(leagueId: string, season: number = 2025): Promise<Map<string, string>> {
  // Check cache first
  const cached = logoCache.get(leagueId, season);
  if (cached) {
    return cached;
  }

  try {
    // Convert leagueId to slug for the new API
    // The leagueId here is already a string (e.g., '4689' or '4822')
    const leagueSlug = leagueId === '4689' ? 'k-league-1' : 
                      leagueId === '4822' ? 'k-league-2' : 
                      `league-${leagueId}`;
    const standings = await fetchEnhancedLeagueStandings(leagueSlug, season);
    const logos = new Map<string, string>();
    
    standings.forEach((team: EnhancedTeamStanding) => {
      if (team.crest_url) {
        logos.set(String(team.team_id), team.crest_url); // Ensure team_id is string
      }
    });

    // Cache the results
    logoCache.set(leagueId, season, logos);
    
    console.log(`✅ Fetched ${logos.size} team logos for league ${leagueId}`);
    return logos;
  } catch (error) {
    console.warn(`Failed to fetch team logos for league ${leagueId}:`, error);
    return new Map();
  }
}

/**
 * Enhanced fetch upcoming fixtures with accurate logos from Highlightly
 */
export async function fetchEnhancedUpcomingFixtures(
  leagueId?: string, 
  limit: number = 10
): Promise<EnhancedUpcomingFixture[]> {
  try {
    // Fetch basic fixtures from database
    const basicFixtures = await fetchDatabaseFixtures(leagueId ? Number(leagueId) : undefined, limit); // Convert back to number for legacy fetchDatabaseFixtures
    
    if (basicFixtures.length === 0) {
      return [];
    }

    // Get unique league IDs from fixtures
    const leagueIds = Array.from(new Set(basicFixtures.map(f => String(f.league_id)))); // Ensure league_id is string
    
    // Fetch logos for all relevant leagues
    const allLogos = new Map<string, string>(); // Updated Map key type
    
    for (const currentLeagueId of leagueIds) {
      try {
        const leagueLogos = await fetchTeamLogosFromStandings(currentLeagueId, 2025);
        leagueLogos.forEach((logo, teamId) => {
          allLogos.set(teamId, logo);
        });
      } catch (error) {
        console.warn(`Failed to fetch logos for league ${currentLeagueId}:`, error);
      }
    }

    // Enhance fixtures with Highlightly logos
    const enhancedFixtures: EnhancedUpcomingFixture[] = basicFixtures.map(fixture => {
      const homeHighlightlyLogo = allLogos.get(String(fixture.home_team.id)); // Ensure ID is string
      const awayHighlightlyLogo = allLogos.get(String(fixture.away_team.id)); // Ensure ID is string
      
      return {
        ...fixture,
        home_team: {
          ...fixture.home_team,
          id: String(fixture.home_team.id), // Ensure ID is string
          highlightly_logo: homeHighlightlyLogo || null,
          // Use Highlightly logo if available, otherwise fallback to database logo
          logo_url: homeHighlightlyLogo || fixture.home_team.logo_url
        },
        away_team: {
          ...fixture.away_team,
          id: String(fixture.away_team.id), // Ensure ID is string
          highlightly_logo: awayHighlightlyLogo || null,
          // Use Highlightly logo if available, otherwise fallback to database logo
          logo_url: awayHighlightlyLogo || fixture.away_team.logo_url
        },
        league_id: String(fixture.league_id), // Ensure ID is string
      };
    });

    const enhancedCount = enhancedFixtures.filter(f => 
      f.home_team.highlightly_logo || f.away_team.highlightly_logo
    ).length;
    
    console.log(`✅ Enhanced ${enhancedCount}/${enhancedFixtures.length} fixtures with Highlightly logos`);
    return enhancedFixtures;

  } catch (error) {
    console.error('Error fetching enhanced upcoming fixtures:', error);
    // Fallback to basic fixtures if enhancement fails
    return await fetchDatabaseFixtures(leagueId ? Number(leagueId) : undefined, limit) as EnhancedUpcomingFixture[];
  }
}

/**
 * Enhanced fetch team upcoming fixtures with accurate logos
 */
export async function fetchEnhancedTeamUpcomingFixtures(
  teamId: string, 
  limit: number = 5
): Promise<EnhancedUpcomingFixture[]> {
  try {
    // For team-specific fixtures, we'll enhance them based on the team's league
    const basicFixtures = await fetchDatabaseFixtures(undefined, 50); // Get more to filter
    
    // Filter for the specific team
    const teamFixtures = basicFixtures.filter(fixture => 
      String(fixture.home_team.id) === teamId || String(fixture.away_team.id) === teamId // Ensure comparison is string to string
    ).slice(0, limit);

    if (teamFixtures.length === 0) {
      return [];
    }

    // Get league IDs and enhance with logos
    const leagueIds = Array.from(new Set(teamFixtures.map(f => String(f.league_id)))); // Ensure league_id is string
    const allLogos = new Map<string, string>(); // Updated Map key type
    
    for (const leagueId of leagueIds) {
      try {
        const leagueLogos = await fetchTeamLogosFromStandings(leagueId, 2025);
        leagueLogos.forEach((logo, id) => {
          allLogos.set(id, logo);
        });
      } catch (error) {
        console.warn(`Failed to fetch logos for league ${leagueId}:`, error);
      }
    }

    // Enhance with logos
    const enhancedFixtures: EnhancedUpcomingFixture[] = teamFixtures.map(fixture => {
      const homeHighlightlyLogo = allLogos.get(String(fixture.home_team.id)); // Ensure ID is string
      const awayHighlightlyLogo = allLogos.get(String(fixture.away_team.id)); // Ensure ID is string
      
      return {
        ...fixture,
        home_team: {
          ...fixture.home_team,
          id: String(fixture.home_team.id), // Ensure ID is string
          highlightly_logo: homeHighlightlyLogo || null,
          logo_url: homeHighlightlyLogo || fixture.home_team.logo_url
        },
        away_team: {
          ...fixture.away_team,
          id: String(fixture.away_team.id), // Ensure ID is string
          highlightly_logo: awayHighlightlyLogo || null,
          logo_url: awayHighlightlyLogo || fixture.away_team.logo_url
        },
        league_id: String(fixture.league_id), // Ensure ID is string
      };
    });

    return enhancedFixtures;

  } catch (error) {
    console.error('Error fetching enhanced team upcoming fixtures:', error);
    return [];
  }
}

/**
 * Clear the logo cache (useful for development/testing)
 */
export function clearLogoCache(): void {
  logoCache.clear();
  console.log('🧹 Team logo cache cleared');
}

/**
 * Get cache statistics for debugging
 */
export function getLogoCacheStats(): { entries: number, keys: string[] } {
  const entries = logoCache['cache'].size;
  const keys = Array.from(logoCache['cache'].keys());
  return { entries, keys };
}