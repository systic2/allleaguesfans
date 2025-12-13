// src/lib/thesportsdb-api.ts
// REFACTORED VERSION: Uses events_v2 and Match domain model
import { supabase } from "@/lib/supabaseClient";
import type { Match, Team } from "@/types/domain";

// Define a new type for a Match with joined team data
export type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
};

// ========================================
// TheSportsDB Native Types
// ========================================

export interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  strEventAlternate?: string;
  strSport?: string;
  idLeague?: string;
  strLeague?: string;
  strSeason?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  intHomeScoreET?: string;
  intAwayScoreET?: string;
  intHomeScorePen?: string;
  intAwayScorePen?: string;
  dateEvent?: string;
  dateEventLocal?: string;
  strTime?: string;
  strTimeLocal?: string;
  strTimestamp?: string;
  intRound?: string;
  strResult?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strPoster?: string;
  strStatus?: string;
  strPostponed?: string;
  idAPIfootball?: string;
  strLocked?: string;
  highlightly_id?: number;
  strHighlights?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TheSportsDBScheduleResponse {
  schedule: TheSportsDBEvent[];
}

// API Functions - All functions now return Match[] from events_v2

/**
 * Fetch upcoming fixtures for ALL leagues from events_v2
 * Useful for the main dashboard or combined calendar
 */
export async function fetchAllUpcomingFixtures(limit: number = 10): Promise<MatchWithTeams[]> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data, error } = await supabase
      .from('events_v2')
      .select(`
        *,
        homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
        awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
      `)
      .in('status', ['SCHEDULED', 'POSTPONED', 'FINISHED', 'IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT'])
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Database error fetching all upcoming fixtures:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data as MatchWithTeams[];
  } catch (error) {
    console.error('Error fetching all upcoming fixtures:', error);
    return [];
  }
}

/**
 * Fetch upcoming fixtures for a specific league from events_v2
 * Returns only fixtures from the next upcoming round (lowest round number with "SCHEDULED" status)
 */
export async function fetchLeagueUpcomingFixtures(leagueId: string): Promise<MatchWithTeams[]> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: upcomingData, error: upcomingError } = await supabase
      .from('events_v2')
      .select(`
        *,
        homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
        awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
      `)
      .eq('leagueId', leagueId)
      .in('status', ['SCHEDULED', 'POSTPONED', 'FINISHED', 'IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT'])
      .gte('date', today)
      .order('date', { ascending: true });

    if (upcomingError) {
      console.error('Database error fetching league upcoming fixtures with teams:', upcomingError);
      return [];
    }

    if (!upcomingData || upcomingData.length === 0) {
      console.warn(`No upcoming fixtures data for league ${leagueId} in events_v2`);
      return [];
    }

    const nextRoundNumber = upcomingData[0].round;
    const nextRoundFixtures = upcomingData.filter(
      (match) => match.round === nextRoundNumber
    );

    return nextRoundFixtures as MatchWithTeams[];
  } catch (error) {
    console.error('Error fetching league upcoming fixtures with teams:', error);
    return [];
  }
}

/**
 * Fetch previous/completed fixtures for a specific league from events_v2
 */
export async function fetchLeaguePreviousFixtures(leagueId: string): Promise<MatchWithTeams[]> {
  try {
    const today = new Date().toISOString();

    const { data, error } = await supabase
      .from('events_v2')
      .select(`
        *,
        homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
        awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
      `)
      .eq('leagueId', leagueId)
      .eq('status', 'FINISHED')
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Database error fetching league previous fixtures with teams:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`No previous fixtures data for league ${leagueId} in events_v2`);
      return [];
    }

    return data as MatchWithTeams[];
  } catch (error) {
    console.error('Error fetching league previous fixtures with teams:', error);
    return [];
  }
}

/**
 * Fetch upcoming fixtures for a specific team from events_v2
 */
export async function fetchTeamUpcomingFixtures(teamId: string): Promise<MatchWithTeams[]> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data, error } = await supabase
      .from('events_v2')
      .select(`
        *,
        homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
        awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
      `)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .in('status', ['SCHEDULED', 'POSTPONED', 'FINISHED', 'IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT'])
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(15);

    if (error) {
      console.error('Database error fetching team upcoming fixtures with teams:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`No upcoming fixtures data for team ${teamId} in events_v2`);
      return [];
    }

    return data as MatchWithTeams[];
  } catch (error) {
    console.error('Error fetching team upcoming fixtures with teams:', error);
    return [];
  }
}

/**
 * Fetch previous/completed fixtures for a specific team from events_v2
 */
export async function fetchTeamPreviousFixtures(teamId: string): Promise<MatchWithTeams[]> {
  try {
    const today = new Date().toISOString();

    const { data, error } = await supabase
      .from('events_v2')
      .select(`
        *,
        homeTeam:teams_v2!homeTeamId(id, name, badgeUrl),
        awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)
      `)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .eq('status', 'FINISHED')
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Database error fetching team previous fixtures with teams:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`No previous fixtures data for team ${teamId} in events_v2`);
      return [];
    }

    return data as MatchWithTeams[];
  } catch (error) {
    console.error('Error fetching team previous fixtures with teams:', error);
    return [];
  }
}

// Convenience functions for K League

/**
 * Fetch upcoming fixtures for K League 1 (League ID: 4689)
 */
export async function fetchKLeague1UpcomingFixtures(): Promise<MatchWithTeams[]> {
  return fetchLeagueUpcomingFixtures('4689');
}

/**
 * Fetch previous fixtures for K League 1 (League ID: 4689)
 */
export async function fetchKLeague1PreviousFixtures(): Promise<MatchWithTeams[]> {
  return fetchLeaguePreviousFixtures('4689');
}

/**
 * Fetch upcoming fixtures for K League 2 (League ID: 4822)
 */
export async function fetchKLeague2UpcomingFixtures(): Promise<MatchWithTeams[]> {
  return fetchLeagueUpcomingFixtures('4822');
}

/**
 * Fetch previous fixtures for K League 2 (League ID: 4822)
 */
export async function fetchKLeague2PreviousFixtures(): Promise<MatchWithTeams[]> {
  return fetchLeaguePreviousFixtures('4822');
}

// Combined function to get both upcoming and recent fixtures for a league
export async function fetchLeagueFixtures(leagueId: string): Promise<{
  upcoming: MatchWithTeams[];
  recent: MatchWithTeams[];
}> {
  const [upcoming, recent] = await Promise.all([
    fetchLeagueUpcomingFixtures(leagueId),
    fetchLeaguePreviousFixtures(leagueId),
  ]);

  return {
    upcoming,
    recent: recent.slice(0, 10), // Limit recent fixtures to latest 10
  };
}

// Combined function to get both upcoming and recent fixtures for a team
export async function fetchTeamFixtures(teamId: string): Promise<{
  upcoming: MatchWithTeams[];
  recent: MatchWithTeams[];
}> {
  const [upcoming, recent] = await Promise.all([
    fetchTeamUpcomingFixtures(teamId),
    fetchTeamPreviousFixtures(teamId),
  ]);

  return {
    upcoming,
    recent: recent.slice(0, 10), // Limit recent fixtures to latest 10
  };
}

// Error handling utility
export class TheSportsDBError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TheSportsDBError';
  }
}

// Constants for K League IDs
export const K_LEAGUE_IDS = {
  K_LEAGUE_1: '4689',
  K_LEAGUE_2: '4822',
} as const;

// Known team IDs for reference (based on successful team integration)
export const KNOWN_TEAM_IDS = {
  DAEGU_FC: '138107',
  GANGWON_FC: '138108',
  FC_SEOUL: '138115',
  ULSAN_HD: '138117',
  POHANG_STEELERS: '138112',
  JEJU_SK: '139078',
  DAEJEON_HANA_CITIZEN: '139785',
} as const;