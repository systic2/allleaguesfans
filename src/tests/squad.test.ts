import { describe, expect, it } from 'vitest';
import type { TeamPlayer } from '@/lib/api';
import { filterSquad, sortSquad, squadAsOf, squadPlayers } from '@/lib/squad';

function makePlayer(id: string, overrides: Partial<TeamPlayer> = {}): TeamPlayer {
  return {
    idPlayer: id,
    strPlayer: id,
    strTeam: 'Test FC',
    idTeam: 'team-1',
    strPosition: 'Forward',
    strNumber: '9',
    strNationality: 'South Korea',
    dateBorn: '2000-01-01',
    updatedAt: null,
    goals: null,
    assists: null,
    appearances: null,
    yellow_cards: null,
    red_cards: null,
    ...overrides,
  };
}

describe('squad utilities', () => {
  it('keeps missing values last in both directions and breaks ties by number then name', () => {
    const players = [
      makePlayer('Missing', { strNumber: '1', goals: null }),
      makePlayer('Charlie', { strNumber: '10', goals: 2 }),
      makePlayer('Bravo', { strNumber: '7', goals: 2 }),
      makePlayer('Alpha', { strNumber: '7', goals: 2 }),
      makePlayer('High', { strNumber: '99', goals: 5 }),
    ];

    expect(sortSquad(players, 'goals', 'asc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Alpha', 'Bravo', 'Charlie', 'High', 'Missing',
    ]);
    expect(sortSquad(players, 'goals', 'desc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'High', 'Alpha', 'Bravo', 'Charlie', 'Missing',
    ]);
  });

  it('treats null and non-numeric jersey numbers as missing in either direction', () => {
    const players = [
      makePlayer('No number', { strNumber: null }),
      makePlayer('Text number', { strNumber: '10A' }),
      makePlayer('Ten', { strNumber: '10' }),
      makePlayer('Two', { strNumber: '2' }),
    ];

    expect(sortSquad(players, 'number', 'asc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Two', 'Ten', 'No number', 'Text number',
    ]);
    expect(sortSquad(players, 'number', 'desc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Ten', 'Two', 'No number', 'Text number',
    ]);
  });

  it('sorts age deterministically when today is supplied', () => {
    const players = [
      makePlayer('Older', { dateBorn: '1990-12-01' }),
      makePlayer('Younger', { dateBorn: '2000-01-01' }),
      makePlayer('Unknown', { dateBorn: null }),
    ];

    expect(sortSquad(players, 'age', 'asc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Younger', 'Older', 'Unknown',
    ]);
  });

  it('sorts grouped positions first in either direction and keeps unknown or missing positions last', () => {
    const players = [
      makePlayer('Utility', { strPosition: 'Utility' }),
      makePlayer('Forward', { strPosition: 'Centre-Forward' }),
      makePlayer('No position', { strPosition: null }),
      makePlayer('Keeper', { strPosition: 'Goalkeeper' }),
      makePlayer('Empty position', { strPosition: '' }),
      makePlayer('Midfielder', { strPosition: 'Central Midfield' }),
      makePlayer('Defender', { strPosition: 'Centre-Back' }),
    ];

    expect(sortSquad(players, 'position', 'asc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Keeper', 'Defender', 'Midfielder', 'Forward', 'Utility', 'Empty position', 'No position',
    ]);
    expect(sortSquad(players, 'position', 'desc', '2026-11-18').map((p) => p.strPlayer)).toEqual([
      'Forward', 'Midfielder', 'Defender', 'Keeper', 'Utility', 'Empty position', 'No position',
    ]);
  });

  it('filters recognized positions into GK, DF, MF, and FW groups', () => {
    const players = [
      makePlayer('Keeper', { strPosition: 'Goalkeeper' }),
      makePlayer('Back', { strPosition: 'Centre-Back' }),
      makePlayer('Mid', { strPosition: 'Central Midfield' }),
      makePlayer('Forward', { strPosition: 'Centre-Forward' }),
      makePlayer('Unknown', { strPosition: 'Utility' }),
    ];

    expect(filterSquad(players, 'all')).toEqual(players);
    expect(filterSquad(players, 'GK').map((p) => p.strPlayer)).toEqual(['Keeper']);
    expect(filterSquad(players, 'DF').map((p) => p.strPlayer)).toEqual(['Back']);
    expect(filterSquad(players, 'MF').map((p) => p.strPlayer)).toEqual(['Mid']);
    expect(filterSquad(players, 'FW').map((p) => p.strPlayer)).toEqual(['Forward']);
  });

  it('uses the latest valid update timestamp and converts it to a KST date', () => {
    const players = [
      makePlayer('Earlier', { updatedAt: '2026-01-01T14:30:00Z' }),
      makePlayer('Latest', { updatedAt: '2026-01-01T15:30:00Z' }),
      makePlayer('Invalid', { updatedAt: 'not-a-date' }),
    ];

    expect(squadAsOf(players)).toBe('2026-01-02');
    expect(squadAsOf([makePlayer('No date')])).toBeNull();
  });

  it('removes staff positions while retaining players and unknown positions', () => {
    const players = [
      makePlayer('Player', { strPosition: 'Forward' }),
      makePlayer('Manager', { strPosition: 'Manager' }),
      makePlayer('Coach', { strPosition: 'Goalkeeping Coach' }),
      makePlayer('Utility', { strPosition: 'Utility' }),
    ];

    expect(squadPlayers(players).map((p) => p.strPlayer)).toEqual(['Player', 'Utility']);
  });

  it('drops timestamped rows more than 60 seconds older than the newest snapshot', () => {
    const players = [
      makePlayer('Newest', { updatedAt: '2026-11-18T12:00:00.000Z' }),
      makePlayer('Exactly 60s old', { updatedAt: '2026-11-18T11:59:00.000Z' }),
      makePlayer('60s and 1ms old', { updatedAt: '2026-11-18T11:58:59.999Z' }),
      makePlayer('No timestamp', { updatedAt: null }),
      makePlayer('Invalid timestamp', { updatedAt: 'not-a-date' }),
    ];

    expect(squadPlayers(players).map((p) => p.strPlayer)).toEqual([
      'Newest', 'Exactly 60s old', 'No timestamp', 'Invalid timestamp',
    ]);
  });

  it('keeps every non-staff row when the list has no valid timestamp', () => {
    const players = [
      makePlayer('No timestamp', { updatedAt: null }),
      makePlayer('Invalid timestamp', { updatedAt: 'not-a-date' }),
    ];

    expect(squadPlayers(players)).toEqual(players);
  });
});
