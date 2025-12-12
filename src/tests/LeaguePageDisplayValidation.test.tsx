// src/tests/LeaguePageDisplayValidation.test.tsx
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LeaguePage from '../pages/LeaguePage';

// Mock React Router useParams to return correct slug
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ slug: "league-4001" }),
  };
});

// Mock API functions with realistic data
vi.mock('../lib/api', () => ({
  fetchLeagueBySlug: vi.fn(),
  fetchLeagueStandings: vi.fn(),
  fetchLeagueStats: vi.fn(),
  fetchTopScorers: vi.fn(),
  fetchTopAssists: vi.fn(),
  fetchHistoricalChampions: vi.fn(),
}));

// Mock TheSportsDB API to prevent network calls
vi.mock("../lib/thesportsdb-api", () => ({
  fetchLeagueFixtures: vi.fn().mockResolvedValue({
    recent: [],
    upcoming: []
  }),
  fetchKLeague1UpcomingFixtures: vi.fn().mockResolvedValue([]),
  fetchKLeague2UpcomingFixtures: vi.fn().mockResolvedValue([]),
  K_LEAGUE_IDS: {
    K_LEAGUE_1: "4689",
    K_LEAGUE_2: "4822"
  }
}));

// Mock Enhanced Standings API to prevent Highlightly API calls
vi.mock("../lib/enhanced-standings-api", () => ({
  fetchEnhancedLeagueStandings: vi.fn().mockResolvedValue([
    {
      team_id: 1,
      team_name: "Test Team 1",
      short_name: "TST1",
      crest_url: "https://example.com/test.png",
      rank: 1,
      points: 30,
      played: 15,
      win: 10,
      draw: 0,
      lose: 5,
      goals_for: 25,
      goals_against: 10,
      goals_diff: 15,
      form: "WWWWW",
    }
  ])
}));

// Import mocked functions after mocking
import * as api from '../lib/api';

// Mock data for testing
const mockLeagueData = {
  id: 4001,
  name: "K League 1",
  slug: "league-4001", 
  country: "South Korea",
  season: 2025,
};

const mockStandingsData = [
  {
    team_id: 1,
    team_name: "Test Team 1",
    rank: 1,
    points: 30,
    played: 15,
    win: 10,
    draw: 0,
    lose: 5
  }
];

describe('LeaguePage Display Validation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Clean up DOM before each test
    cleanup();
    
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
    
    // Setup default mock implementations
    (api.fetchLeagueBySlug as any).mockResolvedValue(mockLeagueData);
    (api.fetchLeagueStandings as any).mockResolvedValue(mockStandingsData);
    (api.fetchLeagueStats as any).mockResolvedValue({
      total_goals: 100,
      total_matches: 50,
      avg_goals_per_match: 2.0,
      total_teams: 12
    });
    (api.fetchTopScorers as any).mockResolvedValue([]);
    (api.fetchTopAssists as any).mockResolvedValue([]);
    (api.fetchHistoricalChampions as any).mockResolvedValue([]);
  });

  test('should render league page with valid data', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/leagues/league-4001']}>
          <LeaguePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for league data to load and check for league name
    await screen.findByText('K League 1');
    
    // Check for essential page elements using unique identifiers
    expect(screen.getByText('K League 1')).toBeInTheDocument();
    expect(screen.getByText('South Korea')).toBeInTheDocument();
    expect(screen.getByText('2025 시즌')).toBeInTheDocument();
  });

  test('should handle league not found gracefully', async () => {
    // Override the mock to return null for this specific test
    (api.fetchLeagueBySlug as any).mockResolvedValueOnce(null);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/leagues/league-9999']}>
          <LeaguePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should show error state for non-existent league
    // Use more specific selector to avoid multiple elements error
    const errorMessage = await screen.findByText('리그 정보를 불러올 수 없습니다.');
    expect(errorMessage).toBeInTheDocument();
  });
});