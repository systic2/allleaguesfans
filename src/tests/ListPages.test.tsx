import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMatchesOnDate,
  fetchNextMatchDate,
  fetchPlayersPage,
  fetchTeamKoreanNames,
  fetchTeamsList,
} from '@/lib/api';
import { kstDate } from '@/lib/dates';
import MatchesPage from '@/pages/MatchesPage';
import PlayersPage from '@/pages/PlayersPage';
import TeamsPage from '@/pages/TeamsPage';

vi.mock('@/lib/api', () => ({
  fetchMatchesOnDate: vi.fn(),
  fetchNextMatchDate: vi.fn(),
  fetchPlayersPage: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
  fetchTeamsList: vi.fn(),
  PLAYER_PAGE_SIZE: 25,
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="crest">{alt}</span>,
}));

const mockFetchMatches = vi.mocked(fetchMatchesOnDate);
const mockFetchNextDate = vi.mocked(fetchNextMatchDate);
const mockFetchPlayers = vi.mocked(fetchPlayersPage);
const mockFetchTeamNames = vi.mocked(fetchTeamKoreanNames);
const mockFetchTeams = vi.mocked(fetchTeamsList);

function renderPage(page: React.ReactNode, initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const teams = [
  { team_id: '1', team_name: 'Ulsan HD FC', crest_url: 'u.png', league_id: '4689', season: '2026', rank: 1 },
  { team_id: '2', team_name: 'Jeonbuk Hyundai', crest_url: null, league_id: '4689', season: '2026', rank: 2 },
  { team_id: '10', team_name: 'Arsenal', crest_url: 'a.png', league_id: '4328', season: '2026', rank: 1 },
  { team_id: '133612', team_name: 'Manchester United', crest_url: null, league_id: '4328', season: '2026', rank: 2 },
];

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="current location">{location.pathname}{location.search}</output>;
}

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTeams.mockResolvedValue(teams);
    mockFetchTeamNames.mockResolvedValue({ '1': '울산 HD', '10': '아스널' });
  });

  it('filters Korean and English names and shows league season, count, and team links', async () => {
    renderPage(<TeamsPage />, '/teams?league=premier-league&q=아스널');

    const section = await screen.findByRole('region', { name: '프리미어리그' });
    expect(within(section).getByText('2026/27 시즌 · 1팀')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /아스널 Arsenal/ })).toHaveAttribute('href', '/teams/10');
    expect(screen.queryByText('울산 HD')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '팀 이름' }), { target: { value: 'Arsenal' } });
    expect(await within(section).findByText('아스널')).toBeInTheDocument();
  });

  it('finds a team by alias and explains an unsupported league', async () => {
    const { unmount } = renderPage(<TeamsPage />, '/teams?q=맨유');
    expect(await screen.findByRole('link', { name: /Manchester United/ })).toHaveAttribute('href', '/teams/133612');
    unmount();

    renderPage(<TeamsPage />, '/teams?league=not-supported');
    expect(await screen.findByText(/지원하지 않는 리그입니다/)).toBeInTheDocument();
  });
});

describe('PlayersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTeams.mockResolvedValue(teams);
    mockFetchTeamNames.mockResolvedValue({ '1': '울산 HD' });
    mockFetchPlayers.mockResolvedValue({ rows: [], total: 0 });
  });

  it('renders the current-roster table, Korean position, missing values, count, and pagination', async () => {
    mockFetchPlayers.mockResolvedValue({
      total: 26,
      rows: [{
        id: 'p1', name: 'Kim Player', team_id: '1', team_name: 'Ulsan HD FC', position: 'Centre-Back',
        number: null, nationality: null, birth_date: '2000-01-01', photo_url: null,
      }],
    });
    renderPage(<PlayersPage />, '/players?page=2');

    expect(screen.getByText('현재 선수단 기준입니다. 시즌별 명단은 아직 제공하지 않습니다.')).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: '선수 목록' });
    expect(within(table).getByRole('link', { name: /Kim Player/ })).toHaveAttribute('href', '/players/p1');
    expect(within(table).getByRole('link', { name: '울산 HD' })).toHaveAttribute('href', '/teams/1');
    expect(within(table).getByText('수비수')).toHaveAttribute('title', 'Centre-Back');
    expect(within(table).getAllByText('-')).toHaveLength(2);
    expect(screen.getByText('총 26명')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(mockFetchPlayers).toHaveBeenCalledWith({
      teamIds: undefined, position: null, q: '', sort: 'name', page: 2,
    });
  });

  it('waits for league teams and then queries only their team IDs', async () => {
    let resolveTeams!: (value: typeof teams) => void;
    mockFetchTeams.mockReturnValue(new Promise((resolve) => { resolveTeams = resolve; }));
    renderPage(<PlayersPage />, '/players?league=k-league-1&position=FW');

    expect(screen.getByText('로딩중…')).toBeInTheDocument();
    expect(mockFetchPlayers).not.toHaveBeenCalled();

    await act(async () => resolveTeams(teams));
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith({
      teamIds: ['1', '2'], position: 'FW', q: '', sort: 'name', page: 1,
    }));
  });

  it('debounces the name URL filter and clears the page number', async () => {
    renderPage(<PlayersPage />, '/players?q=old&page=2');
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ q: 'old', page: 2 })));
    mockFetchPlayers.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: '선수 이름' }), { target: { value: '  Son  ' } });
    expect(mockFetchPlayers).not.toHaveBeenCalled();
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ q: 'Son', page: 1 })), { timeout: 1000 });
  });

  it.each(['1.5', 'Infinity', '0'])('normalizes invalid page %s to page 1', async (page) => {
    renderPage(<PlayersPage />, `/players?page=${page}`);
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
  });

  it('does not query players for an unsupported league', async () => {
    renderPage(<PlayersPage />, '/players?league=not-supported');
    expect(await screen.findByText(/지원하지 않는 리그입니다/)).toBeInTheDocument();
    expect(mockFetchPlayers).not.toHaveBeenCalled();
  });

  it('uses a selected team only when it belongs to the selected league', async () => {
    const { unmount } = renderPage(<PlayersPage />, '/players?league=k-league-1&team=1');
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ teamIds: ['1'] })));
    unmount();

    vi.clearAllMocks();
    mockFetchTeams.mockResolvedValue(teams);
    mockFetchTeamNames.mockResolvedValue({});
    mockFetchPlayers.mockResolvedValue({ rows: [], total: 0 });
    renderPage(<PlayersPage />, '/players?league=k-league-1&team=10');
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ teamIds: [] })));
  });

  it('replaces an out-of-range page with the last page when the row set is empty', async () => {
    mockFetchPlayers.mockImplementation(async ({ page }) => page === 99
      ? { rows: [], total: 26 }
      : {
          rows: [{
            id: 'p-last', name: 'Last Player', team_id: null, team_name: null, position: null,
            number: null, nationality: null, birth_date: null, photo_url: null,
          }],
          total: 26,
        });
    renderPage(<><PlayersPage /><CurrentLocation /></>, '/players?page=99');

    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
    expect(screen.getByLabelText('current location')).toHaveTextContent('/players?page=2');
    expect(await screen.findByText('Last Player')).toBeInTheDocument();
  });

  it('does not update the query when only surrounding name whitespace changes', async () => {
    renderPage(<><PlayersPage /><CurrentLocation /></>, '/players?q=Son&page=2');
    await waitFor(() => expect(mockFetchPlayers).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('searchbox', { name: '선수 이름' }), { target: { value: '  Son  ' } });
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(mockFetchPlayers).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('current location')).toHaveTextContent('/players?q=Son&page=2');
  });

  it('disables the retained player table while the next page is loading', async () => {
    let resolveNext!: (value: { rows: []; total: number }) => void;
    mockFetchPlayers.mockImplementation(({ page }) => page === 1
      ? Promise.resolve({
          rows: [{
            id: 'p1', name: 'Kim Player', team_id: null, team_name: null, position: null,
            number: null, nationality: null, birth_date: null, photo_url: null,
          }],
          total: 26,
        })
      : new Promise((resolve) => { resolveNext = resolve; }));
    renderPage(<PlayersPage />, '/players');
    const table = await screen.findByRole('table', { name: '선수 목록' });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(table.parentElement).toHaveAttribute('inert'));
    expect(table.parentElement).toHaveClass('opacity-60');
    expect(table.parentElement).toHaveAttribute('aria-busy', 'true');
    expect(table.parentElement).not.toHaveClass('pointer-events-none');

    await act(async () => resolveNext({ rows: [], total: 26 }));
  });

  it('remembers a failed player photo src and retries when the photo URL changes', async () => {
    mockFetchPlayers.mockImplementation(async ({ page }) => ({
      rows: [{
        id: 'p1', name: 'Kim Player', team_id: null, team_name: null, position: null,
        number: null, nationality: null, birth_date: null,
        photo_url: page === 3 ? 'working.png' : 'broken.png',
      }],
      total: 75,
    }));
    const { container } = renderPage(<PlayersPage />, '/players');
    const photo = await waitFor(() => {
      const image = container.querySelector('img[src="broken.png"]');
      expect(image).not.toBeNull();
      return image!;
    });
    fireEvent.error(photo);
    expect(screen.getByRole('link', { name: /Kim Player/ })).toHaveTextContent('K');

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(container.querySelector('img[src="broken.png"]')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kim Player/ })).toHaveTextContent('K');

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(container.querySelector('img[src="working.png"]')).toBeInTheDocument();
  });
});

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMatches.mockResolvedValue([]);
    mockFetchNextDate.mockResolvedValue(null);
    mockFetchTeamNames.mockResolvedValue({});
  });

  it('groups matches by league and renders scheduled time, live/finished labels, scores, and VS', async () => {
    mockFetchMatches.mockResolvedValue([
      {
        id: 'scheduled', leagueId: '4689', date: '2026-11-18T10:00:00.000Z', status: 'SCHEDULED',
        homeTeamId: '1', awayTeamId: '2', homeScore: 0, awayScore: 0,
        homeTeam: { id: '1', name: 'Ulsan', badgeUrl: null }, awayTeam: { id: '2', name: 'Jeonbuk', badgeUrl: null },
      },
      {
        id: 'live', leagueId: '4328', date: '2026-11-18T11:00:00.000Z', status: 'HT',
        homeTeamId: '10', awayTeamId: '11', homeScore: 1, awayScore: 0,
        homeTeam: { id: '10', name: 'Arsenal', badgeUrl: null }, awayTeam: { id: '11', name: 'Chelsea', badgeUrl: null },
      },
      {
        id: 'finished', leagueId: '4328', date: '2026-11-18T12:00:00.000Z', status: 'FT',
        homeTeamId: '12', awayTeamId: '13', homeScore: 2, awayScore: 2,
        homeTeam: { id: '12', name: 'Liverpool', badgeUrl: null }, awayTeam: { id: '13', name: 'Everton', badgeUrl: null },
      },
    ] as any);
    renderPage(<MatchesPage />, '/matches?date=2026-11-18');

    const kLeague = await screen.findByRole('region', { name: 'K리그1' });
    const premierLeague = screen.getByRole('region', { name: '프리미어리그' });
    expect(within(kLeague).getByText('19:00')).toBeInTheDocument();
    expect(within(kLeague).getByRole('link', { name: '경기 상세' })).toHaveTextContent('VS');
    expect(within(premierLeague).getByText('하프타임')).toBeInTheDocument();
    expect(within(premierLeague).getByText('경기 종료')).toBeInTheDocument();
    const premierScores = within(premierLeague).getAllByRole('link', { name: '경기 상세' });
    expect(premierScores[0]).toHaveTextContent('1 - 0');
    expect(premierScores[1]).toHaveTextContent('2 - 2');
    const statusButtons = within(screen.getByRole('group', { name: '경기 상태' })).getAllByRole('button');
    expect(statusButtons[0]).toHaveTextContent('전체');
    expect(statusButtons[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('normalizes an invalid date and sends league/status filters from controls', async () => {
    renderPage(<MatchesPage />, '/matches?date=invalid&league=premier-league');
    await waitFor(() => expect(mockFetchMatches).toHaveBeenCalledWith(kstDate(), { leagueId: '4328', phase: null }));

    fireEvent.click(screen.getByRole('button', { name: 'LIVE' }));
    await waitFor(() => expect(mockFetchMatches).toHaveBeenCalledWith(kstDate(), { leagueId: '4328', phase: 'live' }));
    expect(screen.getByRole('button', { name: 'LIVE' })).toHaveAttribute('aria-pressed', 'true');
  });

  it("shows '일정 미정' instead of a time for an UNKNOWN match", async () => {
    mockFetchMatches.mockResolvedValue([{
      id: 'unknown', leagueId: '4689', date: '2026-11-18T10:00:00.000Z', status: 'UNKNOWN',
      homeTeamId: '1', awayTeamId: '2', homeScore: null, awayScore: null,
      homeTeam: { id: '1', name: 'Ulsan', badgeUrl: null },
      awayTeam: { id: '2', name: 'Jeonbuk', badgeUrl: null },
    }] as any);
    renderPage(<MatchesPage />, '/matches?date=2026-11-18');

    const league = await screen.findByRole('region', { name: 'K리그1' });
    expect(within(league).getByText('일정 미정')).toBeInTheDocument();
    expect(within(league).queryByText('19:00')).not.toBeInTheDocument();
  });

  it('offers the nearest date only for an empty all/scheduled result and navigates to it', async () => {
    mockFetchNextDate.mockResolvedValue('2026-11-20');
    renderPage(<MatchesPage />, '/matches?date=2026-11-18&status=scheduled');

    expect(await screen.findByText('이 날짜에 예정 경기가 없습니다.')).toBeInTheDocument();
    expect(mockFetchNextDate).toHaveBeenCalledWith('2026-11-18', null, 'scheduled');
    fireEvent.click(await screen.findByRole('button', { name: /가장 가까운 경기:/ }));
    await waitFor(() => expect(mockFetchMatches).toHaveBeenCalledWith('2026-11-20', { leagueId: null, phase: 'scheduled' }));
  });

  it('uses no phase for the nearest date in the all-status view', async () => {
    renderPage(<MatchesPage />, '/matches?date=2026-11-18');
    await waitFor(() => expect(mockFetchNextDate).toHaveBeenCalledWith('2026-11-18', null, null));
  });

  it('does not query matches for an unsupported league', async () => {
    renderPage(<MatchesPage />, '/matches?league=not-supported');
    expect(await screen.findByText(/지원하지 않는 리그입니다/)).toBeInTheDocument();
    expect(mockFetchMatches).not.toHaveBeenCalled();
    expect(mockFetchNextDate).not.toHaveBeenCalled();
  });

  it('removes the previous date results while the next date is loading', async () => {
    let resolveNext!: (value: []) => void;
    mockFetchMatches
      .mockResolvedValueOnce([{
        id: 'old-match', leagueId: '4689', date: '2026-11-18T10:00:00.000Z', status: 'SCHEDULED',
        homeTeamId: '1', awayTeamId: '2', homeScore: null, awayScore: null,
        homeTeam: { id: '1', name: 'Old Home', badgeUrl: null },
        awayTeam: { id: '2', name: 'Old Away', badgeUrl: null },
      }] as any)
      .mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }));
    renderPage(<MatchesPage />, '/matches?date=2026-11-18');
    expect(await screen.findByText('Old Home')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음날' }));
    expect(await screen.findByText('로딩중…')).toBeInTheDocument();
    expect(screen.queryByText('Old Home')).not.toBeInTheDocument();

    await act(async () => resolveNext([]));
  });

});
