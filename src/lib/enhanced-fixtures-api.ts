// Enhanced fixtures API using Highlightly API for accurate team logos
import { fetchEnhancedLeagueStandings, type EnhancedTeamStanding } from './enhanced-standings-api';
import { fetchUpcomingFixtures as fetchDatabaseFixtures, type UpcomingFixture } from './api';

export interface EnhancedUpcomingFixture extends Omit<UpcomingFixture, 'home_team' | 'away_team'> {
  home_team: {
    id: number;
    name: string;
    logo_url: string | null;
    highlightly_logo?: string | null; // Enhanced logo from Highlightly
  };
  away_team: {
    id: number;
    name: string;
    logo_url: string | null;
    highlightly_logo?: string | null; // Enhanced logo from Highlightly
  };
}

/**
 * Team logo cache for performance optimization
 */
class TeamLogoCache {
  private cache = new Map<string, { logos: Map<number, string>, timestamp: number }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  getCacheKey(leagueId: number, season: number): string {
    return `${leagueId}-${season}`;
  }

  get(leagueId: number, season: number): Map<number, string> | null {
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

  set(leagueId: number, season: number, logos: Map<number, string>): void {
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
async function fetchTeamLogosFromStandings(leagueId: number, season: number = 2025): Promise<Map<number, string>> {
  // Check cache first
  const cached = logoCache.get(leagueId, season);
  if (cached) {
    return cached;
  }

  try {
    const standings = await fetchEnhancedLeagueStandings(leagueId, season);
    const logos = new Map<number, string>();
    
    standings.forEach((team: EnhancedTeamStanding) => {
      if (team.crest_url) {
        logos.set(team.team_id, team.crest_url);
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
  leagueId?: number, 
  limit: number = 10
): Promise<EnhancedUpcomingFixture[]> {
  try {
    // Fetch basic fixtures from database
    const basicFixtures = await fetchDatabaseFixtures(leagueId, limit);
    
    if (basicFixtures.length === 0) {
      return [];
    }

    // Get unique league IDs from fixtures
    const leagueIds = Array.from(new Set(basicFixtures.map(f => f.league_id)));
    
    // Fetch logos for all relevant leagues
    const allLogos = new Map<number, string>();
    
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
      const homeHighlightlyLogo = allLogos.get(fixture.home_team.id);
      const awayHighlightlyLogo = allLogos.get(fixture.away_team.id);
      
      return {
        ...fixture,
        home_team: {
          ...fixture.home_team,
          highlightly_logo: homeHighlightlyLogo || null,
          // Use Highlightly logo if available, otherwise fallback to database logo
          logo_url: homeHighlightlyLogo || fixture.home_team.logo_url
        },
        away_team: {
          ...fixture.away_team,
          highlightly_logo: awayHighlightlyLogo || null,
          // Use Highlightly logo if available, otherwise fallback to database logo
          logo_url: awayHighlightlyLogo || fixture.away_team.logo_url
        }
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
    return await fetchDatabaseFixtures(leagueId, limit) as EnhancedUpcomingFixture[];
  }
}

/**
 * Enhanced fetch team upcoming fixtures with accurate logos
 */
export async function fetchEnhancedTeamUpcomingFixtures(
  teamId: number, 
  limit: number = 5
): Promise<EnhancedUpcomingFixture[]> {
  try {
    // For team-specific fixtures, we'll enhance them based on the team's league
    const basicFixtures = await fetchDatabaseFixtures(undefined, 50); // Get more to filter
    
    // Filter for the specific team
    const teamFixtures = basicFixtures.filter(fixture => 
      fixture.home_team.id === teamId || fixture.away_team.id === teamId
    ).slice(0, limit);

    if (teamFixtures.length === 0) {
      return [];
    }

    // Get league IDs and enhance with logos
    const leagueIds = Array.from(new Set(teamFixtures.map(f => f.league_id)));
    const allLogos = new Map<number, string>();
    
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
      const homeHighlightlyLogo = allLogos.get(fixture.home_team.id);
      const awayHighlightlyLogo = allLogos.get(fixture.away_team.id);
      
      return {
        ...fixture,
        home_team: {
          ...fixture.home_team,
          highlightly_logo: homeHighlightlyLogo || null,
          logo_url: homeHighlightlyLogo || fixture.home_team.logo_url
        },
        away_team: {
          ...fixture.away_team,
          highlightly_logo: awayHighlightlyLogo || null,
          logo_url: awayHighlightlyLogo || fixture.away_team.logo_url
        }
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