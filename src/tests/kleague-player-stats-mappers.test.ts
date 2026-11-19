import { describe, expect, it } from 'vitest';
import {
  BIRTH_DATE_RETRY_MS,
  KLEAGUE_TEAM_TO_THESPORTSDB,
  birthDateKey,
  matchKLeaguePlayers,
  mergeRankings,
  nameTokens,
  parseKLeagueBirthDate,
  parseRankingResponse,
  planBirthDateFetch,
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

describe('parseKLeagueBirthDate', () => {
  const now = new Date('2026-11-20T00:00:00Z');

  it.each([
    ['slash', '<th>생년월일</th><td>2001/02/03</td>'],
    ['dot', '<th>생년월일</th><td>2001.02.03</td>'],
    ['hyphen', '<th>생년월일</th><td>2001-02-03</td>'],
    ['surrounding whitespace', '<th>생년월일</th>\n  <td>  2001/02/03  </td>'],
  ])('parses a valid date with %s', (_label, html) => {
    expect(parseKLeagueBirthDate(html, now)).toBe('2001-02-03');
  });

  it('returns undefined when the birth-date header is absent', () => {
    expect(parseKLeagueBirthDate('<th>국적</th><td>대한민국</td>', now)).toBeUndefined();
  });

  it.each([
    ['an empty value', '<th>생년월일</th><td> </td>'],
    ['an unusable value', '<th>생년월일</th><td>unknown</td>'],
    ['an impossible day', '<th>생년월일</th><td>2001/02/30</td>'],
    ['zero date parts', '<th>생년월일</th><td>0000/00/00</td>'],
  ])('returns null for %s', (_label, html) => {
    expect(parseKLeagueBirthDate(html, now)).toBeNull();
  });

  it('applies the exact 14-year age boundary using the supplied clock', () => {
    expect(parseKLeagueBirthDate('<th>생년월일</th><td>2012-11-20</td>', now))
      .toBe('2012-11-20');
    expect(parseKLeagueBirthDate('<th>생년월일</th><td>2012-11-21</td>', now))
      .toBeNull();
  });
});

describe('birthDateKey', () => {
  const now = new Date('2026-11-20T00:00:00Z');

  it.each([
    ['1950-01-01', '1950-01-01'],
    ['2012-11-20', '2012-11-20'],
    ['1991-06-17T00:00:00Z', '1991-06-17'],
    ['1991-06-17T00:00:00+00:00', '1991-06-17'],
    ['1991-06-17 00:00:00', '1991-06-17'],
    ['1991-06-17 12:34:56.789-09:30', '1991-06-17'],
  ])('accepts %s', (value, expected) => {
    expect(birthDateKey(value, now)).toBe(expected);
  });

  it.each([
    '1949-12-31',
    '2012-11-21',
    '2001-02-30',
    '0000-00-00',
    '1991-06-17Tgarbage',
    '1991-06-17garbage',
    '17-06-1991',
    '',
  ])('rejects %s', (value) => {
    expect(birthDateKey(value, now)).toBeNull();
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
    unmatchedKLeagueIds: [],
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
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
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
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
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
      unmatchedKLeagueIds: ['k1'],
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
      unmatchedKLeagueIds: [],
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
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
  });

  it('reports unmatched K League ids once in first-seen order', () => {
    expect(matchKLeaguePlayers(
      [
        rankRow({ playerId: 'matched', name: 'Player One', teamId: 'K01' }),
        rankRow({ playerId: 'missing-2', name: 'Missing Two', teamId: 'K01' }),
        rankRow({ playerId: 'missing-1', name: 'Missing One', teamId: 'K01' }),
        rankRow({ playerId: 'missing-2', name: 'Missing Two', teamId: 'K01' }),
        rankRow({ playerId: 'ambiguous', name: 'Vitor Gabriel', teamId: 'K01' }),
      ],
      [
        rosterPlayer('sports-1', 'Player One'),
        rosterPlayer('sports-2', 'Vitor Gabriel Ferreira'),
        rosterPlayer('sports-3', 'Vitor Gabriel Silva'),
      ],
    )).toEqual({
      links: [{ kleaguePlayerId: 'matched', idPlayer: 'sports-1' }],
      ambiguousKLeagueIds: ['ambiguous'],
      ambiguousPlayerIds: [],
      unmatchedKLeagueIds: ['missing-2', 'missing-1', 'ambiguous'],
    });
  });

  it('links by birth date on the same team with one shared name word', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Jaehyeon GO', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Jae-hyun Go', { dateBorn: '1991-06-17' })],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it.each([
    ['Cheol Woo Park', 'Cheol-Woo Lee'],
    ['Cheol-Woo Lee', 'Cheol Woo Park'],
  ])('accepts a same-team word widened from either name: %s / %s', (rankName, rosterName) => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: rankName, teamId: 'K01' })],
      [rosterPlayer('sports-1', rosterName, { dateBorn: '1991-06-17' })],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it('does not link a same-team nickname with no shared name words', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Marcão', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Marcos Vinicius', { dateBorn: '1991-06-17' })],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
  });

  it('links on another team with two shared words including an adjacent-pair form', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Seon Min Moon', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Seon-Min Moon', { idTeam: busanId, dateBorn: '1992-06-09' })],
      { birthDates: new Map([['k1', '1992-06-09']]) },
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it.each([
    ['Cheolwoo PARK', 'Cheol-Woo Park'],
    ['Gabriel Henrique DE SOUZA DE OLIVEIRA', 'Gabriel de Souza de Oliveira'],
  ])('links a covered name on another team: %s / %s', (rankName, rosterName) => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: rankName, teamId: 'K01' })],
      [rosterPlayer('sports-1', rosterName, { idTeam: busanId, dateBorn: '1991-06-17' })],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }],
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it('does not link on another team with only one shared word', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Young Woo Kim', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Min Jae Kim', { idTeam: busanId, dateBorn: '1996-11-15' })],
      { birthDates: new Map([['k1', '1996-11-15']]) },
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
  });

  it('does not link Kim Min Su to Kim Min Jae on another team', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Kim Min Su', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Kim Min Jae', { idTeam: busanId, dateBorn: '1996-11-15' })],
      { birthDates: new Map([['k1', '1996-11-15']]) },
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
  });

  it('uses only name hits to resolve a name ambiguity and keeps an unresolved id ambiguous', () => {
    expect(matchKLeaguePlayers(
      [
        rankRow({ playerId: 'resolved', name: 'Vitor Gabriel', teamId: 'K01' }),
        rankRow({ playerId: 'unresolved', name: 'Vitor Gabriel', teamId: 'K01' }),
      ],
      [
        rosterPlayer('hit-1', 'Vitor Gabriel Ferreira', { dateBorn: '2000-01-14' }),
        rosterPlayer('hit-2', 'Vitor Gabriel Silva', { dateBorn: '2001-02-15' }),
        rosterPlayer('non-hit', 'Vitor Claudino', { dateBorn: '2000-01-14' }),
      ],
      { birthDates: new Map([
        ['resolved', '2000-01-14'],
        ['unresolved', '1999-09-09'],
      ]) },
    )).toEqual({
      links: [{ kleaguePlayerId: 'resolved', idPlayer: 'hit-1' }],
      ambiguousKLeagueIds: ['unresolved'],
      ambiguousPlayerIds: [],
      unmatchedKLeagueIds: ['resolved', 'unresolved'],
    });
  });

  it('marks two remaining birth-date candidates as ambiguous', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Kim', teamId: 'K01' })],
      [
        rosterPlayer('sports-1', 'Min Kim', { dateBorn: '2000-01-14' }),
        rosterPlayer('sports-2', 'Jae Kim', { dateBorn: '2000-01-14' }),
      ],
      { birthDates: new Map([['k1', '2000-01-14']]) },
    )).toEqual({
      ...emptyResult,
      ambiguousKLeagueIds: ['k1'],
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it('decides birth-date ambiguity before checking a stored owner', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k2', name: 'Kim', teamId: 'K01' })],
      [
        rosterPlayer('p1', 'Min Kim', { dateBorn: '2000-01-14' }),
        rosterPlayer('p2', 'Jae Kim', { dateBorn: '2000-01-14' }),
      ],
      {
        birthDates: new Map([['k2', '2000-01-14']]),
        storedLinks: [{ kleaguePlayerId: 'k1', idPlayer: 'p1' }],
      },
    )).toEqual({
      ...emptyResult,
      ambiguousKLeagueIds: ['k2'],
      unmatchedKLeagueIds: ['k2'],
    });
  });

  it.each([
    ['another id', 'other-id', []],
    ['the same id', 'k1', [{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }]],
  ])('respects a stored link owned by %s', (_label, owner, expectedLinks) => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Jaehyeon GO', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Jae-hyun Go', { dateBorn: '1991-06-17' })],
      {
        birthDates: new Map([['k1', '1991-06-17']]),
        storedLinks: [{ kleaguePlayerId: owner, idPlayer: 'sports-1' }],
      },
    )).toEqual({
      ...emptyResult,
      links: expectedLinks,
      unmatchedKLeagueIds: ['k1'],
    });
  });

  it('stays unlinked across runs instead of alternating around an ambiguous stored link', () => {
    const rows = [
      rankRow({ playerId: 'k1', name: 'Kim', teamId: 'K01' }),
      rankRow({ playerId: 'k2', name: 'Kim', teamId: 'K01' }),
    ];
    const roster = [
      rosterPlayer('p1', 'Min Kim', { dateBorn: '2000-01-14' }),
      rosterPlayer('p2', 'Jae Kim', { dateBorn: '2000-01-14' }),
    ];
    const birthDates = new Map([
      ['k1', '2000-01-14'],
      ['k2', '2000-01-14'],
    ]);
    const storedLinks = [{ kleaguePlayerId: 'k1', idPlayer: 'p1' }];

    const first = matchKLeaguePlayers(rows, roster, { birthDates, storedLinks });
    expect(first).toEqual({
      ...emptyResult,
      ambiguousKLeagueIds: ['k1', 'k2'],
      unmatchedKLeagueIds: ['k1', 'k2'],
    });
    const changes = planLinkChanges(first, storedLinks);
    expect(changes).toEqual({
      insert: [],
      removeKLeagueIds: ['k1'],
      conflicts: [],
    });

    const removed = new Set(changes.removeKLeagueIds);
    const nextStoredLinks = [
      ...storedLinks.filter(link => !removed.has(link.kleaguePlayerId)),
      ...changes.insert,
    ];
    expect(nextStoredLinks).toEqual([]);
    expect(matchKLeaguePlayers(rows, roster, { birthDates, storedLinks: nextStoredLinks }))
      .toEqual(first);
  });

  it('protects a pass-1 name link from the birth-date fallback', () => {
    expect(matchKLeaguePlayers(
      [
        rankRow({ playerId: 'name-id', name: 'Player One', teamId: 'K01' }),
        rankRow({ playerId: 'birth-id', name: 'Player', teamId: 'K01' }),
      ],
      [rosterPlayer('sports-1', 'Player One', { dateBorn: '2001-02-03' })],
      { birthDates: new Map([['birth-id', '2001-02-03']]) },
    )).toEqual({
      ...emptyResult,
      links: [{ kleaguePlayerId: 'name-id', idPlayer: 'sports-1' }],
      unmatchedKLeagueIds: ['birth-id'],
    });
  });

  it('excludes staff and stale snapshots from birth-date candidates', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Kim', teamId: 'K01' })],
      [
        rosterPlayer('current', 'Current Kim', {
          dateBorn: '1999-09-09',
          updatedAt: '2026-11-18T12:00:00.000Z',
        }),
        rosterPlayer('staff', 'Staff Kim', {
          strPosition: 'Manager',
          dateBorn: '1991-06-17',
          updatedAt: '2026-11-18T12:00:00.000Z',
        }),
        rosterPlayer('stale', 'Former Kim', {
          dateBorn: '1991-06-17',
          updatedAt: '2026-11-18T11:58:59.999Z',
        }),
      ],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    )).toEqual({ ...emptyResult, unmatchedKLeagueIds: ['k1'] });
  });

  it('accepts a valid roster birth date with a time suffix', () => {
    expect(matchKLeaguePlayers(
      [rankRow({ playerId: 'k1', name: 'Jaehyeon GO', teamId: 'K01' })],
      [rosterPlayer('sports-1', 'Jae-hyun Go', { dateBorn: '1991-06-17T00:00:00Z' })],
      { birthDates: new Map([['k1', '1991-06-17']]) },
    ).links).toEqual([{ kleaguePlayerId: 'k1', idPlayer: 'sports-1' }]);
  });
});

describe('planBirthDateFetch', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const checkedAt = (ageMs: number) => new Date(now.getTime() - ageMs).toISOString();

  it('fetches missing and retryable ids at the retry boundary, preserving deduped order', () => {
    expect(BIRTH_DATE_RETRY_MS).toBe(sevenDays);
    expect(planBirthDateFetch(
      ['missing', 'under', 'exact', 'invalid-time', 'has-date', 'missing'],
      [
        { kleaguePlayerId: 'under', birthDate: null, checkedAt: checkedAt(sevenDays - 1) },
        { kleaguePlayerId: 'exact', birthDate: null, checkedAt: checkedAt(sevenDays) },
        { kleaguePlayerId: 'invalid-time', birthDate: null, checkedAt: 'not-a-date' },
        { kleaguePlayerId: 'has-date', birthDate: '1991-06-17', checkedAt: checkedAt(sevenDays * 2) },
      ],
      now,
    )).toEqual(['missing', 'exact', 'invalid-time']);
  });
});

describe('planLinkChanges', () => {
  it('inserts a new unclaimed link', () => {
    expect(planLinkChanges({
      links: [{ kleaguePlayerId: 'k-new', idPlayer: 'p-new' }],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
      unmatchedKLeagueIds: [],
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
      unmatchedKLeagueIds: [],
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
      unmatchedKLeagueIds: [],
    }, [link])).toEqual({ insert: [], removeKLeagueIds: [], conflicts: [] });
  });

  it('reports a conflict instead of overwriting an existing K League id', () => {
    const proposed = { kleaguePlayerId: 'k-1', idPlayer: 'p-new' };
    expect(planLinkChanges({
      links: [proposed],
      ambiguousKLeagueIds: [],
      ambiguousPlayerIds: [],
      unmatchedKLeagueIds: [],
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
      unmatchedKLeagueIds: [],
    }, [{ kleaguePlayerId: 'k-existing', idPlayer: 'p-1' }])).toEqual({
      insert: [],
      removeKLeagueIds: [],
      conflicts: [proposed],
    });
  });
});
