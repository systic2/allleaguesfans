// scripts/lib/highlightly-integration.ts
// Highlightly API 통합 클라이언트

const HIGHLIGHTLY_BASE_URL = 'https://sports.highlightly.net';
const HIGHLIGHTLY_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

// Highlightly K League IDs
export const HIGHLIGHTLY_LEAGUES = {
  K_LEAGUE_1: 249276,
  K_LEAGUE_2: 250127,
  FA_CUP: 250978,
  K3_LEAGUE: 251829,
  WK_LEAGUE: 562444
} as const;

// Highlightly API interfaces
export interface HighlightlyLeague {
  id: number;
  logo: string;
  name: string;
  seasons: { season: number }[];
  country: {
    code: string;
    name: string;
    logo: string;
  };
}

export interface HighlightlyTeamStats {
  wins: number;
  draws: number;
  games: number;
  loses: number;
  scoredGoals: number;
  receivedGoals: number;
}

export interface HighlightlyTeam {
  id: number;
  logo: string;
  name: string;
}

export interface HighlightlyStanding {
  away: HighlightlyTeamStats;
  home: HighlightlyTeamStats;
  team: HighlightlyTeam;
  total: HighlightlyTeamStats;
  points: number;
  position: number;
}

export interface HighlightlyGroup {
  name: string;
  standings: HighlightlyStanding[];
}

export interface HighlightlyStandingsResponse {
  groups: HighlightlyGroup[];
  league: {
    id: number;
    logo: string;
    name: string;
    season: number;
  };
}

export interface HighlightlyLeaguesResponse {
  data: HighlightlyLeague[];
}

export class HighlightlyClient {
  constructor(private apiKey: string = HIGHLIGHTLY_KEY) {}
  
  private async fetch<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${HIGHLIGHTLY_BASE_URL}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
    
    console.log(`🌟 Highlightly: GET ${url.toString()}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AllLeaguesFans/1.0 (Highlightly Integration)'
    };
    
    // Add API key if available
    if (this.apiKey) {
      headers['X-RapidAPI-Key'] = this.apiKey;
      headers['X-RapidAPI-Host'] = 'sports.highlightly.net';
    }
    
    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      throw new Error(`Highlightly API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Highlightly response received`);
    return data;
  }
  
  // Get leagues for a country
  async getLeaguesByCountry(countryCode: string = 'KR'): Promise<HighlightlyLeague[]> {
    try {
      const response = await this.fetch<HighlightlyLeaguesResponse>('/football/leagues', {
        countryCode
      });
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get leagues for country ${countryCode}:`, error);
      return [];
    }
  }
  
  // Get standings for a league and season
  async getLeagueStandings(leagueId: number, season: number = 2025): Promise<HighlightlyStandingsResponse | null> {
    try {
      const response = await this.fetch<HighlightlyStandingsResponse>('/football/standings', {
        leagueId,
        season
      });
      return response;
    } catch (error) {
      console.error(`Failed to get standings for league ${leagueId} season ${season}:`, error);
      return null;
    }
  }
  
  // Get K League 1 standings
  async getKLeague1Standings(season: number = 2025): Promise<HighlightlyStanding[]> {
    const response = await this.getLeagueStandings(HIGHLIGHTLY_LEAGUES.K_LEAGUE_1, season);
    return response?.groups?.[0]?.standings || [];
  }
  
  // Get K League 2 standings
  async getKLeague2Standings(season: number = 2025): Promise<HighlightlyStanding[]> {
    const response = await this.getLeagueStandings(HIGHLIGHTLY_LEAGUES.K_LEAGUE_2, season);
    return response?.groups?.[0]?.standings || [];
  }
  
  // Get all K League standings
  async getAllKLeagueStandings(season: number = 2025): Promise<{
    kLeague1: HighlightlyStanding[];
    kLeague2: HighlightlyStanding[];
    leagues: HighlightlyLeague[];
  }> {
    console.log(`📊 Fetching K League standings for season ${season}...`);
    
    const [leagues, kLeague1, kLeague2] = await Promise.all([
      this.getLeaguesByCountry('KR'),
      this.getKLeague1Standings(season),
      this.getKLeague2Standings(season)
    ]);
    
    console.log(`✅ Highlightly data: ${leagues.length} leagues, K1: ${kLeague1.length} teams, K2: ${kLeague2.length} teams`);
    
    return {
      kLeague1,
      kLeague2,
      leagues
    };
  }
  
  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing Highlightly API connection...');
      const leagues = await this.getLeaguesByCountry('KR');
      
      if (leagues.length > 0) {
        const kLeagueCount = leagues.filter(l => l.name.includes('K League')).length;
        console.log(`✅ Highlightly API connection successful - Found ${leagues.length} leagues, ${kLeagueCount} K League divisions`);
        return true;
      } else {
        console.warn('⚠️ Highlightly API connected but no league data returned');
        return false;
      }
    } catch (error) {
      console.error('❌ Highlightly API connection failed:', error);
      return false;
    }
  }
  
  // Generate team mapping between TheSportsDB and Highlightly
  async generateTeamMapping(theSportsDBTeams: { idTeam: string; strTeam: string }[]): Promise<Map<string, number>> {
    const mapping = new Map<string, number>();
    
    try {
      const [kLeague1, kLeague2] = await Promise.all([
        this.getKLeague1Standings(),
        this.getKLeague2Standings()
      ]);
      
      const allHighlightlyTeams = [...kLeague1, ...kLeague2];
      
      // Simple name matching (can be improved with fuzzy matching)
      for (const theSportsTeam of theSportsDBTeams) {
        const highlightlyTeam = allHighlightlyTeams.find(ht => 
          ht.team.name.toLowerCase().includes(theSportsTeam.strTeam.toLowerCase()) ||
          theSportsTeam.strTeam.toLowerCase().includes(ht.team.name.toLowerCase())
        );
        
        if (highlightlyTeam) {
          mapping.set(theSportsTeam.idTeam, highlightlyTeam.team.id);
          console.log(`🔗 Team mapping: ${theSportsTeam.strTeam} (${theSportsTeam.idTeam}) → ${highlightlyTeam.team.name} (${highlightlyTeam.team.id})`);
        }
      }
      
      console.log(`✅ Generated ${mapping.size} team mappings`);
      
    } catch (error) {
      console.error('Failed to generate team mapping:', error);
    }
    
    return mapping;
  }
}

// Factory function
export function createHighlightlyClient(): HighlightlyClient {
  return new HighlightlyClient();
}