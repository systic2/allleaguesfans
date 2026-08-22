import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/thesportsdb-api');

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { fetchMatchDetails } from '@/lib/thesportsdb-api';
import { supabase } from '@/lib/supabaseClient';

type QueryResult<T> = {
  data: T | null;
  error: unknown;
};

function createMockSupabaseChain<T>(result: QueryResult<T>) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);

  return chain;
}

const match = {
  id: 'match-123',
  leagueId: '4328',
  season: '2025-2026',
  round: '12',
  date: '2026-01-10T15:00:00Z',
  status: 'FINISHED',
  homeTeamId: 'team-home',
  awayTeamId: 'team-away',
  homeScore: 2,
  awayScore: 1,
  sourceIds: { thesportsdb: '123' },
  homeTeam: {
    id: 'team-home',
    name: 'Home FC',
    badgeUrl: 'https://example.com/home.png',
  },
  awayTeam: {
    id: 'team-away',
    name: 'Away FC',
    badgeUrl: 'https://example.com/away.png',
  },
};

describe('fetchMatchDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns match and team data merged with league information', async () => {
    const matchQuery = createMockSupabaseChain({ data: match, error: null });
    const leagueQuery = createMockSupabaseChain({
      data: {
        strLeague: 'English Premier League',
        strBadge: 'https://example.com/premier-league.png',
      },
      error: null,
    });
    (supabase.from as any)
      .mockReturnValueOnce(matchQuery)
      .mockReturnValueOnce(leagueQuery);

    const result = await fetchMatchDetails('match-123');

    expect(result).toEqual({
      ...match,
      leagueName: 'English Premier League',
      leagueBadge: 'https://example.com/premier-league.png',
    });
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'events_v2');
    expect(matchQuery.select).toHaveBeenCalledWith(
      expect.stringContaining('homeTeam:teams_v2!homeTeamId(id, name, badgeUrl)'),
    );
    expect(matchQuery.select).toHaveBeenCalledWith(
      expect.stringContaining('awayTeam:teams_v2!awayTeamId(id, name, badgeUrl)'),
    );
    expect(matchQuery.eq).toHaveBeenCalledWith('id', 'match-123');
    expect(matchQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'leagues');
    expect(leagueQuery.select).toHaveBeenCalledWith('strLeague, strBadge');
    expect(leagueQuery.eq).toHaveBeenCalledWith('idLeague', '4328');
    expect(leagueQuery.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null without querying leagues when the match is not found', async () => {
    const matchQuery = createMockSupabaseChain({ data: null, error: null });
    (supabase.from as any).mockReturnValueOnce(matchQuery);

    await expect(fetchMatchDetails('missing-match')).resolves.toBeNull();

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('events_v2');
  });

  it('logs the events query error and returns null', async () => {
    const error = new Error('events query failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const matchQuery = createMockSupabaseChain({ data: null, error });
    (supabase.from as any).mockReturnValueOnce(matchQuery);

    await expect(fetchMatchDetails('match-123')).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledWith('Database error fetching match details:', error);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('returns the match with null league fields when the league query fails', async () => {
    const leagueError = new Error('league query failed');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const matchQuery = createMockSupabaseChain({ data: match, error: null });
    const leagueQuery = createMockSupabaseChain({ data: null, error: leagueError });
    (supabase.from as any)
      .mockReturnValueOnce(matchQuery)
      .mockReturnValueOnce(leagueQuery);

    await expect(fetchMatchDetails('match-123')).resolves.toEqual({
      ...match,
      leagueName: null,
      leagueBadge: null,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Error fetching league info for match match-123:',
      leagueError,
    );
  });
});
