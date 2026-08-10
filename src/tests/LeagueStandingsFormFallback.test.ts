import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { fetchLeagueStandings } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type QueryResult = {
  data: any;
  error: any;
};

function createMockSupabaseChain(data: any, error: any = null) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.then = vi.fn(
    (
      onFulfilled: (result: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error }).then(onFulfilled, onRejected),
  );

  return chain;
}

function standing(teamId: number, form: string | null) {
  return {
    teamId: String(teamId),
    teamName: `Team ${teamId}`,
    teamBadgeUrl: `https://example.com/${teamId}.png`,
    rank: 1,
    points: 10,
    gamesPlayed: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    goalsFor: 8,
    goalsAgainst: 4,
    goalDifference: 4,
    form,
  };
}

function mockStandingsAndEvents(standings: any[], events: any[]) {
  const standingsQuery = createMockSupabaseChain(standings);
  const eventsQuery = createMockSupabaseChain(events);

  (supabase.from as any)
    .mockReturnValueOnce(standingsQuery)
    .mockReturnValueOnce(eventsQuery);

  return { standingsQuery, eventsQuery };
}

describe('fetchLeagueStandings form fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves an existing standings form even when event results would produce a different value', async () => {
    mockStandingsAndEvents(
      [standing(10, 'WWDWW'), standing(20, '')],
      [
        {
          homeTeamId: '10',
          awayTeamId: '99',
          homeScore: 0,
          awayScore: 4,
          date: '2025-06-02',
        },
        {
          homeTeamId: '20',
          awayTeamId: '98',
          homeScore: 2,
          awayScore: 1,
          date: '2025-06-01',
        },
      ],
    );

    const result = await fetchLeagueStandings('k-league-2', '2025');

    expect(result.find(({ team_id }) => team_id === 10)?.form).toBe('WWDWW');
    expect(result.find(({ team_id }) => team_id === 20)?.form).toBe('W');
  });

  it('computes W/D/L for a missing form in newest-first event order', async () => {
    const { eventsQuery } = mockStandingsAndEvents(
      [standing(20, '')],
      [
        {
          homeTeamId: '20',
          awayTeamId: '91',
          homeScore: 2,
          awayScore: 1,
          date: '2025-07-03',
        },
        {
          homeTeamId: '92',
          awayTeamId: '20',
          homeScore: 0,
          awayScore: 0,
          date: '2025-07-02',
        },
        {
          homeTeamId: '93',
          awayTeamId: '20',
          homeScore: 3,
          awayScore: 1,
          date: '2025-07-01',
        },
      ],
    );

    const [result] = await fetchLeagueStandings('k-league-2', '2025');

    expect(result.form).toBe('WDL');
    expect(eventsQuery.order).toHaveBeenCalledWith('date', { ascending: false });
  });

  it('restricts the fallback query to finished matches, excluding live/postponed/canceled statuses', async () => {
    const { eventsQuery } = mockStandingsAndEvents(
      [standing(20, '')],
      [{ homeTeamId: '20', awayTeamId: '91', homeScore: 2, awayScore: 1, date: '2025-07-03' }],
    );

    await fetchLeagueStandings('k-league-2', '2025');

    expect(eventsQuery.in).toHaveBeenCalledWith('status', ['FINISHED', 'FT', 'AET', 'PEN']);
  });

  it('caps a computed form at the five most recent finished matches', async () => {
    mockStandingsAndEvents(
      [standing(20, null)],
      [
        { homeTeamId: '20', awayTeamId: '91', homeScore: 2, awayScore: 0, date: '2025-08-07' },
        { homeTeamId: '20', awayTeamId: '92', homeScore: 1, awayScore: 1, date: '2025-08-06' },
        { homeTeamId: '20', awayTeamId: '93', homeScore: 0, awayScore: 1, date: '2025-08-05' },
        { homeTeamId: '94', awayTeamId: '20', homeScore: 0, awayScore: 3, date: '2025-08-04' },
        { homeTeamId: '95', awayTeamId: '20', homeScore: 2, awayScore: 2, date: '2025-08-03' },
        { homeTeamId: '20', awayTeamId: '96', homeScore: 0, awayScore: 2, date: '2025-08-02' },
        { homeTeamId: '97', awayTeamId: '20', homeScore: 4, awayScore: 0, date: '2025-08-01' },
      ],
    );

    const [result] = await fetchLeagueStandings('k-league-2', '2025');

    expect(result.form).toBe('WDLWD');
    expect(result.form).toHaveLength(5);
  });

  it('returns null when a team with missing form has no finished events', async () => {
    mockStandingsAndEvents([standing(20, '')], []);

    const [result] = await fetchLeagueStandings('k-league-2', '2025');

    expect(result.form).toBeNull();
  });
});
