import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchLeagues, // Added
  fetchTeamDetails,
  fetchPlayersByTeam,
  fetchTeamUpcomingFixtures,
  fetchTeamRecentFixtures,
  fetchTeamFormGuide,
  fetchPlayerDetail,
  fetchTeamStandingsData,
  fetchTopAssists,
  fetchTopScorers,
  fetchTeamKoreanNames,
  fetchLeagueBySlug,
  leagueSlugFor,
  searchByName,
  normalizeSeason,
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
  mockChain.not = vi.fn(() => mockChain);
  mockChain.ilike = vi.fn(() => mockChain);
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
const mockSeason = '2025';
// Mock current year will be needed for fetchHistoricalChampions, but not these
// const mockCurrentYear = new Date().getFullYear(); 

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchLeagues', () => {
    it('should fetch leagues and map IDs to slugs correctly', async () => {
      const mockLeaguesData = [
        { idLeague: '4689', strLeague: 'K League 1', strCountry: 'South Korea', strBadge: 'k1.png' },
        { idLeague: '4822', strLeague: 'K League 2', strCountry: 'South Korea', strBadge: 'k2.png' },
        { idLeague: '4328', strLeague: 'English Premier League', strCountry: 'England', strBadge: 'epl.png' },
        { idLeague: '4335', strLeague: 'Spanish La Liga', strCountry: 'Spain', strBadge: 'laliga.png' },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockLeaguesData));

      const result = await fetchLeagues();

      expect(result).toHaveLength(4);
      
      const laLiga = result.find(l => l.name === 'Spanish La Liga');
      expect(laLiga).toBeDefined();
      expect(laLiga?.slug).toBe('la-liga'); // Critical check
      
      const epl = result.find(l => l.name === 'English Premier League');
      expect(epl?.slug).toBe('premier-league');
      
      const k1 = result.find(l => l.name === 'K League 1');
      expect(k1?.slug).toBe('k-league-1');
      expect(k1?.name_korean).toBe('K리그1');
      expect(epl?.name_korean).toBe('프리미어리그');
      expect(laLiga?.name_korean).toBe('라리가');

      expect(supabase.from).toHaveBeenCalledWith('leagues');
    });
  });

  describe('fetchTeamKoreanNames', () => {
    it('maps team IDs to their Korean names', async () => {
      const teamChain = createMockSupabaseChain([
        { id: 1, nameKorean: '울산 HD' },
        { id: '2', nameKorean: '전북 현대' },
      ]);
      (supabase.from as any).mockReturnValueOnce(teamChain);

      await expect(fetchTeamKoreanNames()).resolves.toEqual({
        '1': '울산 HD',
        '2': '전북 현대',
      });
      expect(supabase.from).toHaveBeenCalledWith('teams_v2');
      expect(teamChain.select).toHaveBeenCalledWith('id, nameKorean');
      expect(teamChain.not).toHaveBeenCalledWith('nameKorean', 'is', null);
    });

    it('rejects when the query fails so callers can retry', async () => {
      const error = { message: 'database unavailable' };
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(null, error));

      await expect(fetchTeamKoreanNames()).rejects.toBe(error);
    });
  });

  describe('league slug helpers', () => {
    it('maps known and unknown TheSportsDB league IDs to route slugs', () => {
      expect(leagueSlugFor('4328')).toBe('premier-league');
      expect(leagueSlugFor('9999')).toBe('league-9999');
    });

    it('queries the Premier League by TheSportsDB league ID', async () => {
      const leagueChain = createMockSupabaseChain({
        idLeague: '4328',
        strLeague: 'English Premier League',
        strCountry: 'England',
        strBadge: 'epl.png',
        strCurrentSeason: '2026-2027',
      });
      (supabase.from as any).mockReturnValueOnce(leagueChain);

      const result = await fetchLeagueBySlug('premier-league');

      expect(leagueChain.eq).toHaveBeenCalledWith('idLeague', '4328');
      expect(result?.slug).toBe('premier-league');
      expect(result?.name_korean).toBe('프리미어리그');
    });

    it('canonicalizes the returned slug and Korean name for a league-ID route', async () => {
      const leagueChain = createMockSupabaseChain({
        idLeague: '4689',
        strLeague: 'K League 1',
        strCountry: 'South Korea',
        strBadge: 'k1.png',
        strCurrentSeason: '2026',
      });
      (supabase.from as any).mockReturnValueOnce(leagueChain);

      const result = await fetchLeagueBySlug('league-4689');

      expect(leagueChain.eq).toHaveBeenCalledWith('idLeague', '4689');
      expect(result?.slug).toBe('k-league-1');
      expect(result?.name_korean).toBe('K리그1');
    });
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
        season: '2025',
      };

      // Mock sequence for supabase.from calls
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockTeamData)); // teams_v2
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockStandingData)); // standings_v2

      const result: TeamDetails | null = await fetchTeamDetails(mockTeamId, mockSeason);

      expect(result).toMatchObject({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
        strStadium: undefined,
        intFormedYear: undefined,
        current_position: 5,
        points: 45,
        matches_played: 30,
        wins: 12,
        draws: 9,
        losses: 9,
        goals_for: 40,
        goals_against: 30,
        goal_difference: 10,
        currentLeagueId: '4689',
        currentSeason: '2025',
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

      expect(result).toMatchObject({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'http://example.com/busan.png',
        strStadium: undefined,
        intFormedYear: undefined,
        current_position: null,
        points: null,
        matches_played: null,
        wins: null,
        draws: null,
        losses: null,
        goals_for: null,
        goals_against: null,
        goal_difference: null,
        currentLeagueId: null,
      });
    });

    it('uses the latest standing without adding a season filter when season is omitted', async () => {
      const teamChain = createMockSupabaseChain({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'busan.png',
      });
      const standingChain = createMockSupabaseChain({
        rank: 2,
        points: 61,
        gamesPlayed: 32,
        wins: 18,
        draws: 7,
        losses: 7,
        goalsFor: 52,
        goalsAgainst: 31,
        goalDifference: 21,
        leagueId: '4689',
        season: '2026',
      });
      (supabase.from as any)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(standingChain);

      const result = await fetchTeamDetails(mockTeamId);

      expect(standingChain.eq).toHaveBeenCalledTimes(1);
      expect(standingChain.eq).toHaveBeenCalledWith('teamId', mockTeamId);
      expect(standingChain.order).toHaveBeenNthCalledWith(1, 'season', { ascending: false });
      expect(result?.currentSeason).toBe('2026');
    });

    it('normalizes and filters an explicitly requested season', async () => {
      const teamChain = createMockSupabaseChain({
        id: mockTeamId,
        name: 'Busan IPark',
        nameKorean: '부산 아이파크',
        badgeUrl: 'busan.png',
      });
      const standingChain = createMockSupabaseChain({
        rank: 4,
        leagueId: '4689',
        season: '2025',
      });
      (supabase.from as any)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(standingChain);

      const result = await fetchTeamDetails(mockTeamId, '2025-2026');

      expect(standingChain.eq).toHaveBeenCalledWith('season', '2025');
      expect(result?.currentSeason).toBe('2025');
    });
  });

  describe('searchByName', () => {
    it('searches teams_v2 in English and Korean and prefers the Korean display name', async () => {
      const leagueChain = createMockSupabaseChain([
        { idLeague: '4328', strLeague: 'English Premier League', strCountry: 'England', highlightly_id: null },
        { idLeague: '9999', strLeague: 'Unknown League', strCountry: 'Nowhere', highlightly_id: null },
      ]);
      const teamChain = createMockSupabaseChain([
        { id: '138106', name: 'Busan IPark', nameKorean: '부산 아이파크', badgeUrl: 'busan.png' },
        { id: 'hist_hallelujah', name: 'Hallelujah FC', nameKorean: null, badgeUrl: null },
      ]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      const result = await searchByName('Busan');

      expect(supabase.from).toHaveBeenNthCalledWith(2, 'teams_v2');
      expect(teamChain.select).toHaveBeenCalledWith('id, name, nameKorean, badgeUrl');
      expect(teamChain.or).toHaveBeenCalledWith('name.ilike."%Busan%",nameKorean.ilike."%Busan%",nameKorean.imatch."B *u *s *a *n"');
      expect(leagueChain.or).toHaveBeenCalledWith('strLeague.ilike."%Busan%"');
      expect(leagueChain.limit).toHaveBeenCalledWith(30);
      expect(teamChain.limit).toHaveBeenCalledWith(30);
      expect(playerChain.limit).toHaveBeenCalledWith(30);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'team', entity_id: 138106, team_id: '138106', name: '부산 아이파크', name_en: 'Busan IPark', crest_url: 'busan.png' }),
        expect.objectContaining({ type: 'team', entity_id: 0, team_id: 'hist_hallelujah', name: 'Hallelujah FC', name_en: null }),
        expect.objectContaining({ type: 'league', slug: 'premier-league', name: '프리미어리그', name_en: 'English Premier League', country: 'England' }),
        expect.objectContaining({ type: 'league', slug: 'league-9999', name_en: null }),
      ]));
    });

    it('replaces PostgREST filter metacharacters with spaces', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      await searchByName('foo,(bar)*%\\baz');

      const pattern = '%foo,(bar)   baz%';
      expect(leagueChain.or).toHaveBeenCalledWith(`strLeague.ilike."${pattern}"`);
      expect(teamChain.or).toHaveBeenCalledWith(
        `name.ilike."${pattern}",nameKorean.ilike."${pattern}",nameKorean.imatch."f *o *o *b *a *r *b *a *z"`,
      );
      expect(playerChain.ilike).toHaveBeenCalledWith('strPlayer', pattern);
    });

    it('returns early when wildcard, quote, and backslash sanitization leaves an empty query', async () => {
      await expect(searchByName('  % _ * " \\  ')).resolves.toEqual([]);

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('runs exact team and player queries, puts exact rows first, and removes duplicate IDs', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([
        { id: '2', name: 'Query Town', nameKorean: null, badgeUrl: null },
        { id: '1', name: 'Query FC duplicate', nameKorean: null, badgeUrl: null },
      ]);
      const playerChain = createMockSupabaseChain([
        { idPlayer: '20', strPlayer: 'Query Junior', idTeam: null, strTeam: null, strThumb: null },
        { idPlayer: '10', strPlayer: 'Query duplicate', idTeam: null, strTeam: null, strThumb: null },
      ]);
      const exactTeamChain = createMockSupabaseChain([
        { id: '1', name: 'Query', nameKorean: null, badgeUrl: 'exact.png' },
      ]);
      const exactPlayerChain = createMockSupabaseChain([
        { idPlayer: '10', strPlayer: 'Query', idTeam: null, strTeam: null, strThumb: 'exact-player.png' },
      ]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain)
        .mockReturnValueOnce(exactTeamChain)
        .mockReturnValueOnce(exactPlayerChain);

      const result = await searchByName('Query');

      expect(supabase.from).toHaveBeenNthCalledWith(4, 'teams_v2');
      expect(supabase.from).toHaveBeenNthCalledWith(5, 'players_v2');
      expect(exactTeamChain.or).toHaveBeenCalledWith('name.ilike."Query",nameKorean.ilike."Query"');
      expect(exactTeamChain.limit).toHaveBeenCalledWith(10);
      expect(exactPlayerChain.ilike).toHaveBeenCalledWith('strPlayer', 'Query');
      expect(exactPlayerChain.limit).toHaveBeenCalledWith(10);
      expect(result.filter((row) => row.type === 'team').map((row) => row.entity_id)).toEqual([1, 2]);
      expect(result.filter((row) => row.type === 'player').map((row) => row.entity_id)).toEqual([10, 20]);
    });

    it.each([0, 1, 2, 3, 4])('throws when search query %i fails', async (failedIndex) => {
      const error = { message: `query ${failedIndex} failed` };
      const chains = Array.from({ length: 5 }, (_, index) => createMockSupabaseChain([], index === failedIndex ? error : null));
      for (const chain of chains) (supabase.from as any).mockReturnValueOnce(chain);

      await expect(searchByName('failure')).rejects.toBe(error);
    });

    it('adds Korean league-name IDs to the league filter and uses Korean display metadata', async () => {
      const leagueChain = createMockSupabaseChain([
        { idLeague: '4328', strLeague: 'English Premier League', strCountry: 'England', highlightly_id: 39 },
      ]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      const result = await searchByName('프리미어');

      expect(leagueChain.select).toHaveBeenCalledWith('idLeague, strLeague, strCountry, highlightly_id');
      expect(leagueChain.or).toHaveBeenCalledWith(
        'strLeague.ilike."%프리미어%",idLeague.in.("4328")',
      );
      expect(leagueChain.limit).toHaveBeenCalledWith(30);
      expect(result).toContainEqual({
        type: 'league',
        entity_id: 39,
        name: '프리미어리그',
        name_en: 'English Premier League',
        slug: 'premier-league',
        country: 'England',
      });
    });

    it('adds a space-insensitive Korean-name filter', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      await searchByName('전북현대');

      expect(teamChain.or).toHaveBeenCalledWith(
        'name.ilike."%전북현대%",nameKorean.ilike."%전북현대%",nameKorean.imatch."전 *북 *현 *대"',
      );
    });

    it('adds matching team alias IDs to the team filter', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      await searchByName('맨유');

      expect(teamChain.or).toHaveBeenCalledWith(
        'name.ilike."%맨유%",nameKorean.ilike."%맨유%",nameKorean.imatch."맨 *유",id.in.("133612")',
      );
    });

    it('does not add an imatch filter for a one-letter query', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      await searchByName('x');

      expect(teamChain.or).toHaveBeenCalledWith('name.ilike."%x%",nameKorean.ilike."%x%"');
    });

    it('uses only Unicode letters and digits in the imatch value', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      await expect(searchByName('a.b(c)*')).resolves.toEqual([]);

      expect(teamChain.or).toHaveBeenCalledWith(
        'name.ilike."%a.b(c)%",nameKorean.ilike."%a.b(c)%",nameKorean.imatch."a *b *c"',
      );
    });

    it('adds an imatch filter for at most 30 letters', async () => {
      const query31 = 'a'.repeat(31);
      const query30 = 'a'.repeat(30);
      const leagueChain31 = createMockSupabaseChain([]);
      const teamChain31 = createMockSupabaseChain([]);
      const playerChain31 = createMockSupabaseChain([]);
      const leagueChain30 = createMockSupabaseChain([]);
      const teamChain30 = createMockSupabaseChain([]);
      const playerChain30 = createMockSupabaseChain([]);
      const exactTeamChain31 = createMockSupabaseChain([]);
      const exactPlayerChain31 = createMockSupabaseChain([]);
      const exactTeamChain30 = createMockSupabaseChain([]);
      const exactPlayerChain30 = createMockSupabaseChain([]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain31)
        .mockReturnValueOnce(teamChain31)
        .mockReturnValueOnce(playerChain31)
        .mockReturnValueOnce(exactTeamChain31)
        .mockReturnValueOnce(exactPlayerChain31)
        .mockReturnValueOnce(leagueChain30)
        .mockReturnValueOnce(teamChain30)
        .mockReturnValueOnce(playerChain30)
        .mockReturnValueOnce(exactTeamChain30)
        .mockReturnValueOnce(exactPlayerChain30);

      await searchByName(query31);
      await searchByName(query30);

      expect(teamChain31.or).toHaveBeenCalledWith(
        `name.ilike."%${query31}%",nameKorean.ilike."%${query31}%"`,
      );
      expect(teamChain30.or).toHaveBeenCalledWith(
        `name.ilike."%${query30}%",nameKorean.ilike."%${query30}%",nameKorean.imatch."${Array.from(query30).join(' *')}"`,
      );
    });

    it('includes the player team ID in search results', async () => {
      const leagueChain = createMockSupabaseChain([]);
      const teamChain = createMockSupabaseChain([]);
      const playerChain = createMockSupabaseChain([
        {
          idPlayer: '34145937',
          strPlayer: 'Lee Dong-gyeong',
          idTeam: '138001',
          strTeam: 'Ulsan HD FC',
          strThumb: 'lee.png',
          strNationality: 'South Korea',
          dateBorn: '1997-09-20',
        },
      ]);
      (supabase.from as any)
        .mockReturnValueOnce(leagueChain)
        .mockReturnValueOnce(teamChain)
        .mockReturnValueOnce(playerChain);

      const result = await searchByName('Lee');

      expect(playerChain.select).toHaveBeenCalledWith('idPlayer, strPlayer, idTeam, strTeam, strThumb, strNationality, dateBorn');
      expect(playerChain.limit).toHaveBeenCalledWith(30);
      expect(result).toContainEqual(expect.objectContaining({
        type: 'player',
        entity_id: 34145937,
        name: 'Lee Dong-gyeong',
        team_id: '138001',
        team_name: 'Ulsan HD FC',
        nationality: 'South Korea',
        birth_date: '1997-09-20',
      }));
    });
  });

  describe('fetchPlayersByTeam', () => {
    it('should fetch players with their statistics', async () => {
      const mockPlayersData = [
        {
          idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId,
          strPosition: 'Forward', strNumber: '10', strNationality: 'South Korea',
          dateBorn: '2000-01-01', updated_at: '2026-11-17T16:00:00Z',
        },
        {
          idPlayer: 'p2', strPlayer: 'Player Two', strTeam: 'Busan', idTeam: mockTeamId,
          strPosition: 'Midfielder', strNumber: '8', strNationality: null,
          dateBorn: null, updated_at: null,
        },
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
        idPlayer: 'p1', strPlayer: 'Player One', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'Forward', strNumber: '10',
        strNationality: 'South Korea', dateBorn: '2000-01-01', updatedAt: '2026-11-17T16:00:00Z',
        goals: 5, assists: 3, appearances: 10, yellow_cards: 1, red_cards: 0,
      });
      expect(result[1]).toEqual({
        idPlayer: 'p2', strPlayer: 'Player Two', strTeam: 'Busan', idTeam: mockTeamId, strPosition: 'Midfielder', strNumber: '8',
        strNationality: null, dateBorn: null, updatedAt: null,
        goals: 2, assists: 7, appearances: 12, yellow_cards: 2, red_cards: 0,
      });
      expect(result[0]).not.toHaveProperty('updated_at');
      expect(supabase.from).toHaveBeenCalledWith('players_v2');
      expect(supabase.from).toHaveBeenCalledWith('player_statistics');
      const playersChain = (supabase.from as any).mock.results[0].value;
      expect(playersChain.select).toHaveBeenCalledWith(
        'idPlayer, strPlayer, strTeam, idTeam, strPosition, strNumber, strNationality, dateBorn, updated_at',
      );
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
        strNationality: null, dateBorn: null, updatedAt: null,
        // 기록 행이 없으면 0 이 아니라 null (미제공)
        goals: null, assists: null, appearances: null, yellow_cards: null, red_cards: null,
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

      const result = await fetchTeamFormGuide(mockTeamId, mockSeason, 3);

      expect(result).toEqual(['W', 'D', 'L']);
      expect(supabase.from).toHaveBeenCalledWith('events_v2');
      const eventsChain = (supabase.from as any).mock.results[0].value;
      expect(eventsChain.eq).toHaveBeenCalledWith('status', 'FINISHED');
      expect(eventsChain.lt).toHaveBeenCalledWith('date', expect.any(String));
      expect(eventsChain.not).toHaveBeenNthCalledWith(1, 'homeScore', 'is', null);
      expect(eventsChain.not).toHaveBeenNthCalledWith(2, 'awayScore', 'is', null);
    });

    it('should handle undefined scores gracefully', async () => {
      const mockEventsData = [
        // Match with null scores
        { id: 'e1', date: '2025-12-05T00:00:00Z', status: 'SCHEDULED', homeTeamId: mockTeamId, awayTeamId: 't2', homeScore: null, awayScore: null },
        // Valid finished match
        { id: 'e2', date: '2025-12-01T00:00:00Z', status: 'FINISHED', homeTeamId: 't3', awayTeamId: mockTeamId, homeScore: 1, awayScore: 1 },
      ];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockEventsData)); // events_v2

      const result = await fetchTeamFormGuide(mockTeamId, mockSeason, 2);
      expect(result).toEqual(['D']); // Only the finished match should be included
    });
  });

  describe('fetchPlayerDetail', () => {
    it('should fetch detailed player info and real stats', async () => {
      const mockPlayerId = 12345;
      const mockPlayerData = {
        idPlayer: String(mockPlayerId),
        strPlayer: 'Test Player',
        strTeam: 'Test FC',
        idTeam: '999',
        strPosition: 'Forward',
        strNumber: '9',
        strNationality: 'South Korea',
        strHeight: '185 cm',
        strWeight: '80 kg',
        dateBorn: '2000-01-01',
        strThumb: 'http://example.com/photo.jpg'
      };
      const mockPlayerStats = [{
        strSeason: '2026',
        idTeam: '999',
        goals: 10,
        assists: 5,
        appearances: 20,
        minutes_played: 1800,
        yellow_cards: 2,
        red_cards: 0,
        penalties_scored: 1,
        penalties_missed: 0,
        own_goals: 0
      }];

      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockPlayerData)); // players
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(mockPlayerStats)); // player_statistics

      const result = await fetchPlayerDetail(mockPlayerId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(String(mockPlayerId));
      expect(result?.name).toBe('Test Player');
      
      // Verify Bio Data
      expect(result?.nationality).toBe('South Korea');
      expect(result?.height).toBe('185 cm');
      expect(result?.weight).toBe('80 kg');
      expect(result?.birthDate).toBe('2000-01-01');
      expect(result?.photoUrl).toBe('http://example.com/photo.jpg');
      expect(result).not.toHaveProperty('age');

      // Verify every real statistics row is retained.
      expect(result?.seasons[0]).toMatchObject({
        season: '2026',
        teamId: '999',
        goals: 10,
        minutesPlayed: 1800,
      });

      const statsChain = (supabase.from as any).mock.results[1].value;
      expect(statsChain.eq).toHaveBeenCalledWith('idPlayer', String(mockPlayerId));
      expect(statsChain.eq).not.toHaveBeenCalledWith('strSeason', expect.anything());
      expect(statsChain.order).toHaveBeenCalledWith('strSeason', { ascending: false });
      expect(statsChain.order).toHaveBeenCalledWith('last_updated', { ascending: false });
      expect(statsChain.limit).not.toHaveBeenCalled();
      
      expect(supabase.from).toHaveBeenCalledWith('players_v2');
      expect(supabase.from).toHaveBeenCalledWith('player_statistics');
    });

    it('returns the current team league from its latest supported standing', async () => {
      const playerChain = createMockSupabaseChain({
        idPlayer: '12345',
        strPlayer: 'Test Player',
        strTeam: 'Test FC',
        idTeam: '999',
        strPosition: 'Forward',
      });
      const statsChain = createMockSupabaseChain([]);
      const standingChain = createMockSupabaseChain({ leagueId: 4328 });
      (supabase.from as any)
        .mockReturnValueOnce(playerChain)
        .mockReturnValueOnce(statsChain)
        .mockReturnValueOnce(standingChain);

      const result = await fetchPlayerDetail(12345);

      expect(result?.teamLeagueId).toBe('4328');
      expect(supabase.from).toHaveBeenNthCalledWith(3, 'standings_v2');
      expect(standingChain.select).toHaveBeenCalledWith('leagueId');
      expect(standingChain.eq).toHaveBeenCalledWith('teamId', '999');
      expect(standingChain.in).toHaveBeenCalledWith('leagueId', [
        '4689', '4822', '4328', '4335', '4332', '4331', '4334',
      ]);
      expect(standingChain.order).toHaveBeenCalledWith('season', { ascending: false });
      expect(standingChain.limit).toHaveBeenCalledWith(1);
      expect(standingChain.maybeSingle).toHaveBeenCalledOnce();
    });

    it('should return null if player not found', async () => {
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain(null)); // players returns null

      const result = await fetchPlayerDetail(99999);
      expect(result).toBeNull();
    });

    it('returns an empty seasons array when the player has no statistics row', async () => {
      (supabase.from as any)
        .mockReturnValueOnce(createMockSupabaseChain({
          idPlayer: '12345',
          strPlayer: 'Test Player',
          strTeam: 'Test FC',
          idTeam: '999',
          strPosition: 'Forward',
        }))
        .mockReturnValueOnce(createMockSupabaseChain([]));

      const result = await fetchPlayerDetail(12345);

      expect(result?.seasons).toEqual([]);
    });

    it('preserves null stat fields separately from genuine zero values', async () => {
      (supabase.from as any)
        .mockReturnValueOnce(createMockSupabaseChain({
          idPlayer: '12345',
          strPlayer: 'Test Player',
          strTeam: 'Test FC',
          idTeam: '999',
          strPosition: 'Forward',
        }))
        .mockReturnValueOnce(createMockSupabaseChain([{
          strSeason: '2026',
          idTeam: '999',
          appearances: null,
          minutes_played: 0,
          goals: null,
          assists: 0,
          yellow_cards: null,
          red_cards: 0,
          penalties_scored: null,
          penalties_missed: 0,
          own_goals: null,
        }]));

      const result = await fetchPlayerDetail(12345);

      expect(result?.seasons[0]).toEqual({
        season: '2026',
        leagueId: '',
        teamId: '999',
        teamName: '',
        appearances: null,
        minutesPlayed: 0,
        goals: null,
        assists: 0,
        yellowCards: null,
        redCards: 0,
        penaltiesScored: null,
        penaltiesMissed: 0,
        ownGoals: null,
      });
    });

    it('keeps transfer rows and puts the current team first within the same season', async () => {
      (supabase.from as any)
        .mockReturnValueOnce(createMockSupabaseChain({
          idPlayer: '12345',
          strPlayer: 'Transferred Player',
          strTeam: 'Current FC',
          idTeam: 'current-team',
          strPosition: 'Forward',
        }))
        .mockReturnValueOnce(createMockSupabaseChain([
          { strSeason: '2026', idLeague: '4328', idTeam: 'former-team', strTeam: 'Former FC', goals: 3, appearances: 8 },
          { strSeason: '2026', idLeague: '4328', idTeam: 'current-team', strTeam: 'Current FC', goals: 7, appearances: 12 },
          { strSeason: '2025', idLeague: '4328', idTeam: 'current-team', strTeam: 'Current FC', goals: 20, appearances: 30 },
        ]));

      const result = await fetchPlayerDetail(12345);

      expect(result?.seasons).toHaveLength(3);
      expect(result?.seasons.map((row) => [row.season, row.teamId, row.goals, row.appearances])).toEqual([
        ['2026', 'current-team', 7, 12],
        ['2026', 'former-team', 3, 8],
        ['2025', 'current-team', 20, 30],
      ]);
    });

    it('normalizes missing and whitespace-only profile fields to null without fallbacks', async () => {
      (supabase.from as any)
        .mockReturnValueOnce(createMockSupabaseChain({
          idPlayer: '12345',
          strPlayer: 'Test Player',
          strTeam: '   ',
          idTeam: '',
          strPosition: ' ',
          strNumber: '',
          strNationality: '  ',
          strHeight: '',
          strWeight: ' ',
          dateBorn: '',
          strThumb: ' ',
        }))
        .mockReturnValueOnce(createMockSupabaseChain([]));

      const result = await fetchPlayerDetail(12345);

      expect(result).toMatchObject({
        teamName: null,
        teamId: null,
        position: null,
        jerseyNumber: null,
        photoUrl: null,
        birthDate: null,
        nationality: null,
        height: null,
        weight: null,
        seasons: [],
      });
      expect(result).not.toHaveProperty('age');
    });
  });

  describe('nullable standings and leaderboard statistics', () => {
    it('preserves nullable team standings fields and a missing source update time', async () => {
      (supabase.from as any).mockReturnValueOnce(createMockSupabaseChain({
        leagueId: '4689',
        teamId: 'team-1',
        season: '2026',
        rank: 0,
        teamName: 'Test FC',
        teamBadgeUrl: null,
        gamesPlayed: null,
        wins: 0,
        draws: null,
        losses: 0,
        points: null,
        goalsFor: 0,
        goalsAgainst: null,
        goalDifference: 0,
        form: null,
        description: null,
        lastUpdated: null,
      }));

      const result = await fetchTeamStandingsData('4689', '2026', 'Test FC');

      expect(result).toMatchObject({
        rank: 0,
        gamesPlayed: null,
        wins: 0,
        draws: null,
        losses: 0,
        points: null,
        goalsFor: 0,
        goalsAgainst: null,
        goalDifference: 0,
        lastUpdated: null,
      });
    });

    it('keeps leaderboard matches null for unknown appearances and 0 for a real zero', async () => {
      (supabase.from as any)
        .mockReturnValueOnce(createMockSupabaseChain([{
          idPlayer: '1', strPlayer: 'Scorer', idTeam: '10', strTeam: 'A',
          goals: 4, assists: 0, appearances: null,
        }]))
        .mockReturnValueOnce(createMockSupabaseChain([{
          idPlayer: '2', strPlayer: 'Creator', idTeam: '20', strTeam: 'B',
          goals: 0, assists: 3, appearances: 0,
        }]));

      const [scorers, assisters] = await Promise.all([
        fetchTopScorers(4328, '2026'),
        fetchTopAssists(4328, '2026'),
      ]);

      expect(scorers[0].matches).toBeNull();
      expect(assisters[0].matches).toBe(0);
    });
  });

  describe('normalizeSeason', () => {
    it('should strip the end year from a "YYYY-YYYY" season range', () => {
      expect(normalizeSeason('2025-2026')).toBe('2025');
    });

    it('should leave a plain "YYYY" season untouched', () => {
      expect(normalizeSeason('2025')).toBe('2025');
    });

    it('should handle an empty string without throwing', () => {
      expect(normalizeSeason('')).toBe('');
    });

    it('should only split on the first hyphen when multiple are present', () => {
      expect(normalizeSeason('2025-2026-extra')).toBe('2025');
    });
  });
});
