import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLeagueLeaders,
  fetchMatchesInRange,
  fetchMatchesOnDate,
  fetchNextMatchDate,
  fetchSyncStatus,
  fetchTeamKoreanNames,
} from '@/lib/api';
import { useFavorites } from '@/hooks/useFavorites';
import type { Favorite } from '@/lib/favorites';
import type { MatchWithTeams } from '@/lib/thesportsdb-api';
import HomePage from '@/pages/HomePage';

vi.mock('@/lib/api', () => ({
  fetchLeagueLeaders: vi.fn(),
  fetchMatchesInRange: vi.fn(),
  fetchMatchesOnDate: vi.fn(),
  fetchNextMatchDate: vi.fn(),
  fetchSyncStatus: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: vi.fn(),
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="crest">{alt}</span>,
}));

const mockFetchLeaders = vi.mocked(fetchLeagueLeaders);
const mockFetchRange = vi.mocked(fetchMatchesInRange);
const mockFetchToday = vi.mocked(fetchMatchesOnDate);
const mockFetchNextDate = vi.mocked(fetchNextMatchDate);
const mockFetchSyncStatus = vi.mocked(fetchSyncStatus);
const mockFetchTeamNames = vi.mocked(fetchTeamKoreanNames);
const mockUseFavorites = vi.mocked(useFavorites);

function team(id: string, name: string): NonNullable<MatchWithTeams['homeTeam']> {
  return { id, name, sourceIds: {} };
}

function favoritesResult(favorites: Favorite[]): ReturnType<typeof useFavorites> {
  return {
    favorites,
    persistent: true,
    toggle: vi.fn((_item: Omit<Favorite, 'addedAt'>) => 'added' as const),
    remove: vi.fn(),
    refreshMeta: vi.fn(),
    isFavorite: vi.fn(() => false),
  };
}

function match(overrides: Partial<MatchWithTeams> = {}): MatchWithTeams {
  return {
    id: 'm1',
    leagueId: '4689',
    season: '2026',
    date: '2026-11-21T10:00:00.000Z',
    status: 'SCHEDULED',
    homeTeamId: '1',
    awayTeamId: '2',
    sourceIds: {},
    homeTeam: team('1', 'Ulsan'),
    awayTeam: team('2', 'Jeonbuk'),
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient };
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-21T00:00:00.000Z'));
    vi.clearAllMocks();
    mockUseFavorites.mockReturnValue(favoritesResult([]));
    mockFetchTeamNames.mockResolvedValue({ '1': '울산 HD', '11': '리버풀' });
    mockFetchToday.mockResolvedValue([]);
    mockFetchNextDate.mockResolvedValue(null);
    mockFetchLeaders.mockResolvedValue([]);
    mockFetchRange.mockResolvedValue([]);
    mockFetchSyncStatus.mockResolvedValue({
      events: '2026-11-20T22:00:00.000Z',
      standings: '2026-11-20T19:00:00.000Z',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('renders all independent home sections, data rows, empty-favorites guidance, and freshness labels', async () => {
    const todayMatch = match();
    const weekMatch = match({ id: 'week', date: '2026-11-22T06:00:00.000Z', homeTeamId: '3', awayTeamId: '4', homeTeam: team('3', 'Seoul'), awayTeam: team('4', 'Pohang') });
    const recentMatch = match({ id: 'recent', date: '2026-11-20T10:00:00.000Z', status: 'FINISHED', homeScore: 2, awayScore: 1 });
    mockFetchToday.mockResolvedValue([todayMatch]);
    mockFetchLeaders.mockResolvedValue([
      { league_id: '4689', season: '2026', rank: 1, team_id: '1', team_name: 'Ulsan', crest_url: null, played: 12, points: 28 },
      { league_id: '4328', season: '2026', rank: 1, team_id: '11', team_name: 'Liverpool', crest_url: null, played: null, points: null },
    ]);
    mockFetchRange.mockImplementation(async (_from, _to, opts = {}) => opts.descending ? [recentMatch] : [weekMatch]);

    renderPage();

    expect(screen.getByRole('heading', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByText(/즐겨찾기한 팀이 없습니다/)).toBeInTheDocument();
    const today = await screen.findByRole('region', { name: /오늘 경기/ });
    expect(await within(today).findByRole('link', { name: '경기 상세' })).toHaveAttribute('href', '/matches/m1');
    expect(await within(today).findByText('울산 HD')).toBeInTheDocument();

    const leaders = screen.getByRole('region', { name: '리그별 1~4위' });
    expect(await within(leaders).findByRole('link', { name: '울산 HD' })).toHaveAttribute('href', '/teams/1');
    expect(within(leaders).getByRole('link', { name: '리버풀' })).toHaveAttribute('href', '/teams/11');
    expect(within(leaders).getAllByText('-')).toHaveLength(2);

    const week = screen.getByRole('region', { name: '이번 주 경기' });
    expect(within(week).getByRole('link', { name: /11월 22일/ })).toHaveAttribute('href', '/matches?date=2026-11-22');
    expect(within(week).getByText('Seoul')).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: '최근 결과' });
    expect(within(recent).getByText('2 - 1')).toBeInTheDocument();

    expect(screen.getAllByText('기준 11월 21일 07:00')).toHaveLength(3);
    expect(screen.getByText('기준 11월 21일 04:00 · 갱신 지연')).toBeInTheDocument();
    expect(mockFetchToday).toHaveBeenCalledWith('2026-11-21', { leagueId: null, phase: null });
    expect(mockFetchLeaders).toHaveBeenCalledWith(4);
    expect(mockFetchRange).toHaveBeenCalledWith('2026-11-22', '2026-11-27', { limit: 30 });
    expect(mockFetchRange).toHaveBeenCalledWith('2026-11-15', '2026-11-21', { phases: ['finished'], descending: true, limit: 30 });
    expect(mockFetchNextDate).not.toHaveBeenCalled();
    expect(mockFetchToday).toHaveBeenCalledTimes(1);
  });

  it('fetches sync status once on initial render for all freshness labels', async () => {
    renderPage();

    expect(await screen.findAllByText('기준 11월 21일 07:00')).toHaveLength(3);
    expect(screen.getByText('기준 11월 21일 04:00 · 갱신 지연')).toBeInTheDocument();
    expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
  });

  it('removes the stale marker when the five-minute refetch returns a newer sync time', async () => {
    mockFetchSyncStatus
      .mockResolvedValueOnce({
        events: '2026-11-20T19:00:00.000Z',
        standings: '2026-11-20T19:00:00.000Z',
      })
      .mockResolvedValueOnce({
        events: '2026-11-20T23:00:00.000Z',
        standings: '2026-11-20T23:00:00.000Z',
      });

    renderPage();

    expect(await screen.findAllByText('기준 11월 21일 04:00 · 갱신 지연')).toHaveLength(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    await waitFor(() => expect(mockFetchSyncStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('기준 11월 21일 08:00')).toHaveLength(4);
    expect(screen.queryByText(/갱신 지연/)).not.toBeInTheDocument();
  });

  it('keeps the previous freshness text when the five-minute refetch fails', async () => {
    mockFetchSyncStatus
      .mockResolvedValueOnce({
        events: '2026-11-20T22:00:00.000Z',
        standings: '2026-11-20T22:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('sync refetch failed'));

    const { queryClient } = renderPage();

    expect(await screen.findAllByText('기준 11월 21일 07:00')).toHaveLength(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(['sync-status'])?.status).toBe('error');
    });
    expect(await screen.findAllByText('기준 11월 21일 07:00')).toHaveLength(4);
    expect(screen.queryByText('기준 시각 확인 불가')).not.toBeInTheDocument();
  });

  it('marks sync status stale only when it is older than exactly 4 hours', async () => {
    mockFetchSyncStatus.mockResolvedValue({
      events: '2026-11-20T20:00:00.000Z',
      standings: '2026-11-20T19:59:59.999Z',
    });

    renderPage();

    expect(await screen.findAllByText('기준 11월 21일 05:00')).toHaveLength(3);
    expect(screen.getByText('기준 11월 21일 04:59 · 갱신 지연')).toBeInTheDocument();
  });

  it('marks sync status stale after the page stays open past the 4-hour boundary', async () => {
    mockFetchSyncStatus.mockResolvedValue({
      events: '2026-11-20T20:00:30.000Z',
      standings: '2026-11-20T20:00:30.000Z',
    });

    renderPage();

    expect(await screen.findAllByText('기준 11월 21일 05:00')).toHaveLength(4);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(await screen.findAllByText('기준 11월 21일 05:00 · 갱신 지연')).toHaveLength(4);
  });

  it('rechecks freshness when the page becomes visible after crossing the 4-hour boundary', async () => {
    mockFetchSyncStatus.mockResolvedValue({
      events: '2026-11-20T20:00:30.000Z',
      standings: '2026-11-20T20:00:30.000Z',
    });
    renderPage();

    expect(await screen.findAllByText('기준 11월 21일 05:00')).toHaveLength(4);

    vi.setSystemTime(new Date('2026-11-21T00:01:00.000Z'));
    const visibilityStateSpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(await screen.findAllByText('기준 11월 21일 05:00 · 갱신 지연')).toHaveLength(4);
    } finally {
      visibilityStateSpy.mockRestore();
    }
  });

  it('keeps successful sections visible when other section queries and sync status fail', async () => {
    mockFetchToday.mockRejectedValue(new Error('today failed'));
    mockFetchLeaders.mockRejectedValue(new Error('leaders failed'));
    mockFetchSyncStatus.mockRejectedValue(new Error('sync failed'));
    const recentMatch = match({ id: 'recent-ok', date: '2026-11-20T10:00:00.000Z', status: 'FINISHED', homeScore: 3, awayScore: 0 });
    mockFetchRange.mockImplementation(async (_from, _to, opts = {}) => {
      if (opts.descending) return [recentMatch];
      throw new Error('week failed');
    });

    renderPage();

    expect(await screen.findByText('오늘 경기를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('순위를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('이번 주 경기를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('3 - 0')).toBeInTheDocument();
    expect(screen.getAllByText('기준 시각 확인 불가')).toHaveLength(4);
  });

  it('loads recent and upcoming matches for team favorites only and renders each matching slot', async () => {
    mockUseFavorites.mockReturnValue(favoritesResult([
        { type: 'team', id: '1', name: 'Ulsan', image: 'u.png', addedAt: '2026-11-01T00:00:00Z' },
        { type: 'player', id: 'p1', name: 'Player', image: null, addedAt: '2026-11-02T00:00:00Z' },
    ]));
    const previous = match({ id: 'previous', date: '2026-11-20T10:00:00.000Z', status: 'FINISHED', homeScore: 1, awayScore: 0 });
    const next = match({ id: 'next', date: '2026-11-22T10:00:00.000Z' });
    mockFetchRange.mockImplementation(async (_from, _to, opts = {}) => {
      if (opts.teamIds && opts.phases?.includes('finished')) return [previous];
      if (opts.teamIds) return [next];
      return [];
    });

    renderPage();

    const favorites = await screen.findByRole('region', { name: '즐겨찾기 팀' });
    expect(await within(favorites).findByRole('link', { name: '울산 HD' })).toHaveAttribute('href', '/teams/1');
    expect(within(favorites).getByText('최근 결과')).toBeInTheDocument();
    expect(within(favorites).getByText('다음 경기')).toBeInTheDocument();
    expect(within(favorites).getByText('1 - 0')).toBeInTheDocument();
    expect(within(favorites).getByText('11. 20. (금)')).toBeInTheDocument();
    expect(within(favorites).getByText('11. 22. (일)')).toBeInTheDocument();
    expect(mockFetchRange).toHaveBeenCalledWith('2026-11-21', '2027-01-20', {
      teamIds: ['1'], phases: ['scheduled'], limit: 200,
    });
    expect(mockFetchRange).toHaveBeenCalledWith('2026-09-22', '2026-11-21', {
      teamIds: ['1'], phases: ['finished'], descending: true, limit: 200,
    });
  });

  it('shows the nearest match beyond the week when today is empty', async () => {
    mockFetchNextDate.mockResolvedValue('2026-11-30');
    mockFetchToday
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([match({ id: 'nearest', date: '2026-11-30T10:00:00.000Z' })]);

    const { queryClient } = renderPage();

    expect(await screen.findByText('오늘은 경기가 없습니다.')).toBeInTheDocument();
    await waitFor(() => expect(mockFetchNextDate).toHaveBeenCalledWith('2026-11-21', null, 'scheduled'));
    expect(queryClient.getQueryState(['next-match-date', '2026-11-21', null, 'scheduled'])).toBeDefined();
    expect(await screen.findByRole('link', { name: /가장 가까운 경기/ })).toHaveAttribute('href', '/matches?date=2026-11-30');
    await waitFor(() => expect(mockFetchToday).toHaveBeenCalledWith('2026-11-30', { leagueId: null, phase: null }));
    expect(screen.getByRole('link', { name: '경기 상세' })).toHaveAttribute('href', '/matches/nearest');
  });

  it('does not load or show a nearest-match error when the nearest date is within the week range', async () => {
    mockFetchNextDate.mockResolvedValue('2026-11-24');

    renderPage();

    expect(await screen.findByRole('link', { name: /가장 가까운 경기/ })).toHaveAttribute('href', '/matches?date=2026-11-24');
    await waitFor(() => expect(mockFetchNextDate).toHaveBeenCalledWith('2026-11-21', null, 'scheduled'));
    expect(mockFetchToday).toHaveBeenCalledTimes(1);
    expect(mockFetchToday).not.toHaveBeenCalledWith('2026-11-24', { leagueId: null, phase: null });
    expect(screen.queryByText('가장 가까운 경기를 불러오지 못했습니다.')).not.toBeInTheDocument();
  });

  it.each([
    {
      name: 'nearest-date lookup',
      arrange: () => mockFetchNextDate.mockRejectedValue(new Error('next date failed')),
    },
    {
      name: 'nearest-day matches lookup',
      arrange: () => {
        mockFetchNextDate.mockResolvedValue('2026-11-30');
        mockFetchToday
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(new Error('next matches failed'));
      },
    },
  ])('shows the nearest-match error when the $name fails', async ({ arrange }) => {
    arrange();

    renderPage();

    expect(await screen.findByText('가장 가까운 경기를 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
