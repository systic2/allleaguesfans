import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNearbyStandings,
  fetchPlayersByTeam,
  fetchTeamDetails,
  fetchTeamFormGuide,
  fetchTeamKoreanNames,
  fetchTeamStandingsData,
  fetchTeamTrophyCount,
  type TeamDetails,
} from '@/lib/api';
import {
  fetchTeamFixtures,
  type MatchWithTeams,
} from '@/lib/thesportsdb-api';
import TeamPageDB from '@/pages/TeamPageDB';

vi.mock('@/lib/api', () => ({
  fetchNearbyStandings: vi.fn(),
  fetchPlayersByTeam: vi.fn(),
  fetchTeamDetails: vi.fn(),
  fetchTeamFormGuide: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
  fetchTeamStandingsData: vi.fn(),
  fetchTeamTrophyCount: vi.fn(),
}));

vi.mock('@/lib/thesportsdb-api', () => ({
  fetchTeamFixtures: vi.fn(),
}));

vi.mock('@/components/TeamLineup', () => ({
  default: () => <div data-testid="team-lineup" />,
}));

vi.mock('@/components/TeamRoster', () => ({
  default: () => <div data-testid="team-roster" />,
}));

vi.mock('@/components/FMSubNav', () => ({
  default: () => <nav data-testid="fm-sub-nav" />,
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: () => <span data-testid="crest-img" />,
}));

const mockFetchNearbyStandings = vi.mocked(fetchNearbyStandings);
const mockFetchPlayersByTeam = vi.mocked(fetchPlayersByTeam);
const mockFetchTeamDetails = vi.mocked(fetchTeamDetails);
const mockFetchTeamFormGuide = vi.mocked(fetchTeamFormGuide);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);
const mockFetchTeamStandingsData = vi.mocked(fetchTeamStandingsData);
const mockFetchTeamTrophyCount = vi.mocked(fetchTeamTrophyCount);
const mockFetchTeamFixtures = vi.mocked(fetchTeamFixtures);

const team: TeamDetails = {
  id: 'team-1',
  name: 'Seoul Test FC',
  nameKorean: '서울 테스트 FC',
  badgeUrl: null,
  currentLeagueId: '4689',
  currentSeason: '2025',
};

const baseMatch = {
  leagueId: '4689',
  season: '2025',
  round: '1',
  venueName: 'Test Ground',
  sourceIds: { thesportsdb: 'source-match' },
} satisfies Partial<MatchWithTeams>;

const upcomingAwayMatch: MatchWithTeams = {
  ...baseMatch,
  id: 'upcoming-away',
  date: '2026-04-01T10:00:00.000Z',
  status: 'SCHEDULED',
  homeTeamId: 'opponent-home',
  awayTeamId: 'team-1',
  homeTeam: {
    id: 'opponent-home',
    name: 'English Home Opponent',
    badgeUrl: '/opponent-home-badge.png',
    sourceIds: {},
  },
  awayTeam: {
    id: 'team-1',
    name: 'Seoul Test FC',
    badgeUrl: '/team-badge.png',
    sourceIds: {},
  },
};

const recentHomeMatch: MatchWithTeams = {
  ...baseMatch,
  id: 'recent-home',
  date: '2026-03-20T10:00:00.000Z',
  status: 'FINISHED',
  homeTeamId: 'team-1',
  awayTeamId: 'opponent-away',
  homeScore: 2,
  awayScore: 0,
  homeTeam: {
    id: 'team-1',
    name: 'Seoul Test FC',
    badgeUrl: '/team-badge.png',
    sourceIds: {},
  },
  awayTeam: {
    id: 'opponent-away',
    name: 'English Away Opponent',
    badgeUrl: '/opponent-away-badge.png',
    sourceIds: {},
  },
};

const recentAwayMatch: MatchWithTeams = {
  ...baseMatch,
  id: 'recent-away',
  date: '2026-03-10T10:00:00.000Z',
  status: 'FINISHED',
  homeTeamId: 'opponent-second-home',
  awayTeamId: 'team-1',
  homeScore: 1,
  awayScore: 1,
  homeTeam: {
    id: 'opponent-second-home',
    name: 'English Second Home',
    badgeUrl: '/opponent-second-home-badge.png',
    sourceIds: {},
  },
  awayTeam: {
    id: 'team-1',
    name: 'Seoul Test FC',
    badgeUrl: '/team-badge.png',
    sourceIds: {},
  },
};

function renderTeamPage(initialEntry = '/teams/team-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/teams/:id" element={<TeamPageDB />} />
          <Route path="/matches/:id" element={<div>Match detail marker</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPageDB', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockFetchNearbyStandings.mockReset();
    mockFetchPlayersByTeam.mockReset();
    mockFetchTeamDetails.mockReset();
    mockFetchTeamFormGuide.mockReset();
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamStandingsData.mockReset();
    mockFetchTeamTrophyCount.mockReset();
    mockFetchTeamFixtures.mockReset();

    mockFetchNearbyStandings.mockResolvedValue([]);
    mockFetchPlayersByTeam.mockResolvedValue([]);
    mockFetchTeamFormGuide.mockResolvedValue([]);
    mockFetchTeamKoreanNames.mockResolvedValue({});
    mockFetchTeamStandingsData.mockResolvedValue(null);
    mockFetchTeamTrophyCount.mockResolvedValue(0);
    mockFetchTeamFixtures.mockResolvedValue({ upcoming: [], recent: [] });
  });

  it('shows the Korean team name with the English name as its subtitle', async () => {
    mockFetchTeamDetails.mockResolvedValue(team);

    renderTeamPage();

    expect(await screen.findByRole('heading', { level: 1, name: '서울 테스트 FC' })).toBeInTheDocument();
    expect(screen.getByText('Seoul Test FC')).toBeInTheDocument();
  });

  it('uses the English name as the header when nameKorean is null', async () => {
    mockFetchTeamDetails.mockResolvedValue({ ...team, nameKorean: null });

    renderTeamPage();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Seoul Test FC' });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByText('Seoul Test FC')).toHaveLength(2);
    expect(screen.queryByText('서울 테스트 FC')).not.toBeInTheDocument();
  });

  it("uses the team's latest season for team data and the league's in-progress season for trophies", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    mockFetchTeamDetails.mockResolvedValue(team);

    renderTeamPage();

    await waitFor(() => {
      expect(mockFetchPlayersByTeam).toHaveBeenCalledWith('team-1', '2025');
      expect(mockFetchTeamFormGuide).toHaveBeenCalledWith('team-1', '2025', 5);
      expect(mockFetchNearbyStandings).toHaveBeenCalledWith('4689', '2025', 'team-1');
      expect(mockFetchTeamStandingsData).toHaveBeenCalledWith('4689', '2025', 'Seoul Test FC');
      expect(mockFetchTeamTrophyCount).toHaveBeenCalledWith('team-1', '2026');
    });
  });

  it('gates season- and league-dependent queries until details load but starts fixtures from the route id', async () => {
    let resolveTeam!: (value: TeamDetails | null) => void;
    mockFetchTeamDetails.mockReturnValue(new Promise((resolve) => {
      resolveTeam = resolve;
    }));

    renderTeamPage();

    await waitFor(() => {
      expect(mockFetchTeamFixtures).toHaveBeenCalledWith('team-1');
    });
    expect(mockFetchPlayersByTeam).not.toHaveBeenCalled();
    expect(mockFetchTeamFormGuide).not.toHaveBeenCalled();
    expect(mockFetchNearbyStandings).not.toHaveBeenCalled();
    expect(mockFetchTeamStandingsData).not.toHaveBeenCalled();
    expect(mockFetchTeamTrophyCount).not.toHaveBeenCalled();
    expect(mockFetchTeamFixtures).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveTeam(null);
    });

    expect(await screen.findByText('팀을 찾을 수 없습니다.')).toBeInTheDocument();
    expect(mockFetchPlayersByTeam).not.toHaveBeenCalled();
    expect(mockFetchTeamFormGuide).not.toHaveBeenCalled();
    expect(mockFetchNearbyStandings).not.toHaveBeenCalled();
    expect(mockFetchTeamStandingsData).not.toHaveBeenCalled();
    expect(mockFetchTeamTrophyCount).not.toHaveBeenCalled();
  });

  it('renders the recent W/D/L form returned by the API', async () => {
    mockFetchTeamDetails.mockResolvedValue(team);
    mockFetchTeamFormGuide.mockResolvedValue(['W', 'D', 'L']);

    renderTeamPage();

    expect(await screen.findByText('W')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('computes recent-result W/D/L badges from the team home or away perspective', async () => {
    mockFetchTeamDetails.mockResolvedValue(team);
    mockFetchTeamFixtures.mockResolvedValue({
      upcoming: [],
      recent: [
        {
          ...recentHomeMatch,
          id: 'home-loss',
          homeScore: 0,
          awayScore: 2,
        },
        {
          ...recentAwayMatch,
          id: 'away-win',
          homeScore: 1,
          awayScore: 3,
        },
        {
          ...recentHomeMatch,
          id: 'home-draw',
          homeScore: 2,
          awayScore: 2,
          awayTeamId: 'opponent-draw',
          awayTeam: {
            id: 'opponent-draw',
            name: 'English Draw Opponent',
            badgeUrl: '/opponent-draw-badge.png',
            sourceIds: {},
          },
        },
      ],
    });

    renderTeamPage();

    const homeLossOpponent = await screen.findByText('English Away Opponent');
    const awayWinOpponent = screen.getByText('English Second Home');
    const drawOpponent = screen.getByText('English Draw Opponent');
    expect(within(homeLossOpponent.parentElement!).getByText('L')).toBeInTheDocument();
    expect(within(awayWinOpponent.parentElement!).getByText('W')).toBeInTheDocument();
    expect(within(drawOpponent.parentElement!).getByText('D')).toBeInTheDocument();
  });

  it('uses Korean opponent names keyed to the correct home and away ids in fixtures', async () => {
    mockFetchTeamDetails.mockResolvedValue(team);
    mockFetchTeamKoreanNames.mockResolvedValue({
      'opponent-home': '홈 상대 한글명',
      'opponent-away': '원정 상대 한글명',
      'opponent-second-home': '두 번째 홈 상대',
      'team-1': '서울 테스트 FC',
    });
    mockFetchTeamFixtures.mockResolvedValue({
      upcoming: [upcomingAwayMatch],
      recent: [recentHomeMatch, recentAwayMatch],
    });

    renderTeamPage('/teams/team-1?tab=fixtures');

    expect(await screen.findByText('홈 상대 한글명')).toBeInTheDocument();
    expect(screen.getByText('원정 상대 한글명')).toBeInTheDocument();
    expect(screen.getByText('두 번째 홈 상대')).toBeInTheDocument();
    expect(screen.queryByText('English Home Opponent')).not.toBeInTheDocument();
    expect(screen.queryByText('English Away Opponent')).not.toBeInTheDocument();
    expect(screen.queryByText('English Second Home')).not.toBeInTheDocument();
  });

  it('navigates to the selected match from a fixtures-tab row', async () => {
    mockFetchTeamDetails.mockResolvedValue(team);
    mockFetchTeamFixtures.mockResolvedValue({
      upcoming: [upcomingAwayMatch],
      recent: [],
    });

    renderTeamPage('/teams/team-1?tab=fixtures');

    const matchRow = await screen.findByRole('link', { name: /English Home Opponent/ });
    fireEvent.click(matchRow);
    expect(await screen.findByText('Match detail marker')).toBeInTheDocument();
  });

  it('shows the not-found state when team details return null', async () => {
    mockFetchTeamDetails.mockResolvedValue(null);

    renderTeamPage();

    expect(await screen.findByText('팀을 찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument();
  });
});
