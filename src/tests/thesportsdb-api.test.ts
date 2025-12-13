import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('@/lib/thesportsdb-api');

import { supabase } from '@/lib/supabaseClient';
import { fetchAllUpcomingFixtures } from '@/lib/thesportsdb-api';

// Helper to create a mock chain for Supabase methods
const createMockSupabaseChain = (mockData: any, mockError: any = null) => {
  const mockChain: any = {};
  
  // Chainable methods
  mockChain.select = vi.fn(() => mockChain);
  mockChain.eq = vi.fn(() => mockChain); // We want to spy on this
  mockChain.in = vi.fn(() => mockChain);
  mockChain.gte = vi.fn(() => mockChain);
  mockChain.order = vi.fn(() => mockChain);
  mockChain.limit = vi.fn(() => mockChain);

  // Terminal methods
  mockChain.then = vi.fn((callback) => callback({ data: mockData, error: mockError }));
  
  return mockChain;
};

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(), 
  },
}));

describe('TheSportsDB API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAllUpcomingFixtures', () => {
    it('should fetch upcoming fixtures for ALL leagues without filtering by leagueId', async () => {
      const mockData = [
        {
          id: '1001',
          date: '2025-12-25T15:00:00Z',
          status: 'SCHEDULED',
          leagueId: '4328', // EPL
          homeTeam: { id: '1', name: 'Arsenal' },
          awayTeam: { id: '2', name: 'Chelsea' }
        },
        {
          id: '1002',
          date: '2025-12-26T12:00:00Z',
          status: 'SCHEDULED',
          leagueId: '4689', // K League 1
          homeTeam: { id: '3', name: 'FC Seoul' },
          awayTeam: { id: '4', name: 'Suwon FC' }
        }
      ];

      const mockChain = createMockSupabaseChain(mockData);
      (supabase.from as any).mockReturnValue(mockChain);

      const limit = 5;
      const result = await fetchAllUpcomingFixtures(limit);

      // 1. Verify correct table is queried
      expect(supabase.from).toHaveBeenCalledWith('events_v2');

      // 2. Verify return data mapping
      expect(result).toHaveLength(2);
      expect(result[0].homeTeam?.name).toBe('Arsenal');
      
      // 3. CRITICAL: Verify NO leagueId filter was applied
      // .eq should NOT be called because we want ALL leagues
      expect(mockChain.eq).not.toHaveBeenCalled();

      // 4. Verify other necessary filters
      expect(mockChain.in).toHaveBeenCalledWith('status', ['SCHEDULED', 'POSTPONED', 'FINISHED', 'IN_PLAY', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT']);
      expect(mockChain.gte).toHaveBeenCalledWith('date', expect.any(String)); // >= today
      expect(mockChain.limit).toHaveBeenCalledWith(limit);
    });

    it('should return empty array on error', async () => {
      const mockChain = createMockSupabaseChain(null, { message: 'DB Error' });
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await fetchAllUpcomingFixtures();
      
      expect(result).toEqual([]);
    });
  });
});
