import { describe, expect, it } from 'vitest';
import {
  mapTheSportsDBStandingToDomain,
  type TheSportsDBStanding,
} from '@/lib/mappers/thesportsdb-mappers';

function standing(overrides: Partial<TheSportsDBStanding> = {}): TheSportsDBStanding {
  return {
    idStanding: 'standing-1',
    intRank: '1',
    idTeam: 'team-1',
    strTeam: 'Test FC',
    strBadge: 'https://example.com/badge.png',
    idLeague: '4689',
    strLeague: 'K League 1',
    strSeason: '2026',
    strForm: 'WDLDW',
    strDescription: '',
    intPlayed: '10',
    intWin: '5',
    intDraw: '3',
    intLoss: '2',
    intPoints: '18',
    intGoalsFor: '15',
    intGoalsAgainst: '9',
    intGoalDifference: '6',
    dateUpdated: '2026-11-18T00:00:00Z',
    ...overrides,
  };
}

describe('mapTheSportsDBStandingToDomain', () => {
  it('maps missing, blank, and non-numeric collected statistics to null while rank remains 0', () => {
    const result = mapTheSportsDBStandingToDomain(standing({
      intRank: '',
      intPlayed: '',
      intWin: 'not-a-number',
      intDraw: '   ',
      intLoss: undefined as unknown as string,
      intPoints: 'NaN',
      intGoalsFor: '',
      intGoalsAgainst: 'unknown',
      intGoalDifference: '',
      dateUpdated: undefined,
    }));

    expect(result).toMatchObject({
      rank: 0,
      gamesPlayed: null,
      wins: null,
      draws: null,
      losses: null,
      points: null,
      goalsFor: null,
      goalsAgainst: null,
      goalDifference: null,
      lastUpdated: null,
    });
  });

  it('preserves genuine zero values and a supplied source update time', () => {
    const result = mapTheSportsDBStandingToDomain(standing({
      intRank: '0',
      intPlayed: '0',
      intWin: '0',
      intDraw: '0',
      intLoss: '0',
      intPoints: '0',
      intGoalsFor: '0',
      intGoalsAgainst: '0',
      intGoalDifference: '0',
    }));

    expect(result).toMatchObject({
      rank: 0,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      lastUpdated: '2026-11-18T00:00:00Z',
    });
  });
});
