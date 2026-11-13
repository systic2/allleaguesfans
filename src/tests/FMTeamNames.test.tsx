import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FMHistory from '@/components/fm/FMHistory';
import FMPlayerStats from '@/components/fm/FMPlayerStats';
import FMStandings from '@/components/fm/FMStandings';
import { fetchTeamKoreanNames, type TeamStanding } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  fetchTeamKoreanNames: vi.fn(),
}));

const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FM team-name displays', () => {
  beforeEach(() => {
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamKoreanNames.mockResolvedValue({});
  });

  it('FMStandings renders the Korean name matching team_id', async () => {
    mockFetchTeamKoreanNames.mockResolvedValue({ '138001': '울산 HD' });
    const standings: TeamStanding[] = [{
      team_id: '138001',
      team_name: 'Ulsan HD FC',
      short_name: 'UHD',
      rank: 1,
      points: 30,
      played: 15,
      win: 10,
      draw: 0,
      lose: 5,
      goals_for: 25,
      goals_against: 15,
      goals_diff: 10,
      crest_url: null,
      form: 'WWWWW',
    }];

    render(<FMStandings standings={standings} />, { wrapper: TestProviders });

    expect(await screen.findByText('울산 HD')).toBeInTheDocument();
    expect(screen.queryByText('Ulsan HD FC')).not.toBeInTheDocument();
  });

  it('FMHistory renders the Korean name matching champion_team_id', async () => {
    mockFetchTeamKoreanNames.mockResolvedValue({ '138001': '울산 HD' });

    render(
      <FMHistory
        history={[{
          season_year: 2025,
          champion_team_id: '138001',
          champion_name: 'Ulsan HD FC',
          champion_logo: null,
        }]}
      />,
      { wrapper: TestProviders },
    );

    expect(await screen.findByText('울산 HD')).toBeInTheDocument();
    expect(screen.queryByText('Ulsan HD FC')).not.toBeInTheDocument();
  });

  it('FMPlayerStats omits fabricated average-rating and match-MVP cards', () => {
    render(
      <FMPlayerStats
        scorers={[{ player_name: 'Scorer', team_id: '1', team_name: 'Team One', goals: 8, assists: 1, matches: 10 }]}
        assists={[{ player_name: 'Creator', team_id: '2', team_name: 'Team Two', assists: 6, goals: 2, matches: 10 }]}
      />,
      { wrapper: TestProviders },
    );

    expect(screen.queryByText(/평균 평점/)).not.toBeInTheDocument();
    expect(screen.queryByText(/경기 MVP/)).not.toBeInTheDocument();
    expect(screen.getByText('득점 >')).toBeInTheDocument();
    expect(screen.getByText('도움 >')).toBeInTheDocument();
  });
});
