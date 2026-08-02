import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeaguePage from '@/pages/LeaguePage';
import * as api from '@/lib/api';

// This suite exercises the initial-round priority logic in
// src/pages/LeaguePage.tsx (Live > Upcoming > Completed > Fallback > '1'),
// which was previously never actually executed by the other LeaguePage
// test suites because getCurrentLiveRound/getNextUpcomingRound/
// getLatestCompletedRound/getAllRounds/fetchFixturesByRound were left
// unmocked, causing React Query to warn "Query data cannot be undefined"
// and the component to always fall through to the final '1' fallback.
vi.mock('@/lib/api');

const mockLeague = {
  id: 4689,
  slug: 'k-league-1',
  name: 'K League 1',
  logo_url: 'https://example.com/k1-logo.png',
  current_season: '2025',
  country: 'South Korea',
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderLeaguePage(slug = 'k-league-1') {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/leagues/${slug}`]}>
        <Routes>
          <Route path="/leagues/:slug" element={<LeaguePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LeaguePage initial round priority (Live > Upcoming > Completed > Fallback)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (api.fetchLeagueBySlug as any).mockResolvedValue(mockLeague);
    (api.fetchLeagueStandings as any).mockResolvedValue([]);
    (api.fetchHistoricalChampions as any).mockResolvedValue([]);
    (api.fetchTopScorers as any).mockResolvedValue([]);
    (api.fetchTopAssists as any).mockResolvedValue([]);
    (api.fetchFixturesByRound as any).mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function expectNoReactQueryUndefinedDataWarning() {
    const offendingCall = consoleErrorSpy.mock.calls.find((call) =>
      call.some(
        (arg) => typeof arg === 'string' && arg.includes('Query data cannot be undefined')
      )
    );
    expect(offendingCall).toBeUndefined();
  }

  it('selects the live round when a live round is present, even if upcoming/completed rounds also exist', async () => {
    (api.getAllRounds as any).mockResolvedValue(['3', '4', '5', '6']);
    (api.getCurrentLiveRound as any).mockResolvedValue('5');
    (api.getNextUpcomingRound as any).mockResolvedValue('6');
    (api.getLatestCompletedRound as any).mockResolvedValue('4');

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 5')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });

  it('selects the upcoming round when no live round is present', async () => {
    (api.getAllRounds as any).mockResolvedValue(['3', '4', '5', '6']);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue('6');
    (api.getLatestCompletedRound as any).mockResolvedValue('4');

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 6')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });

  it('selects the completed round when no live or upcoming round exists, mapping it to the matching entry in allRounds', async () => {
    (api.getAllRounds as any).mockResolvedValue(['3', '4', '5', '6']);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue(null);
    (api.getLatestCompletedRound as any).mockResolvedValue('4');

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 4')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });

  it('falls back to the last round in allRounds when the completed round is not found in allRounds', async () => {
    (api.getAllRounds as any).mockResolvedValue(['3', '4', '5', '6']);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue(null);
    // '4-playoff' does not exist in allRounds, simulating a mismatched/typo'd round format
    (api.getLatestCompletedRound as any).mockResolvedValue('4-playoff');

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 6')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });

  it('falls back to the last round in allRounds when live/upcoming/completed are all null', async () => {
    (api.getAllRounds as any).mockResolvedValue(['3', '4', '5', '6']);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue(null);
    (api.getLatestCompletedRound as any).mockResolvedValue(null);

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 6')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });

  it('falls back to Round 1 when allRounds itself is empty', async () => {
    (api.getAllRounds as any).mockResolvedValue([]);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue(null);
    (api.getLatestCompletedRound as any).mockResolvedValue(null);

    renderLeaguePage();

    await waitFor(() => {
      expect(screen.getByText('Round 1')).toBeInTheDocument();
    });

    expectNoReactQueryUndefinedDataWarning();
  });
});
