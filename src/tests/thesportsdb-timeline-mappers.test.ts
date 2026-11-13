import { describe, expect, it } from 'vitest';
import {
  aggregateTimelines,
  parseTimelineResponse,
  selectEventsToFetch,
  shouldReplaceStored,
  timelineMatchesScore,
  type FinishedEvent,
  type StoredTimeline,
  type TimelineEntry,
} from '@/lib/mappers/thesportsdb-timeline-mappers';

const entry = (overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  idTimeline: 'timeline-1',
  type: 'Goal',
  detail: 'Normal Goal',
  idPlayer: 'player-1',
  strPlayer: 'Player One',
  idAssist: null,
  strAssist: null,
  idTeam: 'team-1',
  strTeam: 'Team One',
  isHome: true,
  ...overrides,
});

const rawRow = (overrides: Record<string, unknown> = {}) => ({
  idTimeline: 'timeline-1',
  idEvent: 'event-1',
  strTimeline: 'Goal',
  strTimelineDetail: 'Normal Goal',
  strHome: 'Yes',
  idPlayer: 'player-1',
  strPlayer: 'Player One',
  idAssist: 'player-2',
  strAssist: 'Player Two',
  idTeam: 'team-1',
  strTeam: 'Team One',
  ...overrides,
});

describe('parseTimelineResponse', () => {
  it('returns an empty list for TheSportsDB no-data response', () => {
    expect(parseTimelineResponse({ Message: 'No data found' }, 'event-1')).toEqual([]);
  });

  it('keeps goals and cards, filters substitutions and VAR, and normalizes an assist id of 0', () => {
    const result = parseTimelineResponse({
      lookup: [
        rawRow({ idAssist: '0', strAssist: 'Should Be Ignored' }),
        rawRow({
          idTimeline: 'timeline-2',
          strTimeline: 'Card',
          strTimelineDetail: 'Yellow Card',
          strHome: 'No',
          idPlayer: 'player-3',
          strPlayer: 'Player Three',
          idAssist: null,
        }),
        rawRow({ idTimeline: 'timeline-3', strTimeline: 'subst' }),
        rawRow({ idTimeline: 'timeline-4', strTimeline: 'Var' }),
      ],
    }, 'event-1');

    expect(result).toEqual([
      entry(),
      entry({
        idTimeline: 'timeline-2',
        type: 'Card',
        detail: 'Yellow Card',
        idPlayer: 'player-3',
        strPlayer: 'Player Three',
        isHome: false,
      }),
    ]);
  });

  it.each([
    undefined,
    {},
    { Message: 'unexpected' },
    { lookup: {} },
  ])('rejects a malformed top-level response: %j', (body) => {
    expect(() => parseTimelineResponse(body, 'event-1')).toThrow(/unexpected response shape/);
  });

  it('keeps goals without a player id for score matching but excludes them from player aggregation', () => {
    const result = parseTimelineResponse({
      lookup: [
        rawRow({ idPlayer: undefined, strPlayer: '', idAssist: null }),
        rawRow({
          idTimeline: 'timeline-2',
          idPlayer: '0',
          strPlayer: '',
          idAssist: null,
          strHome: 'No',
        }),
      ],
    }, 'event-1');

    expect(result.map(({ idTimeline, idPlayer }) => ({ idTimeline, idPlayer }))).toEqual([
      { idTimeline: 'timeline-1', idPlayer: null },
      { idTimeline: 'timeline-2', idPlayer: null },
    ]);
    expect(timelineMatchesScore(result, 1, 1)).toBe(true);
    expect(aggregateTimelines([
      { eventId: 'event-1', date: '2026-11-01T00:00:00.000Z', entries: result },
    ], 'league-1', '2026-27')).toEqual([]);
  });

  it.each([
    rawRow({ idTimeline: '' }),
    rawRow({ idTeam: '0' }),
    rawRow({ strTimelineDetail: null }),
  ])('rejects a goal or card row missing its id, team, or detail', (row) => {
    expect(() => parseTimelineResponse({ lookup: [row] }, 'event-1')).toThrow(
      /missing id\/team\/detail/,
    );
  });

  it('keeps only the first row for a duplicate timeline id', () => {
    const result = parseTimelineResponse({
      lookup: [
        rawRow(),
        rawRow({ strTimeline: 'Card', strTimelineDetail: 'Red Card' }),
      ],
    }, 'event-1');

    expect(result).toEqual([entry({ idAssist: 'player-2', strAssist: 'Player Two' })]);
  });

  it('rejects rows belonging to a different event, including otherwise filtered row types', () => {
    expect(() => parseTimelineResponse({
      lookup: [rawRow({ idEvent: 'event-2', strTimeline: 'subst' })],
    }, 'event-1')).toThrow(/row for event event-2/);
  });
});

describe('shouldReplaceStored', () => {
  it.each([
    [undefined, { scoreMatches: false, entryCount: 0 }, true],
    [{ scoreMatches: false, entryCount: 4 }, { scoreMatches: true, entryCount: 2 }, true],
    [{ scoreMatches: true, entryCount: 2 }, { scoreMatches: false, entryCount: 4 }, false],
    [{ scoreMatches: true, entryCount: 2 }, { scoreMatches: true, entryCount: 2 }, true],
    [{ scoreMatches: false, entryCount: 2 }, { scoreMatches: false, entryCount: 3 }, true],
    [{ scoreMatches: false, entryCount: 3 }, { scoreMatches: false, entryCount: 2 }, false],
  ] as const)('returns the replacement decision for previous=%j and next=%j', (
    previous,
    next,
    expected,
  ) => {
    expect(shouldReplaceStored(previous, next)).toBe(expected);
  });

  it('keeps a stored 0-0 match with three card entries when the next matching timeline is empty', () => {
    expect(shouldReplaceStored(
      { scoreMatches: true, entryCount: 3 },
      { scoreMatches: true, entryCount: 0 },
    )).toBe(false);
  });
});

describe('timelineMatchesScore', () => {
  it('counts own goals for the benefiting side and excludes missed penalties', () => {
    const entries = [
      entry(),
      entry({ idTimeline: 'timeline-2', detail: 'Own Goal' }),
      entry({ idTimeline: 'timeline-3', detail: 'Missed Penalty' }),
      entry({ idTimeline: 'timeline-4', isHome: false }),
      entry({ idTimeline: 'timeline-5', type: 'Card', detail: 'Yellow Card' }),
    ];

    expect(timelineMatchesScore(entries, 2, 1)).toBe(true);
    expect(timelineMatchesScore(entries, 3, 1)).toBe(false);
  });

  it.each([
    [null, 0],
    [0, null],
    [null, null],
  ] as const)('does not match when a score is null', (homeScore, awayScore) => {
    expect(timelineMatchesScore([], homeScore, awayScore)).toBe(false);
  });
});

describe('selectEventsToFetch', () => {
  it('orders missing events newest first ahead of refreshes and applies the limit', () => {
    const events: FinishedEvent[] = [
      { id: 'refresh-newest', date: '2026-11-12T00:00:00.000Z', homeScore: 1, awayScore: 0 },
      { id: 'missing-old', date: '2026-11-08T00:00:00.000Z', homeScore: 0, awayScore: 0 },
      { id: 'missing-new', date: '2026-11-10T00:00:00.000Z', homeScore: 2, awayScore: 1 },
      { id: 'refresh-old', date: '2026-11-09T00:00:00.000Z', homeScore: 1, awayScore: 1 },
    ];
    const stored = new Map([
      ['refresh-newest', { scoreMatches: true, fetchedAt: '2026-11-12T01:00:00.000Z' }],
      ['refresh-old', { scoreMatches: true, fetchedAt: '2026-11-09T01:00:00.000Z' }],
    ]);

    expect(selectEventsToFetch(events, stored, new Date('2026-11-13T00:00:00.000Z'), 3)).toEqual([
      'missing-new',
      'missing-old',
      'refresh-newest',
    ]);
  });

  it('refreshes inside the 48-hour settle window but not at its exact boundary', () => {
    const events: FinishedEvent[] = [
      { id: 'inside', date: '2026-11-08T00:00:00.000Z', homeScore: 1, awayScore: 0 },
      { id: 'boundary', date: '2026-11-08T00:00:00.000Z', homeScore: 1, awayScore: 0 },
    ];
    const stored = new Map([
      ['inside', { scoreMatches: true, fetchedAt: '2026-11-09T23:59:59.999Z' }],
      ['boundary', { scoreMatches: true, fetchedAt: '2026-11-10T00:00:00.000Z' }],
    ]);

    expect(selectEventsToFetch(events, stored, new Date('2026-11-13T00:00:00.000Z'), 10)).toEqual([
      'inside',
    ]);
  });

  it('retries score mismatches for less than seven days and stops at the boundary', () => {
    const events: FinishedEvent[] = [
      { id: 'inside', date: '2026-11-06T00:00:00.001Z', homeScore: 1, awayScore: 0 },
      { id: 'boundary', date: '2026-11-06T00:00:00.000Z', homeScore: 1, awayScore: 0 },
      { id: 'matched', date: '2026-11-06T00:00:00.001Z', homeScore: 1, awayScore: 0 },
    ];
    const stored = new Map([
      ['inside', { scoreMatches: false, fetchedAt: '2026-11-09T00:00:00.000Z' }],
      ['boundary', { scoreMatches: false, fetchedAt: '2026-11-09T00:00:00.000Z' }],
      ['matched', { scoreMatches: true, fetchedAt: '2026-11-09T00:00:00.000Z' }],
    ]);

    expect(selectEventsToFetch(events, stored, new Date('2026-11-13T00:00:00.000Z'), 10)).toEqual([
      'inside',
    ]);
  });

  it('does not refetch an unsettled stored event after the seven-day retry window', () => {
    const events: FinishedEvent[] = [
      { id: 'old-unsettled', date: '2026-11-05T23:59:59.999Z', homeScore: 0, awayScore: 0 },
    ];
    const stored = new Map([
      ['old-unsettled', { scoreMatches: true, fetchedAt: '2026-11-06T00:59:59.999Z' }],
    ]);

    expect(selectEventsToFetch(events, stored, new Date('2026-11-13T00:00:00.000Z'), 10)).toEqual([]);
  });

  it('refetches a score-mismatched stored event within the seven-day retry window', () => {
    const events: FinishedEvent[] = [
      { id: 'recent-mismatch', date: '2026-11-07T00:00:00.001Z', homeScore: 1, awayScore: 0 },
    ];
    const stored = new Map([
      ['recent-mismatch', { scoreMatches: false, fetchedAt: '2026-11-10T00:00:00.000Z' }],
    ]);

    expect(selectEventsToFetch(events, stored, new Date('2026-11-13T00:00:00.000Z'), 10)).toEqual([
      'recent-mismatch',
    ]);
  });
});

describe('aggregateTimelines', () => {
  it('aggregates scoring, assists, penalties, and cards with latest-team attribution', () => {
    const timelines: StoredTimeline[] = [
      {
        eventId: 'newer-event',
        date: '2026-09-01T00:00:00.000Z',
        entries: [
          entry({
            idTimeline: 'new-1',
            type: 'Card',
            detail: 'Yellow Card',
            strPlayer: 'Player One New',
            idTeam: 'team-new',
            strTeam: 'New Team',
          }),
          entry({
            idTimeline: 'new-2',
            idPlayer: 'player-2',
            strPlayer: 'Player Two New',
            idAssist: 'player-1',
            strAssist: 'Player One New',
            idTeam: 'team-new',
            strTeam: 'New Team',
          }),
        ],
      },
      {
        eventId: 'older-event',
        date: '2026-08-01T00:00:00.000Z',
        entries: [
          entry({
            idTimeline: 'old-1',
            idAssist: 'player-2',
            strAssist: 'Player Two Old',
            idTeam: 'team-old',
            strTeam: 'Old Team',
          }),
          entry({
            idTimeline: 'old-2',
            detail: 'Penalty',
            idTeam: 'team-old',
            strTeam: 'Old Team',
          }),
          entry({
            idTimeline: 'old-3',
            detail: 'Missed Penalty',
            idTeam: 'team-old',
            strTeam: 'Old Team',
          }),
          entry({
            idTimeline: 'old-4',
            type: 'Card',
            detail: 'Yellow Card',
            idTeam: 'team-old',
            strTeam: 'Old Team',
          }),
          entry({
            idTimeline: 'old-5',
            type: 'Card',
            detail: 'Red Card',
            idPlayer: 'player-2',
            strPlayer: 'Player Two Old',
            idTeam: 'team-old',
            strTeam: 'Old Team',
          }),
          entry({
            idTimeline: 'old-6',
            detail: 'Own Goal',
            idPlayer: 'own-goal-player',
            strPlayer: 'Own Goal Player',
            idTeam: 'benefiting-team',
            strTeam: 'Benefiting Team',
          }),
        ],
      },
    ];
    const now = '2026-11-13T12:34:56.000Z';

    expect(aggregateTimelines(timelines, 'league-1', '2026-27', now)).toEqual([
      {
        idPlayer: 'player-1',
        strPlayer: 'Player One New',
        idTeam: 'team-new',
        strTeam: 'New Team',
        idLeague: 'league-1',
        strSeason: '2026-27',
        goals: 2,
        assists: 1,
        yellow_cards: 2,
        red_cards: 0,
        penalties_scored: 1,
        penalties_missed: 1,
        last_updated: now,
      },
      {
        idPlayer: 'player-2',
        strPlayer: 'Player Two New',
        idTeam: 'team-new',
        strTeam: 'New Team',
        idLeague: 'league-1',
        strSeason: '2026-27',
        goals: 1,
        assists: 1,
        yellow_cards: 0,
        red_cards: 1,
        penalties_scored: 0,
        penalties_missed: 0,
        last_updated: now,
      },
    ]);
  });

  it('sorts matches by date, uses the latest team, and retains the latest non-empty player name', () => {
    const timelines: StoredTimeline[] = [
      {
        eventId: 'latest-event',
        date: '2026-10-01T00:00:00.000Z',
        entries: [entry({
          idTimeline: 'latest',
          type: 'Card',
          detail: 'Yellow Card',
          strPlayer: '',
          idTeam: 'latest-team',
          strTeam: 'Latest Team',
        })],
      },
      {
        eventId: 'oldest-event',
        date: '2026-08-01T00:00:00.000Z',
        entries: [entry({
          idTimeline: 'oldest',
          strPlayer: 'Old Name',
          idTeam: 'oldest-team',
          strTeam: 'Oldest Team',
        })],
      },
      {
        eventId: 'middle-event',
        date: '2026-09-01T00:00:00.000Z',
        entries: [entry({
          idTimeline: 'middle',
          type: 'Card',
          detail: 'Red Card',
          strPlayer: 'Current Name',
          idTeam: 'middle-team',
          strTeam: 'Middle Team',
        })],
      },
    ];
    const now = '2026-11-13T12:34:56.000Z';

    expect(aggregateTimelines(timelines, 'league-1', '2026-27', now)).toEqual([
      {
        idPlayer: 'player-1',
        strPlayer: 'Current Name',
        idTeam: 'latest-team',
        strTeam: 'Latest Team',
        idLeague: 'league-1',
        strSeason: '2026-27',
        goals: 1,
        assists: 0,
        yellow_cards: 1,
        red_cards: 1,
        penalties_scored: 0,
        penalties_missed: 0,
        last_updated: now,
      },
    ]);
  });
});
