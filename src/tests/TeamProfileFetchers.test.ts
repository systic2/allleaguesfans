import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { fetchNearbyStandings, fetchTeamTrophyCount } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type StandingRow = {
  teamId: string;
  teamName: string;
  teamBadgeUrl: string;
  rank: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
};

type QueryResult = {
  data: StandingRow[] | null;
  error: unknown;
  count?: number | null;
};

function createMockSupabaseChain(result: QueryResult) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.then = vi.fn(
    (
      onFulfilled: (queryResult: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  );

  return chain;
}

function standing(rank: number): StandingRow {
  return {
    teamId: String(100 + rank),
    teamName: `Team ${rank}`,
    teamBadgeUrl: `https://example.com/${rank}.png`,
    rank,
    points: 30 - rank,
    gamesPlayed: 10,
    wins: 8,
    draws: 1,
    losses: 1,
    goalsFor: 20,
    goalsAgainst: 10,
    goalDifference: 10,
    form: rank % 2 === 0 ? 'WWDLW' : null,
  };
}

describe('team profile fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchTeamTrophyCount', () => {
    it('returns the exact count from standings_v2, excluding the in-progress season', async () => {
      const query = createMockSupabaseChain({ data: null, error: null, count: 7 });
      (supabase.from as any).mockReturnValueOnce(query);

      const result = await fetchTeamTrophyCount('133602', '2026');

      expect(result).toBe(7);
      expect(supabase.from).toHaveBeenCalledWith('standings_v2');
      expect(query.select).toHaveBeenCalledWith('season', { count: 'exact', head: true });
      expect(query.eq).toHaveBeenNthCalledWith(1, 'teamId', '133602');
      expect(query.eq).toHaveBeenNthCalledWith(2, 'rank', 1);
      expect(query.lt).toHaveBeenCalledWith('season', '2026');
    });

    it('normalizes a ranged current season before excluding it', async () => {
      const query = createMockSupabaseChain({ data: null, error: null, count: 4 });
      (supabase.from as any).mockReturnValueOnce(query);

      await fetchTeamTrophyCount('133602', '2025-2026');

      expect(query.lt).toHaveBeenCalledWith('season', '2025');
    });

    it('returns 0 when the count is null', async () => {
      const query = createMockSupabaseChain({ data: null, error: null, count: null });
      (supabase.from as any).mockReturnValueOnce(query);

      await expect(fetchTeamTrophyCount('133602', '2026')).resolves.toBe(0);
    });

    it('returns 0 without throwing when Supabase returns an error', async () => {
      const error = new Error('count failed');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const query = createMockSupabaseChain({ data: null, error, count: null });
      (supabase.from as any).mockReturnValueOnce(query);

      await expect(fetchTeamTrophyCount('133602', '2026')).resolves.toBe(0);
      expect(warn).toHaveBeenCalledWith('Error fetching trophy count for team 133602:', error);
    });
  });

  describe('fetchNearbyStandings', () => {
    it.each([
      { label: 'a middle-ranked team', teamId: '104', expectedRanks: [2, 3, 4, 5, 6] },
      { label: 'the first-ranked team', teamId: '101', expectedRanks: [1, 2, 3] },
      { label: 'the last-ranked team', teamId: '107', expectedRanks: [5, 6, 7] },
    ])('returns the available two rows around $label', async ({ teamId, expectedRanks }) => {
      const query = createMockSupabaseChain({
        data: Array.from({ length: 7 }, (_, index) => standing(index + 1)),
        error: null,
      });
      (supabase.from as any).mockReturnValueOnce(query);

      const result = await fetchNearbyStandings('4328', '2025', teamId, 2);

      expect(result.map(({ rank }) => rank)).toEqual(expectedRanks);
      expect(query.order).toHaveBeenCalledWith('rank', { ascending: true });
    });

    it('normalizes a ranged season before querying and maps rows to TeamStanding', async () => {
      const query = createMockSupabaseChain({ data: [standing(1)], error: null });
      (supabase.from as any).mockReturnValueOnce(query);

      const result = await fetchNearbyStandings('4328', '2025-2026', '101');

      expect(query.eq).toHaveBeenNthCalledWith(1, 'leagueId', '4328');
      expect(query.eq).toHaveBeenNthCalledWith(2, 'season', '2025');
      expect(result).toEqual([
        {
          team_id: 101,
          team_name: 'Team 1',
          short_name: null,
          crest_url: 'https://example.com/1.png',
          rank: 1,
          points: 29,
          played: 10,
          win: 8,
          draw: 1,
          lose: 1,
          goals_for: 20,
          goals_against: 10,
          goals_diff: 10,
          form: null,
        },
      ]);
    });

    it('returns the full list when the team is not present', async () => {
      const rows = Array.from({ length: 6 }, (_, index) => standing(index + 1));
      const query = createMockSupabaseChain({ data: rows, error: null });
      (supabase.from as any).mockReturnValueOnce(query);

      const result = await fetchNearbyStandings('4328', '2025', '999', 2);

      expect(result.map(({ rank }) => rank)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});
