// src/lib/mappers/thesportsdb-mappers.ts

import type { Standing, Match } from '@/types/domain';

// This interface is based on the structure from TheSportsDB API
// and is co-located here for mapping purposes.
export interface TheSportsDBStanding {
  idStanding: string;
  intRank: string;
  idTeam: string;
  strTeam: string;
  strBadge: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strForm: string;
  strDescription: string;
  intPlayed: string;
  intWin: string;
  intLoss: string;
  intDraw: string;
  intGoalsFor: string;
  intGoalsAgainst: string;
  intGoalDifference: string;
  intPoints: string;
  dateUpdated?: string;
}

/**
 * Maps a raw standing object from TheSportsDB API to our standardized domain model.
 * This acts as an Anti-Corruption Layer (ACL) to protect our application
 * from changes in the external API schema.
 *
 * @param rawStanding The raw standing object from TheSportsDB.
 * @returns A standardized `Standing` object.
 */
export function mapTheSportsDBStandingToDomain(rawStanding: TheSportsDBStanding): Standing {
  const safeParseInt = (value: string | undefined | null, defaultValue = 0): number => {
    if (value === undefined || value === null || value.trim() === '') {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  return {
    leagueId: rawStanding.idLeague,
    teamId: rawStanding.idTeam,
    season: rawStanding.strSeason || new Date().getFullYear().toString(),
    rank: safeParseInt(rawStanding.intRank),
    teamName: rawStanding.strTeam,
    teamBadgeUrl: rawStanding.strBadge,
    gamesPlayed: safeParseInt(rawStanding.intPlayed),
    wins: safeParseInt(rawStanding.intWin),
    draws: safeParseInt(rawStanding.intDraw),
    losses: safeParseInt(rawStanding.intLoss),
    points: safeParseInt(rawStanding.intPoints),
    goalsFor: safeParseInt(rawStanding.intGoalsFor),
    goalsAgainst: safeParseInt(rawStanding.intGoalsAgainst),
    goalDifference: safeParseInt(rawStanding.intGoalDifference),
    form: rawStanding.strForm || undefined,
    description: rawStanding.strDescription || undefined,
    lastUpdated: rawStanding.dateUpdated || new Date().toISOString(),
  };
}

// --- Event / Match Mapping ---

// This interface is based on the structure from TheSportsDB eventsseason.php API
export interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  idLeague: string;
  strSeason: string;
  intRound?: string;
  dateEvent: string;
  strTime?: string;
  strStatus?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  intHomeScore?: string;
  intAwayScore?: string;
  strVenue?: string;
}

/**
 * Maps a raw event object from TheSportsDB API to our standardized `Match` domain model.
 * @param rawEvent The raw event object from TheSportsDB.
 * @returns A standardized `Match` object.
 */
export function mapTheSportsDBEventToDomain(rawEvent: TheSportsDBEvent): Match {
  const safeParseInt = (value: string | undefined | null): number | undefined => {
    if (value === undefined || value === null || value.trim() === '') {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const toDomainStatus = (status: string | undefined): Match['status'] => {
    switch (status) {
      case 'Match Finished':
        return 'FINISHED';
      case 'Not Started':
      case 'Time To Be Defined':
        return 'SCHEDULED';
      case 'Postponed':
        return 'POSTPONED';
      case 'Cancelled':
        return 'CANCELED';
      case 'In Play': // Hypothetical, but good to handle
        return 'IN_PLAY';
      default:
        return 'UNKNOWN';
    }
  };
  
  // TheSportsDB often provides just a date and a separate time.
  // We combine them into a single ISO 8601 string.
  const createISOString = (date: string, time: string | undefined): string => {
    if (!date) return new Date().toISOString(); // Fallback
    const timePart = time || '00:00:00';
    // Assume UTC if no timezone info is provided.
    // The 'Z' is crucial for creating a correct UTC date.
    return `${date}T${timePart}Z`;
  };

  return {
    id: rawEvent.idEvent,
    leagueId: rawEvent.idLeague,
    season: rawEvent.strSeason,
    round: rawEvent.intRound || undefined,
    date: createISOString(rawEvent.dateEvent, rawEvent.strTime),
    status: toDomainStatus(rawEvent.strStatus),
    homeTeamId: rawEvent.idHomeTeam || '0',
    awayTeamId: rawEvent.idAwayTeam || '0',
    homeScore: safeParseInt(rawEvent.intHomeScore),
    awayScore: safeParseInt(rawEvent.intAwayScore),
    venueName: rawEvent.strVenue || undefined,
        sourceIds: {
          thesportsdb: rawEvent.idEvent,
        },
      };
    }
    
    // --- Team Mapping ---
    
    // This interface is based on the structure from TheSportsDB API
    export interface TheSportsDBTeam {
      idTeam: string;
      strTeam: string;
      strBadge?: string;
      // Add other fields as needed for mapping
    }
    
    /**
     * Maps a raw team object from TheSportsDB API to our standardized `Team` domain model.
     * @param rawTeam The raw team object from TheSportsDB.
     * @returns A standardized `Team` object.
     */
    export function mapTheSportsDBTeamToDomain(rawTeam: TheSportsDBTeam): Team {
      return {
        id: rawTeam.idTeam,
        name: rawTeam.strTeam,
        badgeUrl: rawTeam.strBadge || undefined,
        sourceIds: {
          thesportsdb: rawTeam.idTeam,
        },
      };
    }
    