// src/types/domain.ts

/**
 * Represents a league within the application.
 * This is a standardized, source-agnostic model.
 */
export interface League {
  id: string; // Our internal ID
  name: string;
  nameKorean?: string;
  logoUrl?: string;
  country?: string;
  season: string;
  tier?: number;
  sourceIds: {
    thesportsdb?: string;
    highlightly?: string;
    kleague?: string;
  };
}

/**
 * Represents a team within the application.
 * This is a standardized, source-agnostic model.
 */
export interface Team {
  id: string; // Our internal ID
  name: string;
  nameKorean?: string;
  badgeUrl?: string;
  sourceIds: {
    thesportsdb?: string;
    highlightly?: string;
    kleague?: string;
  };
}

/**
 * Represents a single row in a league's standings table.
 * This is a standardized, source-agnostic model.
 */
export interface Standing {
  leagueId: string;
  teamId: string;
  season: string;

  rank: number;
  teamName: string; // Denormalized for convenience
  teamBadgeUrl?: string; // Denormalized for convenience
  
  // null = 수집되지 않은 값 (0 과 구분)
  gamesPlayed: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;

  points: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;

  form?: string; // e.g., "WWL-D"
  description?: string;

  lastUpdated: string | null; // 원천 갱신 시각 (ISO 8601), 없으면 null
}

/**
 * Represents a single match or event.
 * This is a standardized, source-agnostic model.
 */
export interface Match {
  id: string; // Internal or source-specific event ID
  leagueId: string;
  season: string;
  round?: string;
  
  date: string; // ISO 8601 date string
  status: 'FINISHED' | 'SCHEDULED' | 'POSTPONED' | 'IN_PLAY' | 'LIVE' | 'CANCELED' | 'UNKNOWN' | '1H' | '2H' | 'HT' | 'ET' | 'BT' | 'P' | 'SUSP' | 'INT' | 'FT' | 'AET' | 'PEN';
  
  homeTeamId: string;
  awayTeamId: string;
  
  homeScore?: number;
  awayScore?: number;
  
  venueName?: string;
  
  sourceIds: {
    thesportsdb?: string;
    highlightly?: string;
    kleague?: string;
  };
}
