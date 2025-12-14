import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeaguePage from '@/pages/LeaguePage';
import * as api from '@/lib/api';
import * as theSportsDBApi from '@/lib/thesportsdb-api';

// Mock dependencies
vi.mock('@/lib/api');
vi.mock('@/lib/thesportsdb-api');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('LeaguePage Display Validation', () => {
  const mockLeague = {
    id: 4689,
    slug: 'k-league-1',
    name: 'K League 1',
    logo_url: 'https://example.com/k1-logo.png',
    current_season: '2025',
    country: 'South Korea',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (api.fetchLeagueBySlug as any).mockResolvedValue(mockLeague);
    (api.fetchLeagueStandings as any).mockResolvedValue([]);
    (theSportsDBApi.fetchLeagueFixtures as any).mockResolvedValue({ upcoming: [], recent: [] });
    (api.fetchHistoricalChampions as any).mockResolvedValue([]);
    (api.fetchTopScorers as any).mockResolvedValue([]);
    (api.fetchTopAssists as any).mockResolvedValue([]);
  });

  const renderLeaguePage = (slug = 'k-league-1') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/leagues/${slug}`]}>
          <Routes>
            <Route path="/leagues/:slug" element={<LeaguePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render league page with valid data', async () => {
    renderLeaguePage();

    await waitFor(() => {
      // Check for essential page elements using unique identifiers
      expect(screen.getByText('K League 1')).toBeInTheDocument();
      // Use regex for flexible matching (e.g. "국가: South Korea")
      expect(screen.getByText(/South Korea/)).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
      
      // Check for FM style section headers
      expect(screen.getByText('리그 순위 >')).toBeInTheDocument();
      expect(screen.getByText('경기/결과 >')).toBeInTheDocument();
      expect(screen.getByText('지난 우승팀 >')).toBeInTheDocument();
    });
  });

  it('should handle league not found gracefully', async () => {
    (api.fetchLeagueBySlug as any).mockResolvedValue(null);
    renderLeaguePage('league-nonexistent');

    // Should show error state for non-existent league
    const errorMessage = await screen.findByText('League not found.');
    expect(errorMessage).toBeInTheDocument();
  });
});
