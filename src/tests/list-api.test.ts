import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchMatchesOnDate,
  fetchNextMatchDate,
  fetchPlayersPage,
  fetchTeamsList,
} from '@/lib/api';
import { POSITION_GROUPS, STAFF_POSITIONS } from '@/lib/positions';

type Result = { data: any; error: any; count?: number | null };

function createChain(data: any, error: any = null, count: number | null = null) {
  const result: Result = { data, error, count };
  const chain: any = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lt', 'or', 'ilike', 'order', 'limit', 'range']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = vi.fn((resolve: (value: Result) => unknown) => resolve(result));
  return chain;
}

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

describe('list page API queries', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('selects each supported league latest season, then orders leagues and ranks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T00:00:00Z'));
    const chain = createChain([
      { leagueId: '4328', season: '2025', teamId: 4, teamName: 'Old Arsenal', teamBadgeUrl: null, rank: 1 },
      { leagueId: '4689', season: '2026', teamId: 2, teamName: 'Jeonbuk', teamBadgeUrl: 'j.png', rank: 2 },
      { leagueId: '4328', season: '2026', teamId: 3, teamName: 'Arsenal', teamBadgeUrl: 'a.png', rank: 2 },
      { leagueId: '4689', season: '2026', teamId: 1, teamName: 'Ulsan', teamBadgeUrl: null, rank: 1 },
    ]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchTeamsList()).resolves.toEqual([
      { team_id: '1', team_name: 'Ulsan', crest_url: null, league_id: '4689', season: '2026', rank: 1 },
      { team_id: '2', team_name: 'Jeonbuk', crest_url: 'j.png', league_id: '4689', season: '2026', rank: 2 },
      { team_id: '3', team_name: 'Arsenal', crest_url: 'a.png', league_id: '4328', season: '2026', rank: 2 },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('standings_v2');
    expect(chain.in).toHaveBeenCalledWith('leagueId', ['4689', '4822', '4328', '4335', '4332', '4331', '4334']);
    expect(chain.gte).toHaveBeenCalledWith('season', '2025');
  });

  it('uses the KST year when selecting the minimum standings season', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-31T15:30:00Z'));
    const chain = createChain([]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await fetchTeamsList();

    expect(chain.gte).toHaveBeenCalledWith('season', '2025');
  });

  it('throws a standings error', async () => {
    const error = { message: 'standings failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchTeamsList()).rejects.toBe(error);
  });

  it('builds an exact-count player query with filters, safe search, stable sort, and range', async () => {
    const chain = createChain([
      {
        idPlayer: 7, strPlayer: 'Kim Min', idTeam: 10, strTeam: 'Ulsan', strPosition: 'Centre-Back',
        strNumber: '4', strNationality: 'South Korea', dateBorn: '2000-01-02', strThumb: 'kim.png',
      },
    ], null, 26);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchPlayersPage({ teamIds: ['10', '11'], position: 'DF', q: 'Kim%_*"\\', sort: 'young', page: 2 })).resolves.toEqual({
      total: 26,
      rows: [{
        id: '7', name: 'Kim Min', team_id: '10', team_name: 'Ulsan', position: 'Centre-Back',
        number: '4', nationality: 'South Korea', birth_date: '2000-01-02', photo_url: 'kim.png',
      }],
    });
    expect(supabase.from).toHaveBeenCalledWith('players_v2_current');
    expect(chain.select).toHaveBeenCalledWith(
      'idPlayer, strPlayer, idTeam, strTeam, strPosition, strNumber, strNationality, dateBorn, strThumb',
      { count: 'exact', head: false },
    );
    expect(chain.or).toHaveBeenCalledWith(`strPosition.is.null,strPosition.not.in.(${STAFF_POSITIONS.map((p) => `"${p}"`).join(',')})`);
    expect(chain.in).toHaveBeenCalledWith('idTeam', ['10', '11']);
    expect(chain.in).toHaveBeenCalledWith('strPosition', POSITION_GROUPS.find((group) => group.key === 'DF')!.positions);
    expect(chain.ilike).toHaveBeenCalledWith('strPlayer', '%Kim%');
    expect(chain.order.mock.calls).toEqual([
      ['dateBorn', { ascending: false, nullsFirst: false }],
      ['strPlayer', { ascending: true }],
      ['idPlayer', { ascending: true }],
    ]);
    expect(chain.range).toHaveBeenCalledWith(25, 49);
  });

  it('uses old-first sorting, maps nullable fields, and throws player errors', async () => {
    const chain = createChain([{ idPlayer: '8', strPlayer: 'No Team' }], null, 1);
    vi.mocked(supabase.from).mockReturnValue(chain);
    const result = await fetchPlayersPage({ sort: 'old' });
    expect(result.rows[0]).toEqual({
      id: '8', name: 'No Team', team_id: null, team_name: null, position: null,
      number: null, nationality: null, birth_date: null, photo_url: null,
    });
    expect(chain.order).toHaveBeenNthCalledWith(1, 'dateBorn', { ascending: true, nullsFirst: false });
    expect(chain.range).toHaveBeenCalledWith(0, 24);

    const error = { message: 'players failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchPlayersPage({})).rejects.toBe(error);
  });

  it('returns an empty player page without querying Supabase for an empty team filter', async () => {
    await expect(fetchPlayersPage({ teamIds: [] })).resolves.toEqual({ rows: [], total: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('recounts with the same filters after an out-of-range player page', async () => {
    const rangeChain = createChain(null, { code: 'PGRST103', message: 'range not satisfiable' });
    const countChain = createChain(null, null, 31);
    vi.mocked(supabase.from)
      .mockReturnValueOnce(rangeChain)
      .mockReturnValueOnce(countChain);

    await expect(fetchPlayersPage({ teamIds: ['10'], position: 'FW', q: 'Son', page: 99 })).resolves.toEqual({
      rows: [],
      total: 31,
    });

    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'players_v2_current');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'players_v2_current');
    expect(rangeChain.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact', head: false });
    expect(countChain.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact', head: true });
    for (const chain of [rangeChain, countChain]) {
      expect(chain.or).toHaveBeenCalledWith(`strPosition.is.null,strPosition.not.in.(${STAFF_POSITIONS.map((p) => `"${p}"`).join(',')})`);
      expect(chain.in).toHaveBeenCalledWith('idTeam', ['10']);
      expect(chain.in).toHaveBeenCalledWith('strPosition', POSITION_GROUPS.find((group) => group.key === 'FW')!.positions);
      expect(chain.ilike).toHaveBeenCalledWith('strPlayer', '%Son%');
    }
  });

  it('throws when the player recount after PGRST103 fails', async () => {
    const countError = { message: 'count failed' };
    vi.mocked(supabase.from)
      .mockReturnValueOnce(createChain(null, { code: 'PGRST103' }))
      .mockReturnValueOnce(createChain(null, countError));

    await expect(fetchPlayersPage({ page: 99 })).rejects.toBe(countError);
  });

  it('queries one KST day with optional league and phase, ordered by date and id', async () => {
    const rows = [{ id: 'm1', leagueId: '4328' }];
    const chain = createChain(rows);
    vi.mocked(supabase.from).mockReturnValue(chain);

    await expect(fetchMatchesOnDate('2026-11-18', { leagueId: '4328', phase: 'finished' })).resolves.toBe(rows);
    expect(supabase.from).toHaveBeenCalledWith('events_v2');
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-11-17T15:00:00.000Z');
    expect(chain.lt).toHaveBeenCalledWith('date', '2026-11-18T15:00:00.000Z');
    expect(chain.eq).toHaveBeenCalledWith('leagueId', '4328');
    expect(chain.in).toHaveBeenCalledWith('status', ['FINISHED', 'FT', 'AET', 'PEN']);
    expect(chain.order.mock.calls).toEqual([
      ['date', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  it('limits unscoped match queries to supported leagues and applies the next-date phase', async () => {
    const dateChain = createChain([]);
    const nextChain = createChain([]);
    vi.mocked(supabase.from)
      .mockReturnValueOnce(dateChain)
      .mockReturnValueOnce(nextChain);

    await fetchMatchesOnDate('2026-11-18');
    await fetchNextMatchDate('2026-11-18', null, 'scheduled');

    const leagueIds = ['4689', '4822', '4328', '4335', '4332', '4331', '4334'];
    expect(dateChain.in).toHaveBeenCalledWith('leagueId', leagueIds);
    expect(nextChain.in).toHaveBeenCalledWith('leagueId', leagueIds);
    expect(nextChain.in).toHaveBeenCalledWith('status', ['SCHEDULED', 'NS', 'UNKNOWN']);
  });

  it('returns the next match Korean date, null when absent, and propagates match errors', async () => {
    const chain = createChain([{ date: '2026-11-19T16:30:00.000Z' }]);
    vi.mocked(supabase.from).mockReturnValue(chain);
    await expect(fetchNextMatchDate('2026-11-18', '4689')).resolves.toBe('2026-11-20');
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-11-18T15:00:00.000Z');
    expect(chain.eq).toHaveBeenCalledWith('leagueId', '4689');
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(1);

    vi.mocked(supabase.from).mockReturnValue(createChain([]));
    await expect(fetchNextMatchDate('2026-11-18')).resolves.toBeNull();

    const error = { message: 'matches failed' };
    vi.mocked(supabase.from).mockReturnValue(createChain(null, error));
    await expect(fetchMatchesOnDate('2026-11-18')).rejects.toBe(error);
    await expect(fetchNextMatchDate('2026-11-18')).rejects.toBe(error);
  });
});
