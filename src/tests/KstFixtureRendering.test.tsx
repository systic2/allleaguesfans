import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FMFixtures from '@/components/fm/FMFixtures';
import UpcomingFixtures from '@/components/UpcomingFixtures';
import {
  fetchAllUpcomingFixtures,
  fetchLeagueUpcomingFixtures,
  type MatchWithTeams,
} from '@/lib/thesportsdb-api';

vi.mock('@/lib/thesportsdb-api', () => ({
  fetchAllUpcomingFixtures: vi.fn(),
  fetchLeagueUpcomingFixtures: vi.fn(),
}));

vi.mock('@/hooks/useTeamName', () => ({
  useTeamName: () => (_teamId: string, fallback: string) => fallback,
}));

const mockFetchAllUpcomingFixtures = vi.mocked(fetchAllUpcomingFixtures);
const mockFetchLeagueUpcomingFixtures = vi.mocked(fetchLeagueUpcomingFixtures);

function fixture(overrides: Partial<MatchWithTeams> = {}): MatchWithTeams {
  return {
    id: 'fixture-1',
    leagueId: '4689',
    season: '2026',
    round: '1',
    date: '2026-11-21T15:30:00.000Z',
    status: 'SCHEDULED',
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    sourceIds: {},
    homeTeam: { id: 'home-1', name: 'Home FC', sourceIds: {} },
    awayTeam: { id: 'away-1', name: 'Away FC', sourceIds: {} },
    ...overrides,
  };
}

function renderUpcoming(fixtures: MatchWithTeams[]) {
  mockFetchAllUpcomingFixtures.mockResolvedValue(fixtures);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UpcomingFixtures />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('KST fixture rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.clearAllMocks();
    mockFetchLeagueUpcomingFixtures.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an FM fixture in Korea date and time across the UTC day boundary', () => {
    render(
      <MemoryRouter>
        <FMFixtures fixtures={[fixture()]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('11. 22. (일)')).toBeInTheDocument();
    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('labels a post-midnight KST kickoff as tomorrow before KST midnight', async () => {
    vi.setSystemTime(new Date('2026-11-21T14:30:00.000Z'));

    renderUpcoming([fixture()]);

    expect(await screen.findByText('내일 00:30')).toBeInTheDocument();
  });

  it('labels today, tomorrow, and later fixtures by KST date after KST midnight', async () => {
    vi.setSystemTime(new Date('2026-11-21T16:00:00.000Z'));

    renderUpcoming([
      fixture(),
      fixture({ id: 'fixture-2', date: '2026-11-22T15:30:00.000Z' }),
      fixture({ id: 'fixture-3', date: '2026-11-23T15:30:00.000Z' }),
    ]);

    expect(await screen.findByText('오늘 00:30')).toBeInTheDocument();
    expect(screen.getByText('내일 00:30')).toBeInTheDocument();
    expect(screen.getByText('11월 24일 00:30')).toBeInTheDocument();
  });

  it.each<[string, Partial<MatchWithTeams>]>([
    ['a null date', { date: null as unknown as MatchWithTeams['date'] }],
    ['an empty date', { date: '' }],
    ['an invalid date', { date: 'not-a-date' }],
    ['an unknown status', { status: 'UNKNOWN' }],
  ])('shows 일정 미정 without crashing for %s', async (_case, overrides) => {
    renderUpcoming([fixture(overrides)]);

    expect(await screen.findByText('일정 미정')).toBeInTheDocument();
  });
});
