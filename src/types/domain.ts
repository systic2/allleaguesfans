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
  
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  
  form?: string; // e.g., "WWL-D"
  description?: string;
  
  lastUpdated: string; // ISO 8601 date string
}
