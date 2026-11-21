import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import { fetchLeagueLeaders, fetchMatchesInRange, fetchSyncStatus } from '@/lib/api';
import { kstDateTime, kstShortDate } from '@/lib/dates';

type Result = { data: any; error: any };

function createChain(data: any, error: any = null) {
  const result: Result = { data, error };
  const chain: any = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lt', 'lte', 'or', 'order', 'limit']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = vi.fn((resolve: (value: Result) => unknown) => resolve(result));
  return chain;
}

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

describe('home API queries', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => vi.useRealTimers());

  it('queries an inclusive KST date range with supported leagues, phases, team IDs, and stable descending order', async () => {
    const rows = [{ id: 'match-1' }];
    const chain = createChain(rows);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchMatchesInRange('2026-11-18', '2026-11-20', {
      phases: ['live', 'finished'],
      teamIds: ['10', 'hist_"12\\'],
      descending: true,
      limit: 30,
    })).resolves.toBe(rows);

    expect(supabase.from).toHaveBeenCalledWith('events_v2');
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-11-17T15:00:00.000Z');
    expect(chain.lt).toHaveBeenCalledWith('date', '2026-11-20T15:00:00.000Z');
    expect(chain.in).toHaveBeenCalledWith('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']);
    expect(chain.in).toHaveBeenCalledWith('status', [
      'IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P',
      'FINISHED', 'FT', 'AET', 'PEN',
    ]);
    expect(chain.or).toHaveBeenCalledWith('homeTeamId.in.("10","hist_\\"12\\\\"),awayTeamId.in.("10","hist_\\"12\\\\")');
    expect(chain.order.mock.calls).toEqual([
      ['date', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(chain.limit).toHaveBeenCalledWith(30);
  });

  it('uses ascending order and the default limit, returns no rows without querying for an empty team filter, and propagates errors', async () => {
    const chain = createChain([]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchMatchesInRange('2026-11-18', '2026-11-18')).resolves.toEqual([]);
    expect(chain.order.mock.calls).toEqual([
      ['date', { ascending: true }],
      ['id', { ascending: true }],
    ]);
    expect(chain.limit).toHaveBeenCalledWith(100);

    vi.clearAllMocks();
    await expect(fetchMatchesInRange('2026-11-18', '2026-11-18', { teamIds: [] })).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();

    const error = { message: 'matches failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchMatchesInRange('2026-11-18', '2026-11-18')).rejects.toBe(error);
  });

  it('keeps only each league latest season, maps nullable counts, and sorts by menu order then rank', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T00:00:00.000Z'));
    const chain = createChain([
      { leagueId: '4328', season: '2026', rank: '2', teamId: 12, teamName: 'Arsenal', teamBadgeUrl: 'a.png', gamesPlayed: '11', points: '24' },
      { leagueId: '4689', season: '2025', rank: 1, teamId: 1, teamName: 'Old Ulsan', teamBadgeUrl: null, gamesPlayed: 38, points: 70 },
      { leagueId: '4689', season: '2026', rank: '2', teamId: 2, teamName: 'Jeonbuk', teamBadgeUrl: undefined, gamesPlayed: null, points: undefined },
      { leagueId: '4689', season: '2026', rank: '1', teamId: 1, teamName: 'Ulsan', teamBadgeUrl: 'u.png', gamesPlayed: 12, points: 28 },
      { leagueId: '4328', season: '2026', rank: '1', teamId: 11, teamName: 'Liverpool', teamBadgeUrl: null, gamesPlayed: 11, points: 27 },
    ]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchLeagueLeaders()).resolves.toEqual([
      { league_id: '4689', season: '2026', rank: 1, team_id: '1', team_name: 'Ulsan', crest_url: 'u.png', played: 12, points: 28 },
      { league_id: '4689', season: '2026', rank: 2, team_id: '2', team_name: 'Jeonbuk', crest_url: null, played: null, points: null },
      { league_id: '4328', season: '2026', rank: 1, team_id: '11', team_name: 'Liverpool', crest_url: null, played: 11, points: 27 },
      { league_id: '4328', season: '2026', rank: 2, team_id: '12', team_name: 'Arsenal', crest_url: 'a.png', played: 11, points: 24 },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('standings_v2');
    expect(chain.select).toHaveBeenCalledWith('leagueId, season, rank, teamId, teamName, teamBadgeUrl, gamesPlayed, points');
    expect(chain.in).toHaveBeenCalledWith('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']);
    expect(chain.gte).toHaveBeenCalledWith('season', '2025');
    expect(chain.lte).toHaveBeenCalledWith('rank', 4);
  });

  it('honors a custom leader count and propagates standings errors', async () => {
    const chain = createChain([]);
    vi.mocked(supabase.from).mockReturnValue(chain);
    await expect(fetchLeagueLeaders(2)).resolves.toEqual([]);
    expect(chain.lte).toHaveBeenCalledWith('rank', 2);

    const error = { message: 'standings failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchLeagueLeaders()).rejects.toBe(error);
  });

  it('maps sync status by step, ignores missing timestamps, and propagates errors', async () => {
    const chain = createChain([
      { step: 'events', lastSuccessAt: '2026-11-20T22:53:55Z' },
      { step: 'standings', lastSuccessAt: null },
      { step: 42, lastSuccessAt: 123 },
    ]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchSyncStatus()).resolves.toEqual({
      events: '2026-11-20T22:53:55Z',
      '42': '123',
    });
    expect(supabase.from).toHaveBeenCalledWith('sync_status');
    expect(chain.select).toHaveBeenCalledWith('step, lastSuccessAt');

    const error = { message: 'status failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchSyncStatus()).rejects.toBe(error);
  });
});

describe('home KST date labels', () => {
  it('formats an instant as a short Korean date and Korean date-time across the UTC day boundary', () => {
    expect(kstShortDate('2026-11-21T16:05:00.000Z')).toBe('11. 22. (일)');
    expect(kstDateTime('2026-11-20T22:53:00.000Z')).toBe('11월 21일 07:53');
  });
});
