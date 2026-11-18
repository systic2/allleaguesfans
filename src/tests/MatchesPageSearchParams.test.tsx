import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchesPage from '@/pages/MatchesPage';

const searchParamUpdates = vi.hoisted(() => [] as unknown[]);

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: (...args: Parameters<typeof actual.useSearchParams>) => {
      const [params, setParams] = actual.useSearchParams(...args);
      const recordingSetter: typeof setParams = (nextInit, options) => {
        searchParamUpdates.push(nextInit);
        setParams(nextInit, options);
      };
      return [params, recordingSetter] as const;
    },
  };
});

vi.mock('@/lib/api', () => ({
  fetchMatchesOnDate: vi.fn().mockResolvedValue([]),
  fetchNextMatchDate: vi.fn().mockResolvedValue(null),
  fetchTeamKoreanNames: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: () => <span data-testid="crest" />,
}));

describe('MatchesPage search params', () => {
  beforeEach(() => searchParamUpdates.splice(0));

  it('updates search params with a functional updater', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches?date=2026-11-18']}>
          <MatchesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '다음날' }));

    expect(searchParamUpdates).not.toHaveLength(0);
    expect(searchParamUpdates.every((update) => typeof update === 'function')).toBe(true);
  });
});
