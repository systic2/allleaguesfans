import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchTeamDetails,
  fetchPlayersByTeam,
  fetchTeamUpcomingFixtures,
  fetchTeamRecentFixtures,
  fetchTeamFormGuide,
  TeamDetails,
  TeamPlayer,
  UpcomingFixture,
  RoundFixture,
} from '@/lib/api';

// Helper to create a mock chain for Supabase methods
const createMockSupabaseChain = (mockData: any, mockError: any = null) => {
  const mockChain: any = {};
  mockChain.select = vi.fn(() => mockChain);
  mockChain.eq = vi.fn(() => mockChain);
  mockChain.in = vi.fn(() => mockChain);
  mockChain.gte = vi.fn(() => mockChain);
  mockChain.lt = vi.fn(() => mockChain);
  mockChain.or = vi.fn(() => mockChain);
  mockChain.order = vi.fn(() => mockChain);
  mockChain.limit = vi.fn(() => mockChain); // limit also returns the chain to allow further methods like .then or .single

  // Mock terminal methods to resolve with the provided data/error
  mockChain.maybeSingle = vi.fn(() => Promise.resolve({ data: mockData, error: mockError }));
  mockChain.then = vi.fn((callback) => callback({ data: mockData, error: mockError })); // For when .select().then(...) is used
  mockChain.data = mockData; // Direct access if needed, though usually accessed via .then or maybeSingle
  mockChain.error = mockError;

  // The final method called in the chain, e.g., .limit() or .order(), directly returns a promise
  // So, we need to mock the promise resolution for these too.
  mockChain.returns = vi.fn(() => Promise.resolve({ data: mockData, error: mockError }));
  
  return mockChain;
};

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => createMockSupabaseChain(null)) as any, // Default chain behavior
  },
}));


const mockTeamId = '138106'; // Busan IPark ID
const mockSeason = 2025;
// Mock current year will be needed for fetchHistoricalChampions, but not these
// const mockCurrentYear = new Date().getFullYear(); 

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTeamDetails', () => {
    it('should fetch team details and current standing', async () => {
      const mockTeamData = {
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
      };
      const mockStandingData = {
        rank: 5,
        points: 45,
        gamesPlayed: 30,
        wins: 12,
        draws: 9,
        losses: 9,
        goalsFor: 40,
        goalsAgainst: 30,
        goalDifference: 10,
        leagueId: '4689', // K League 1
      };

      // Mock sequence for supabase.from calls
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockTeamData)); // teams_v2
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockStandingData)); // standings_v2

      const result: TeamDetails | null = await fetchTeamDetails(mockTeamId, mockSeason);

      expect(result).toEqual({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
        current_position: 5,
        points: 45,
        matches_played: 30,
        wins: 12,
        draws: 9,
        losses: 9,
        goals_for: 40,
        goals_against: 30,
        goal_difference: 10,
      });
      expect(supabase.from).toHaveBeenCalledWith('teams_v2');
      expect(supabase.from).toHaveBeenCalledWith('standings_v2');
    });

    it('should return null if team not found', async () => {
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(null)); // teams_v2 returns null

      const result = await fetchTeamDetails(mockTeamId, mockSeason);
      expect(result).toBeNull();
    });

    it('should fetch team details without standing if not found', async () => {
      const mockTeamData = {
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
      };

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockTeamData)); // teams_v2
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(null)); // standings_v2 returns null

      const result: TeamDetails | null = await fetchTeamDetails(mockTeamId, mockSeason);

      expect(result).toEqual({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
        current_position: null,
        points: null,
        matches_played: null,
        wins: null,
        draws: null,
        losses: null,
        goals_for: null,
        goals_against: null,
        goal_difference: null,
      });
    });
  });

  describe('fetchPlayersByTeam', () => {
    it('should fetch players with their statistics', async () => {
      const mockPlayersData = [
        { idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'FW', strNumber: '10' },
        { idPlayer: 'p2', strPlayer: 'Player Two', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'MF', strNumber: '8' },
      ];
      const mockStatsData = [
        { idPlayer: 'p1', goals: 5, assists: 3, appearances: 10, yellow_cards: 1, red_cards: 0 },
        { idPlayer: 'p2', goals: 2, assists: 7, appearances: 12, yellow_cards: 2, red_cards: 0 },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockPlayersData)); // players
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockStatsData)); // player_statistics

      const result: TeamPlayer[] = await fetchPlayersByTeam(mockTeamId, mockSeason);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'FW', strNumber: '10',
        goals: 5, assists: 3, appearances: 10, yellow_cards: 1, red_cards: 0,
      });
      expect(result[1]).toEqual({
        idPlayer: 'p2', strPlayer: 'Player Two', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'MF', strNumber: '8',
        goals: 2, assists: 7, appearances: 12, yellow_cards: 2, red_cards: 0,
      });
      expect(supabase.from).toHaveBeenCalledWith('players');
      expect(supabase.from).toHaveBeenCalledWith('player_statistics');
    });

    it('should return players without stats if stats not found', async () => {
      const mockPlayersData = [
        { idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'FW', strNumber: '10' },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockPlayersData)); // players
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(null)); // player_statistics returns null

      const result: TeamPlayer[] = await fetchPlayersByTeam(mockTeamId, mockSeason);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'FW', strNumber: '10',
        goals: 0, assists: 0, appearances: 0, yellow_cards: 0, red_cards: 0,
      });
    });

    it('should return empty array if no players found', async () => {
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain([])); // players returns empty

      const result = await fetchPlayersByTeam(mockTeamId, mockSeason);
      expect(result).toEqual([]);
    });
  });

  describe('fetchTeamUpcomingFixtures', () => {
    it('should fetch upcoming fixtures for a team', async () => {
      const mockFixturesData = [
        {
          id: 'e1', date: '2025-12-20T10:00:00Z', status: 'SCHEDULED', round: '38',
          homeTeamId: mockTeamId, awayTeamId: 't2', homeScore: null, awayScore: null,
          venueName: 'Stadium One', leagueId: '4689'
        },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockFixturesData)); // events_v2

      const result: UpcomingFixture[] = await fetchTeamUpcomingFixtures(mockTeamId);

      expect(result).toHaveLength(1);
      // Mapped values
      expect(result[0].id).toBe(mockFixturesData[0].id);
      expect(result[0].home_team.id).toBe(mockTeamId);
      expect(supabase.from).toHaveBeenCalledWith('events_v2');
    });
  });

  describe('fetchTeamRecentFixtures', () => {
    it('should fetch recent fixtures for a team', async () => {
      const mockFixturesData = [
        {
          id: 'e2', date: '2025-12-01T15:00:00Z', status: 'FINISHED', round: '37',
          homeTeamId: 't3', awayTeamId: mockTeamId, homeScore: 1, awayScore: 2,
          venueName: 'Stadium Two', leagueId: '4689'
        },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockFixturesData)); // events_v2

      const result: RoundFixture[] = await fetchTeamRecentFixtures(mockTeamId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockFixturesData[0].id); // 'e2' -> 2
      expect(result[0].away_team.id).toBe(mockTeamId);
      expect(result[0].home_goals).toBe(1);
      expect(result[0].away_goals).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('events_v2');
    });
  });

  describe('fetchTeamFormGuide', () => {
    it('should calculate form guide for a team', async () => {
      const mockEventsData = [
        // Win (home)
        { id: 'e1', date: '2025-12-05T00:00:00Z', status: 'FINISHED', homeTeamId: mockTeamId, awayTeamId: 't2', homeScore: 2, awayScore: 1 },
        // Draw (away)
        { id: 'e2', date: '2025-12-01T00:00:00Z', status: 'FINISHED', homeTeamId: 't3', awayTeamId: mockTeamId, homeScore: 1, awayScore: 1 },
        // Loss (home)
        { id: 'e3', date: '2025-11-28T00:00:00Z', status: 'FINISHED', homeTeamId: mockTeamId, awayTeamId: 't4', homeScore: 0, awayScore: 1 },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockEventsData)); // events_v2

      const result = await fetchTeamFormGuide(mockTeamId, String(mockSeason), 3);

      expect(result).toEqual(['W', 'D', 'L']);
      expect(supabase.from).toHaveBeenCalledWith('events_v2');
    });

    it('should handle undefined scores gracefully', async () => {
      const mockEventsData = [
        // Match with null scores
        { id: 'e1', date: '2025-12-05T00:00:00Z', status: 'SCHEDULED', homeTeamId: mockTeamId, awayTeamId: 't2', homeScore: null, awayScore: null },
        // Valid finished match
        { id: 'e2', date: '2025-12-01T00:00:00Z', status: 'FINISHED', homeTeamId: 't3', awayTeamId: mockTeamId, homeScore: 1, awayScore: 1 },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockEventsData)); // events_v2

      const result = await fetchTeamFormGuide(mockTeamId, String(mockSeason), 2);
      expect(result).toEqual(['D']); // Only the finished match should be included
    });
  });
});