// TheSportsDB API Integration - Frontend Types & Functions
import { supabase } from "@/lib/supabaseClient";

// ========================================
// TheSportsDB Native Types (No Transformation)
// ========================================

export interface TheSportsDBLeague {
  idLeague: string;
  strLeague: string;
  strLeagueAlternate?: string;
  strSport?: string;
  strCountry?: string;
  strCurrentSeason?: string;
  intFormedYear?: string;
  dateFirstEvent?: string;
  strGender?: string;
  strWebsite?: string;
  intDivision?: string;
  idCup?: string;
  
  // External API IDs
  idSoccerXML?: string;
  idAPIfootball?: string;
  highlightly_id?: number;
  
  // Social Media
  strFacebook?: string;
  strInstagram?: string;
  strTwitter?: string;
  strYoutube?: string;
  strRSS?: string;
  
  // Descriptions
  strDescriptionEN?: string;
  strDescriptionDE?: string;
  strDescriptionFR?: string;
  strDescriptionIT?: string;
  strDescriptionCN?: string;
  strDescriptionJP?: string;
  strDescriptionRU?: string;
  strDescriptionES?: string;
  strDescriptionPT?: string;
  strDescriptionSE?: string;
  strDescriptionNL?: string;
  strDescriptionHU?: string;
  strDescriptionNO?: string;
  strDescriptionPL?: string;
  strDescriptionIL?: string;
  
  // Media Assets
  strBadge?: string;
  strLogo?: string;
  strBanner?: string;
  strPoster?: string;
  strTrophy?: string;
  strFanart1?: string;
  strFanart2?: string;
  strFanart3?: string;
  strFanart4?: string;
  
  // Other
  strTvRights?: string;
  strNaming?: string;
  strComplete?: string;
  strLocked?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface TheSportsDBTeam {
  idTeam: string;
  strTeam: string;
  strTeamAlternate?: string;
  strTeamShort?: string;
  intFormedYear?: string;
  strSport?: string;
  strCountry?: string;
  
  // League Associations
  strLeague?: string;
  idLeague?: string;
  strLeague2?: string;
  idLeague2?: string;
  strLeague3?: string;
  idLeague3?: string;
  strLeague4?: string;
  idLeague4?: string;
  
  // External API IDs
  idESPN?: string;
  idAPIfootball?: string;
  intLoved?: string;
  highlightly_id?: number;
  
  // Colors
  strColour1?: string;
  strColour2?: string;
  strColour3?: string;
  strColour4?: string;
  strColour5?: string;
  strColour6?: string;
  
  // Media Assets
  strBadge?: string;
  strLogo?: string;
  strBanner?: string;
  strEquipment?: string;
  strFanart1?: string;
  strFanart2?: string;
  strFanart3?: string;
  strFanart4?: string;
  
  // Stadium
  strStadium?: string;
  strStadiumThumb?: string;
  strStadiumDescription?: string;
  strStadiumLocation?: string;
  intStadiumCapacity?: string;
  
  // Descriptions
  strDescriptionEN?: string;
  strDescriptionDE?: string;
  strDescriptionFR?: string;
  strDescriptionIT?: string;
  strDescriptionCN?: string;
  strDescriptionJP?: string;
  strDescriptionRU?: string;
  strDescriptionES?: string;
  strDescriptionPT?: string;
  strDescriptionSE?: string;
  strDescriptionNL?: string;
  strDescriptionHU?: string;
  strDescriptionNO?: string;
  strDescriptionPL?: string;
  strDescriptionIL?: string;
  
  // Social Media
  strWebsite?: string;
  strFacebook?: string;
  strTwitter?: string;
  strInstagram?: string;
  strYoutube?: string;
  strRSS?: string;
  
  // Other
  strGender?: string;
  strKeywords?: string;
  strLocked?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface TheSportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strPlayerAlternate?: string;
  strTeam?: string;
  idTeam?: string;
  strSport?: string;
  strPosition?: string;
  strNumber?: string;
  
  // Personal Information
  dateBorn?: string;
  strBirthLocation?: string;
  strNationality?: string;
  strGender?: string;
  strHeight?: string;
  strWeight?: string;
  strStatus?: string;
  
  // Career Information
  dateSigned?: string;
  strSigning?: string;
  strWage?: string;
  strOutfitter?: string;
  strKit?: string;
  strAgent?: string;
  
  // External API IDs
  idAPIfootball?: string;
  idPlayerManager?: string;
  strLocked?: string;
  
  // Media Assets
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
  strBanner?: string;
  strFanart1?: string;
  strFanart2?: string;
  strFanart3?: string;
  strFanart4?: string;
  
  // Descriptions
  strDescriptionEN?: string;
  strDescriptionDE?: string;
  strDescriptionFR?: string;
  strDescriptionIT?: string;
  strDescriptionCN?: string;
  strDescriptionJP?: string;
  strDescriptionRU?: string;
  strDescriptionES?: string;
  strDescriptionPT?: string;
  strDescriptionSE?: string;
  strDescriptionNL?: string;
  strDescriptionHU?: string;
  strDescriptionNO?: string;
  strDescriptionPL?: string;
  strDescriptionIL?: string;
  
  // Social Media
  strWebsite?: string;
  strFacebook?: string;
  strTwitter?: string;
  strInstagram?: string;
  strYoutube?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  strEventAlternate?: string;
  strSport?: string;
  idLeague?: string;
  strLeague?: string;
  strSeason?: string;
  
  // Teams
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  
  // Scores
  intHomeScore?: string;
  intAwayScore?: string;
  intHomeScoreET?: string;
  intAwayScoreET?: string;
  intHomeScorePen?: string;
  intAwayScorePen?: string;
  
  // Date and Time
  dateEvent?: string;
  dateEventLocal?: string;
  strTime?: string;
  strTimeLocal?: string;
  strTimestamp?: string;
  
  // Match Information
  intRound?: string;
  strResult?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strPoster?: string;
  strStatus?: string;
  strPostponed?: string;
  
  // External API IDs
  idAPIfootball?: string;
  strLocked?: string;
  
  // Media Assets
  strThumb?: string;
  strBanner?: string;
  strMap?: string;
  strTweet1?: string;
  strTweet2?: string;
  strTweet3?: string;
  strVideo?: string;
  
  // Highlights
  highlightly_id?: number;
  strHighlights?: string;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface TheSportsDBScheduleResponse {
  schedule: TheSportsDBEvent[];
}

// Our normalized fixture type for the application
export interface TheSportsDBFixture {
  id: string;
  event_name: string;
  league_id: string;
  league_name: string;
  home_team: {
    id: string;
    name: string;
    badge_url: string;
  };
  away_team: {
    id: string;
    name: string;
    badge_url: string;
  };
  round: string;
  home_score: number | null;
  away_score: number | null;
  date_utc: string; // ISO timestamp
  date_local: string;
  time_utc: string;
  time_local: string;
  venue: string;
  status: string;
  is_finished: boolean;
  is_upcoming: boolean;
  thumb_url: string;
}

// Utility function to make API calls with proper headers (DEVELOPMENT ONLY)
async function fetchTheSportsDB<T>(endpoint: string): Promise<T> {
  // PRODUCTION FIX: Only use TheSportsDB API in development to avoid CORS/proxy issues
  const isDevelopment = import.meta.env.DEV;
  
  if (!isDevelopment) {
    throw new Error('TheSportsDB API disabled in production to avoid CORS issues');
  }
  
  const API_BASE_URL = 'https://www.thesportsdb.com/api/v2/json';
  const API_KEY = import.meta.env.VITE_THESPORTSDB_API_KEY || '460915';
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? {
        'X-API-KEY': API_KEY,
      } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Transform TheSportsDB event to our normalized format
function transformTheSportsDBEvent(event: TheSportsDBEvent): TheSportsDBFixture {
  const isFinished = event.strStatus === 'Match Finished';
  const isUpcoming = event.strStatus === 'Not Started' || event.strStatus === 'TBD';
  
  return {
    id: event.idEvent || '',
    event_name: event.strEvent || '',
    league_id: event.idLeague || '',
    league_name: event.strLeague || '',
    home_team: {
      id: event.idHomeTeam || '',
      name: event.strHomeTeam || '',
      badge_url: '', // TheSportsDB Event에는 팀 배지가 없음
    },
    away_team: {
      id: event.idAwayTeam || '',
      name: event.strAwayTeam || '',
      badge_url: '', // TheSportsDB Event에는 팀 배지가 없음
    },
    round: event.intRound || '',
    home_score: event.intHomeScore ? parseInt(event.intHomeScore) : null,
    away_score: event.intAwayScore ? parseInt(event.intAwayScore) : null,
    date_utc: event.strTimestamp || '',
    date_local: event.dateEventLocal || '',
    time_utc: event.strTime || '',
    time_local: event.strTimeLocal || '',
    venue: event.strVenue || '',
    status: event.strStatus || '',
    is_finished: isFinished,
    is_upcoming: isUpcoming,
    thumb_url: event.strThumb || '',
  };
}

// API Functions

/**
 * Fetch upcoming fixtures for a specific league
 */
export async function fetchLeagueUpcomingFixtures(leagueId: string): Promise<TheSportsDBFixture[]> {
  try {
    const response = await fetchTheSportsDB<TheSportsDBScheduleResponse>(
      `/schedule/next/league/${leagueId}`
    );
    
    if (!response || !response.schedule || !Array.isArray(response.schedule)) {
      console.warn(`No upcoming fixtures data for league ${leagueId}`);
      return [];
    }
    
    return response.schedule.map(transformTheSportsDBEvent);
  } catch (error) {
    console.error('Error fetching league upcoming fixtures:', error);
    return [];
  }
}

/**
 * Fetch previous/completed fixtures for a specific league
 */
export async function fetchLeaguePreviousFixtures(leagueId: string): Promise<TheSportsDBFixture[]> {
  try {
    const response = await fetchTheSportsDB<TheSportsDBScheduleResponse>(
      `/schedule/previous/league/${leagueId}`
    );
    
    if (!response || !response.schedule || !Array.isArray(response.schedule)) {
      console.warn(`No previous fixtures data for league ${leagueId}`);
      return [];
    }
    
    return response.schedule.map(transformTheSportsDBEvent);
  } catch (error) {
    console.error('Error fetching league previous fixtures:', error);
    return [];
  }
}

/**
 * Fetch upcoming fixtures for a specific team
 */
export async function fetchTeamUpcomingFixtures(teamId: string): Promise<TheSportsDBFixture[]> {
  try {
    const response = await fetchTheSportsDB<TheSportsDBScheduleResponse>(
      `/schedule/next/team/${teamId}`
    );
    
    if (!response || !response.schedule || !Array.isArray(response.schedule)) {
      console.warn(`No upcoming fixtures data for team ${teamId}`);
      return [];
    }
    
    return response.schedule.map(transformTheSportsDBEvent);
  } catch (error) {
    console.error('Error fetching team upcoming fixtures:', error);
    return [];
  }
}

/**
 * Fetch previous/completed fixtures for a specific team
 */
export async function fetchTeamPreviousFixtures(teamId: string): Promise<TheSportsDBFixture[]> {
  try {
    const response = await fetchTheSportsDB<TheSportsDBScheduleResponse>(
      `/schedule/previous/team/${teamId}`
    );
    
    if (!response || !response.schedule || !Array.isArray(response.schedule)) {
      console.warn(`No previous fixtures data for team ${teamId}`);
      return [];
    }
    
    return response.schedule.map(transformTheSportsDBEvent);
  } catch (error) {
    console.error('Error fetching team previous fixtures:', error);
    return [];
  }
}

// Convenience functions for K League

/**
 * Fetch upcoming fixtures for K League 1 (League ID: 4689)
 */
export async function fetchKLeague1UpcomingFixtures(): Promise<TheSportsDBFixture[]> {
  return fetchLeagueUpcomingFixtures('4689');
}

/**
 * Fetch previous fixtures for K League 1 (League ID: 4689)
 */
export async function fetchKLeague1PreviousFixtures(): Promise<TheSportsDBFixture[]> {
  return fetchLeaguePreviousFixtures('4689');
}

/**
 * Fetch upcoming fixtures for K League 2 (League ID: 4822)
 */
export async function fetchKLeague2UpcomingFixtures(): Promise<TheSportsDBFixture[]> {
  return fetchLeagueUpcomingFixtures('4822');
}

/**
 * Fetch previous fixtures for K League 2 (League ID: 4822)
 */
export async function fetchKLeague2PreviousFixtures(): Promise<TheSportsDBFixture[]> {
  return fetchLeaguePreviousFixtures('4822');
}

// Combined function to get both upcoming and recent fixtures for a league
export async function fetchLeagueFixtures(leagueId: string): Promise<{
  upcoming: TheSportsDBFixture[];
  recent: TheSportsDBFixture[];
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
  upcoming: TheSportsDBFixture[];
  recent: TheSportsDBFixture[];
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