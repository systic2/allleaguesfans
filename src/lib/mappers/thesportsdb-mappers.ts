// src/lib/mappers/thesportsdb-mappers.ts

import type { Standing } from '@/types/domain';

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
    // We use the source's league and team IDs for now.
    // A more advanced implementation might map these to internal UUIDs.
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
