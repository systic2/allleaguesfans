// src/tests/LeaguePageDisplayValidation.test.tsx
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeaguePage from '../pages/LeaguePage';

// Mock API functions
vi.mock('../lib/api', () => ({
  fetchLeagueBySlug: vi.fn(),
  fetchLeagueStandings: vi.fn(),
  fetchLeagueStats: vi.fn(),
  fetchTopScorers: vi.fn(),
  fetchTopAssists: vi.fn(),
  fetchHistoricalChampions: vi.fn(),
}));

describe('LeaguePage Display Validation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { 
        queries: { 
          retry: false,
          gcTime: 0, // Updated from cacheTime to gcTime (React Query v5)
          staleTime: 0,
        } 
      },
    });
    vi.clearAllMocks();
  });

  test('should render loading state initially', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/leagues/league-4001']}>
          <LeaguePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Check for loading state
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('should handle league not found gracefully', async () => {
    const { fetchLeagueBySlug } = await import('../lib/api');
    vi.mocked(fetchLeagueBySlug).mockResolvedValue(null);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/leagues/league-9999']}>
          <LeaguePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should show error state for non-existent league
    await screen.findByText(/리그 정보를 불러올 수 없습니다/);
  });
});