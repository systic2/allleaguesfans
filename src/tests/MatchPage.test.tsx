import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNearbyStandings,
  fetchTeamKoreanNames,
  type TeamStanding,
} from '@/lib/api';
import {
  fetchMatchDetails,
  type MatchDetails,
} from '@/lib/thesportsdb-api';
import MatchPage from '@/pages/MatchPage';

vi.mock('@/lib/api', () => ({
  fetchNearbyStandings: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

vi.mock('@/lib/thesportsdb-api', () => ({
  fetchMatchDetails: vi.fn(),
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: () => <span data-testid="crest-img" />,
}));

const mockFetchMatchDetails = vi.mocked(fetchMatchDetails);
const mockFetchNearbyStandings = vi.mocked(fetchNearbyStandings);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

const finishedMatch: MatchDetails = {
  id: 'match-10',
  leagueId: '4689',
  leagueName: 'K League 1',
  leagueBadge: null,
  season: '2026',
  round: '12',
  date: '2026-05-10T10:00:00.000Z',
  status: 'FINISHED',
  homeTeamId: 'home-1',
  awayTeamId: 'away-2',
  homeScore: 3,
  awayScore: 1,
  venueName: 'Test Stadium',
  sourceIds: { thesportsdb: 'match-10' },
  homeTeam: {
    id: 'home-1',
    name: 'English Home',
    badgeUrl: '/home-badge.png',
    sourceIds: { thesportsdb: 'home-1' },
  },
  awayTeam: {
    id: 'away-2',
    name: 'English Away',
    badgeUrl: '/away-badge.png',
    sourceIds: { thesportsdb: 'away-2' },
  },
};

function standing(teamId: string, rank: number, points: number): TeamStanding {
  return {
    team_id: teamId,
    team_name: `Team ${teamId}`,
    short_name: null,
    crest_url: null,
    rank,
    points,
    played: 10,
    win: 0,
    draw: 0,
    lose: 0,
    goals_for: 0,
    goals_against: 0,
    goals_diff: 0,
    form: null,
  };
}

function renderMatchPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/matches/match-10']}>
        <Routes>
          <Route path="/matches/:id" element={<MatchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MatchPage', () => {
  beforeEach(() => {
    mockFetchMatchDetails.mockReset();
    mockFetchNearbyStandings.mockReset();
    mockFetchTeamKoreanNames.mockReset();
    mockFetchNearbyStandings.mockResolvedValue([]);
    mockFetchTeamKoreanNames.mockResolvedValue({});
  });

  it('shows a loading spinner while match details are pending', () => {
    mockFetchMatchDetails.mockReturnValue(new Promise(() => {}));

    const { container } = renderMatchPage();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('경기를 찾을 수 없습니다.')).not.toBeInTheDocument();
  });

  it('shows the not-found state when no match exists', async () => {
    mockFetchMatchDetails.mockResolvedValue(null);

    renderMatchPage();

    expect(await screen.findByText('경기를 찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
  });

  it('shows the same safe state when loading match details fails', async () => {
    mockFetchMatchDetails.mockRejectedValue(new Error('match request failed'));

    renderMatchPage();

    expect(await screen.findByText('경기를 찾을 수 없습니다.')).toBeInTheDocument();
  });

  it('renders a finished score and maps Korean names to the correct home and away ids', async () => {
    mockFetchMatchDetails.mockResolvedValue(finishedMatch);
    mockFetchTeamKoreanNames.mockResolvedValue({
      'home-1': '홈 한글명',
      'away-2': '원정 한글명',
    });

    renderMatchPage();

    expect(await screen.findByText('홈 한글명')).toBeInTheDocument();
    expect(screen.getByText('원정 한글명')).toBeInTheDocument();
    expect(screen.getByText('3 - 1')).toBeInTheDocument();
    expect(screen.getByText('경기 종료')).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /홈 한글명/ });
    const awayLink = screen.getByRole('link', { name: /원정 한글명/ });
    expect(homeLink).toHaveAttribute('href', '/teams/home-1');
    expect(awayLink).toHaveAttribute('href', '/teams/away-2');
  });

  it('keeps the English fallback when an id is missing from the Korean-name map', async () => {
    mockFetchMatchDetails.mockResolvedValue(finishedMatch);
    mockFetchTeamKoreanNames.mockResolvedValue({ 'home-1': '홈 한글명' });

    renderMatchPage();

    expect(await screen.findByText('홈 한글명')).toBeInTheDocument();
    expect(screen.getByText('English Away')).toBeInTheDocument();
  });

  it('loads standings with the match league, season, and corresponding team ids', async () => {
    mockFetchMatchDetails.mockResolvedValue(finishedMatch);

    renderMatchPage();

    await waitFor(() => {
      expect(mockFetchNearbyStandings).toHaveBeenCalledTimes(2);
    });
    expect(mockFetchNearbyStandings).toHaveBeenCalledWith('4689', '2026', 'home-1', 0);
    expect(mockFetchNearbyStandings).toHaveBeenCalledWith('4689', '2026', 'away-2', 0);
  });

  it('shows rank and points only for the standings row matching each team id', async () => {
    mockFetchMatchDetails.mockResolvedValue(finishedMatch);
    mockFetchNearbyStandings.mockImplementation(async (_leagueId, _season, teamId) => {
      if (teamId === 'home-1') {
        return [
          standing('other-1', 1, 99),
          standing('home-1', 4, 37),
          standing('other-2', 5, 34),
        ];
      }

      return [standing('other-3', 2, 80), standing('other-4', 3, 72)];
    });

    renderMatchPage();

    const homeLink = await screen.findByRole('link', { name: /English Home/ });
    const awayLink = screen.getByRole('link', { name: /English Away/ });
    expect(await within(homeLink).findByText('4위 · 37점')).toBeInTheDocument();
    expect(within(homeLink).queryByText('1위 · 99점')).not.toBeInTheDocument();
    expect(within(awayLink).queryByText(/\d+위 · \d+점/)).not.toBeInTheDocument();
  });

  it('shows VS without a score for a scheduled match', async () => {
    mockFetchMatchDetails.mockResolvedValue({ ...finishedMatch, status: 'SCHEDULED' });

    renderMatchPage();

    expect(await screen.findByText('경기 예정')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
    expect(screen.queryByText('3 - 1')).not.toBeInTheDocument();
  });

  it('shows the score for a live match', async () => {
    mockFetchMatchDetails.mockResolvedValue({ ...finishedMatch, status: 'LIVE' });

    renderMatchPage();

    expect(await screen.findByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('3 - 1')).toBeInTheDocument();
    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });

  it.each([
    ['POSTPONED' as const, '연기됨'],
    ['CANCELED' as const, '취소됨'],
  ])('shows the %s label without a score', async (status, panelLabel) => {
    mockFetchMatchDetails.mockResolvedValue({ ...finishedMatch, status });

    renderMatchPage();

    expect((await screen.findAllByText(panelLabel)).length).toBeGreaterThan(0);
    expect(screen.queryByText('3 - 1')).not.toBeInTheDocument();
    expect(screen.queryByText('VS')).not.toBeInTheDocument();
  });
});
