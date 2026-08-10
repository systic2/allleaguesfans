import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { fetchHistoricalChampions } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

type StandingRow = {
  season: string;
  teamName: string;
};

type QueryResult = {
  data: StandingRow[];
  error: null;
};

function createMockSupabaseChain(rows: StandingRow[]) {
  let result = [...rows];
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.lt = vi.fn((column: keyof StandingRow, cutoff: string) => {
    result = result.filter((row) => String(row[column]) < cutoff);
    return chain;
  });
  chain.order = vi.fn((column: keyof StandingRow, { ascending }: { ascending: boolean }) => {
    result.sort((left, right) => {
      const comparison = String(left[column]).localeCompare(String(right[column]));
      return ascending ? comparison : -comparison;
    });
    return chain;
  });
  chain.limit = vi.fn((count: number) => {
    result = result.slice(0, count);
    return chain;
  });
  chain.then = vi.fn(
    (
      onFulfilled: (queryResult: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: result, error: null }).then(onFulfilled, onRejected),
  );

  return chain;
}

describe('fetchHistoricalChampions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses an explicitly passed current season as the exclusion cutoff', async () => {
    const query = createMockSupabaseChain([
      { season: '2026', teamName: 'Current Season Leader' },
      { season: '2025', teamName: 'Previous Champion' },
    ]);
    (supabase.from as any).mockReturnValueOnce(query);

    const result = await fetchHistoricalChampions(4328, '2026');

    expect(supabase.from).toHaveBeenCalledWith('standings_v2');
    expect(query.lt).toHaveBeenCalledWith('season', '2026');
    expect(result).toEqual([
      {
        season_year: 2025,
        champion_name: 'Previous Champion',
        champion_logo: null,
      },
    ]);
  });

  it('falls back to the calendar year when the current season is not passed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-04-15T12:00:00Z'));
    const query = createMockSupabaseChain([]);
    (supabase.from as any).mockReturnValueOnce(query);

    await fetchHistoricalChampions(4328);

    expect(query.lt).toHaveBeenCalledWith('season', '2031');
  });

  it('maps champions and keeps descending season order capped at 15 rows', async () => {
    const rows = Array.from({ length: 18 }, (_, index) => ({
      season: String(2008 + index),
      teamName: `Champion ${2008 + index}`,
    }));
    const query = createMockSupabaseChain(rows);
    (supabase.from as any).mockReturnValueOnce(query);

    const result = await fetchHistoricalChampions(4328, '2026');

    expect(query.order).toHaveBeenCalledWith('season', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(15);
    expect(result).toHaveLength(15);
    expect(result[0]).toEqual({
      season_year: 2025,
      champion_name: 'Champion 2025',
      champion_logo: null,
    });
    expect(result.at(-1)).toEqual({
      season_year: 2011,
      champion_name: 'Champion 2011',
      champion_logo: null,
    });
  });
});
