import { describe, expect, it } from 'vitest';
import {
  KLEAGUE_TEAM_TO_THESPORTSDB,
  mergeRankings,
  parseRankingResponse,
  planStaleDeletion,
  type KLeagueRankRow,
} from '@/lib/mappers/kleague-player-stats-mappers';

const rankRow = (overrides: Partial<KLeagueRankRow> = {}): KLeagueRankRow => ({
  playerId: 'player-1',
  name: 'Player One',
  teamId: 'K01',
  teamName: 'Ulsan',
  goalQty: 3,
  assistQty: 2,
  gameQty: 10,
  warnQty: 1,
  exitQty: 0,
  ...overrides,
});

const responseWith = (list: unknown[]) => ({
  resultCode: '200',
  data: { list },
});

describe('parseRankingResponse', () => {
  it.each([
    {
      recordType: 'GOAL' as const,
      rows: [
        rankRow({ playerId: '1', goalQty: 5, assistQty: 1 }),
        rankRow({ playerId: '2', goalQty: 3, assistQty: 4 }),
      ],
    },
    {
      recordType: 'ASSIST' as const,
      rows: [
        rankRow({ playerId: '1', goalQty: 1, assistQty: 6 }),
        rankRow({ playerId: '2', goalQty: 4, assistQty: 2 }),
      ],
    },
  ])('accepts a valid list sorted for $recordType', ({ recordType, rows }) => {
    expect(parseRankingResponse(responseWith(rows), 2026, 1, recordType)).toEqual(rows);
  });

  it('throws when resultCode is not 200', () => {
    expect(() => parseRankingResponse({ resultCode: '500' }, 2026, 1, 'GOAL')).toThrow(
      /resultCode 500/,
    );
  });

  it.each([
    { resultCode: '200' },
    { resultCode: '200', data: {} },
  ])('throws when data.list is missing', (body) => {
    expect(() => parseRankingResponse(body, 2026, 1, 'GOAL')).toThrow(
      /unexpected response shape/,
    );
  });

  it.each(['playerId', 'name', 'teamId'] as const)('throws when a row is missing %s', (field) => {
    const row = { ...rankRow() };
    delete row[field];

    expect(() => parseRankingResponse(responseWith([row]), 2026, 1, 'GOAL')).toThrow(
      /row missing player\/team fields/,
    );
  });

  it.each(['goalQty', 'assistQty'] as const)('throws when %s is not a number', (field) => {
    const row = { ...rankRow(), [field]: '3' };

    expect(() => parseRankingResponse(responseWith([row]), 2026, 1, 'GOAL')).toThrow(
      /row missing goalQty\/assistQty/,
    );
  });

  it('throws when rows are not sorted by the requested record', () => {
    const rows = [
      rankRow({ playerId: '1', goalQty: 2, assistQty: 8 }),
      rankRow({ playerId: '2', goalQty: 5, assistQty: 1 }),
    ];

    expect(() => parseRankingResponse(responseWith(rows), 2026, 1, 'GOAL')).toThrow(
      /rows are not sorted by goalQty/,
    );
  });
});

describe('mergeRankings', () => {
  it('merges duplicate players, keeps the larger stats, and maps fields', () => {
    const now = '2026-11-13T12:34:56.000Z';
    const goalRanking = rankRow({
      goalQty: 7,
      assistQty: 2,
      gameQty: 10,
      warnQty: 1,
      exitQty: 0,
    });
    const assistRanking = rankRow({
      goalQty: 9,
      assistQty: 6,
      gameQty: 12,
      warnQty: 3,
      exitQty: 1,
    });

    expect(mergeRankings([[goalRanking], [assistRanking]], 'league-1', '2026', now)).toEqual([
      {
        idPlayer: 'player-1',
        strPlayer: 'Player One',
        idTeam: KLEAGUE_TEAM_TO_THESPORTSDB.K01,
        strTeam: 'Ulsan',
        idLeague: 'league-1',
        strSeason: '2026',
        goals: 9,
        assists: 6,
        appearances: 12,
        yellow_cards: 3,
        red_cards: 1,
        last_updated: now,
      },
    ]);
  });

  it('throws for an unmapped team code', () => {
    expect(() => mergeRankings([[rankRow({ teamId: 'UNKNOWN' })]], 'league-1', '2026')).toThrow(
      /Unmapped K League team code UNKNOWN/,
    );
  });
});

describe('planStaleDeletion', () => {
  it('returns ids missing from keep without skipping at exactly 20% stale', () => {
    expect(planStaleDeletion(['1', '2', '3', '4', '5'], ['1', '2', '3', '4'])).toEqual({
      stale: ['5'],
      skip: false,
    });
  });

  it('skips deletion above 20% stale', () => {
    expect(planStaleDeletion(['1', '2', '3', '4', '5'], ['1', '2', '3'])).toEqual({
      stale: ['4', '5'],
      skip: true,
    });
  });

  it('returns no stale ids and does not skip when existing is empty', () => {
    expect(planStaleDeletion([], ['1'])).toEqual({ stale: [], skip: false });
  });
});
