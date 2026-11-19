import { describe, expect, it } from 'vitest';
import {
  KLEAGUE_TEAM_TO_THESPORTSDB,
  matchKLeaguePlayers,
  mergeRankings,
  nameTokens,
  parseRankingResponse,
  planLinkChanges,
  planStaleDeletion,
  type KLeagueRankRow,
  type RosterPlayer,
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

  it('keeps nullable ranking fields null only when neither list supplies a value', () => {
    const goalRanking = rankRow({
      gameQty: null,
      warnQty: null,
      exitQty: null,
    });
    const assistRanking = rankRow({
      gameQty: 0,
      warnQty: 2,
      exitQty: null,
    });

    const [result] = mergeRankings([[goalRanking], [assistRanking]], 'league-1', '2026');

    expect(result).toMatchObject({
      appearances: 0,
      yellow_cards: 2,
      red_cards: null,
    });
  });

  it('maps nullable ranking fields to null for a player seen in only one list', () => {
    const [result] = mergeRankings([[
      rankRow({ gameQty: null, warnQty: null, exitQty: null }),
    ]], 'league-1', '2026');

    expect(result).toMatchObject({
      appearances: null,
      yellow_cards: null,
      red_cards: null,
    });
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

describe('nameTokens', () => {
  it('normalizes accents, case, hyphens, and apostrophes', () => {
    expect(nameTokens("DÁE-WON O’NEILL")).toEqual(['daewon', 'oneill']);
  });

  it('folds Latin letters that Unicode decomposition does not handle', () => {
    expect(nameTokens('Đorđe Łukasz Søren')).toEqual(['dorde', 'lukasz', 'soren']);
  });

  it('accepts null names as an empty token list', () => {
    expect(nameTokens(null)).toEqual([]);
  });
});

describe('matchKLeaguePlayers', () => {
  const ulsanId = KLEAGUE_TEAM_TO_THESPORTSDB.K01;
  const busanId = KLEAGUE_TEAM_TO_THESPORTSDB.K06;
  const rosterPlayer = (
    idPlayer: string,
    strPlayer: string | null,
    overrides: Partial<RosterPlayer> = {},
  ): RosterPlayer => ({
    idPlayer,
    strPlayer,
    idTeam: ulsanId,
    strPosition: 'Forward',
    updatedAt: null,
    ...overrides,
  });

  const emptyResult = {
    links: [],
    ambiguousKLeagueIds: [],
    ambiguousPlayerIds: [],
  };

  it('links an exact name match on the mapped team', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Player One')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it('normalizes hyphens, case, and accents when matching', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Dae-Won Kím', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'DAEWON KIM')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it('folds đ, ł, and ø when matching', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Đorđe Łukasz Søren', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'DORDE LUKASZ SOREN')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it('links when all tokens from the shorter name occur in the longer name', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Vitor Gabriel', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'VITOR GABRIEL CLAUDINO REGO FERREIRA')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it.each(['Marcão', 'Da Silva', 'Silva Silva'])('does not link unsafe name %s', (name) => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name, teamId: 'K01' })],
      [rosterPlayer('sports-1', name.toUpperCase())],
    )).toEqual(emptyResult);
  });

  it('ignores roster rows with null names', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' })],
      [rosterPlayer('unknown', null), rosterPlayer('sports-1', 'Player One')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it('does not link a matching name from a different team', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Player One', { idTeam: busanId })],
    )).toEqual(emptyResult);
  });

  it('reports the K League id when two current roster players match', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Vitor Gabriel', teamId: 'K01' })],
      [
        rosterPlayer('sports-1', 'Vitor Gabriel Ferreira'),
        rosterPlayer('sports-2', 'Vitor Gabriel Silva'),
      ],
    )).toEqual({
      links: [],
      ambiguousKLeagueIds: ['k1'],
      ambiguousPlayerIds: [],
    });
  });

  it('reports the roster id when two K League ids claim one player', () => {
    expect(matchKLeaguePlayers(
      [
        rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' }),
        rankRow({ playerId: 'k2', name: 'Player One', teamId: 'K01' }),
      ],
      [rosterPlayer('sports-1', 'Player One')],
    )).toEqual({
      links: [],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: ['sports-1'],
    });
  });

  it('ignores staff and roster rows outside the latest 60-second snapshot', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' })],
      [
        rosterPlayer('sports-current', 'Player One', { updatedAt: '2026-11-18T12:00:00.000Z' }),
        rosterPlayer('staff', 'Player One', {
          strPosition: 'Manager',
          updatedAt: '2026-11-18T12:00:00.000Z',
        }),
        rosterPlayer('stale', 'Player One', { updatedAt: '2026-11-18T11:58:59.999Z' }),
      ],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-current' }],
    });
  });

  it('handles duplicate rows for one K League id only once', () => {
    expect(matchKLeaguePlayers(
      [
        rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' }),
        rankRow({ playerId: 'k1', name: 'Player One', teamId: 'K01' }),
      ],
      [rosterPlayer('sports-1', 'Player One')],
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
    });
  });

  it('does not link an unmapped K League team code', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Player One', teamId: 'UNKNOWN' })],
      [rosterPlayer('sports-1', 'Player One')],
    )).toEqual(emptyResult);
  });
});

describe('planLinkChanges', () => {
  it('inserts a new unclaimed link', () => {
    expect(planLinkChanges({
      links: [{ kleaguePlayerId: 'k-new', idPlayer: 'p-new' }],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
    }, [])).toEqual({
      insert: [{ kleaguePlayerId: 'k-new', idPlayer: 'p-new' }],
      removeKLeagueIds: [],
      conflicts: [],
    });
  });

  it('removes existing links touching either kind of ambiguous id', () => {
    expect(planLinkChanges({
      links: [],
      ambiguousKLeagueIds: ['k-ambiguous'],
      ambiguousPlayerIds: ['p-ambiguous'],
    }, [
      { kleaguePlayerId: 'k-ambiguous', idPlayer: 'p-1' },
      { kleaguePlayerId: 'k-2', idPlayer: 'p-ambiguous' },
      { kleaguePlayerId: 'k-kept', idPlayer: 'p-kept' },
    ])).toEqual({
      insert: [],
      removeKLeagueIds: ['k-ambiguous', 'k-2'],
      conflicts: [],
    });
  });

  it('skips an identical existing link', () => {
    const link = { kleaguePlayerId: 'k-1', idPlayer: 'p-1' };
    expect(planLinkChanges({
      links: [link],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
    }, [link])).toEqual({ insert: [], removeKLeagueIds: [], conflicts: [] });
  });

  it('reports a conflict instead of overwriting an existing K League id', () => {
    const proposed = { kleaguePlayerId: 'k-1', idPlayer: 'p-new' };
    expect(planLinkChanges({
      links: [proposed],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
    }, [{ kleaguePlayerId: 'k-1', idPlayer: 'p-old' }])).toEqual({
      insert: [],
      removeKLeagueIds: [],
      conflicts: [proposed],
    });
  });

  it('reports a conflict when another K League id already claims the roster player', () => {
    const proposed = { kleaguePlayerId: 'k-new', idPlayer: 'p-1' };
    expect(planLinkChanges({
      links: [proposed],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
    }, [{ kleaguePlayerId: 'k-existing', idPlayer: 'p-1' }])).toEqual({
      insert: [],
      removeKLeagueIds: [],
      conflicts: [proposed],
    });
  });
});
