// scripts/lib/thesportsdb-integration.ts
// TheSportsDB API 통합 클라이언트

const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v2/json';
const THESPORTSDB_KEY = process.env.TheSportsDB_KEY || '460915'; // Free key fallback

// K League IDs in TheSportsDB
export const THESPORTSDB_LEAGUES = {
  K_LEAGUE_1: '4689',
  K_LEAGUE_2: '4822'
} as const;

// Rate limiting for TheSportsDB API
class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number = 30, // 30 requests per minute for free tier
    private windowMs: number = 60000  // 1 minute
  ) {}
  
  async wait(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      if (waitTime > 0) {
        console.log(`⏳ TheSportsDB rate limit, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(now);
  }
}

// TheSportsDB API response interfaces
export interface TheSportsDBLeague {
  idLeague: string;
  strLeague: string;
  strLeagueAlternate: string;
  intDivision: string;
  strCurrentSeason: string;
  intFormedYear: string;
  strCountry: string;
  strWebsite: string;
  strFacebook: string;
  strInstagram: string;
  strTwitter: string;
  strYoutube: string;
  strDescriptionEN: string;
  strBadge: string;
  strLogo: string;
  strBanner: string;
  strPoster: string;
}

export interface TheSportsDBTeam {
  idTeam: string;
  strTeam: string;
  strTeamAlternate: string;
  strTeamShort: string;
  intFormedYear: string;
  strLeague: string;
  idLeague: string;
  strBadge: string;
  strLogo: string;
  strBanner: string;
  strEquipment: string;
  strCountry: string;
  strDescriptionEN: string;
  strWebsite: string;
  strFacebook: string;
  strTwitter: string;
  strInstagram: string;
  strYoutube: string;
  strStadium: string;
  strStadiumDescription: string;
  intStadiumCapacity: string;
  strStadiumLocation: string;
}

export interface TheSportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strPlayerAlternate: string;
  strTeam: string;
  idTeam: string;
  strPosition: string;
  strHeight: string;
  strWeight: string;
  dateBorn: string;
  strBirthLocation: string;
  strNationality: string;
  strThumb: string;
  strCutout: string;
  strBanner: string;
}

export interface TheSportsDBEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strDescriptionEN: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string;
  intAwayScore: string;
  intRound: string;
  dateEvent: string;
  strTime: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strVenue: string;
  strCity: string;
  strCountry: string;
  strStatus: string;
  strPostponed: string;
}

export class TheSportsDBClient {
  private rateLimiter = new RateLimiter();
  
  constructor(private apiKey: string = THESPORTSDB_KEY) {}
  
  private async fetch<T>(endpoint: string): Promise<T> {
    await this.rateLimiter.wait();
    
    const url = `${THESPORTSDB_BASE_URL}${endpoint}`;
    console.log(`🌐 TheSportsDB: GET ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AllLeaguesFans/1.0 (TheSportsDB Integration)',
        'X_API_KEY': this.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ TheSportsDB response received`);
    return data;
  }
  
  // League information
  async getLeagueDetails(leagueId: string): Promise<TheSportsDBLeague | null> {
    try {
      const response = await this.fetch<{ lookup: TheSportsDBLeague[] }>(`/lookup/league/${leagueId}`);
      return response.lookup?.[0] || null;
    } catch (error) {
      console.error(`Failed to get league details for ${leagueId}:`, error);
      return null;
    }
  }
  
  // Teams in league
  async getLeagueTeams(leagueId: string): Promise<TheSportsDBTeam[]> {
    try {
      const response = await this.fetch<{ list: TheSportsDBTeam[] }>(`/list/teams/${leagueId}`);
      return response.list || [];
    } catch (error) {
      console.error(`Failed to get teams for league ${leagueId}:`, error);
      return [];
    }
  }
  
  // Team details
  async getTeamDetails(teamId: string): Promise<TheSportsDBTeam | null> {
    try {
      const response = await this.fetch<{ lookup: TheSportsDBTeam[] }>(`/lookup/team/${teamId}`);
      return response.lookup?.[0] || null;
    } catch (error) {
      console.error(`Failed to get team details for ${teamId}:`, error);
      return null;
    }
  }
  
  // Players in team
  async getTeamPlayers(teamId: string): Promise<TheSportsDBPlayer[]> {
    try {
      const response = await this.fetch<{ list: TheSportsDBPlayer[] }>(`/list/players/${teamId}`);
      return response.list || [];
    } catch (error) {
      console.error(`Failed to get players for team ${teamId}:`, error);
      return [];
    }
  }
  
  // League schedule for current season
  async getLeagueSchedule(leagueId: string, season: string = '2025'): Promise<TheSportsDBEvent[]> {
    try {
      const response = await this.fetch<{ schedule: TheSportsDBEvent[] }>(`/schedule/league/${leagueId}/${season}`);
      return response.schedule || [];
    } catch (error) {
      console.error(`Failed to get schedule for league ${leagueId} season ${season}:`, error);
      return [];
    }
  }
  
  // Get K League 1 comprehensive data
  async getKLeague1Data(): Promise<{
    league: TheSportsDBLeague | null;
    teams: TheSportsDBTeam[];
    schedule: TheSportsDBEvent[];
  }> {
    console.log('🏆 Fetching K League 1 comprehensive data...');
    
    const [league, teams, schedule] = await Promise.all([
      this.getLeagueDetails(THESPORTSDB_LEAGUES.K_LEAGUE_1),
      this.getLeagueTeams(THESPORTSDB_LEAGUES.K_LEAGUE_1),
      this.getLeagueSchedule(THESPORTSDB_LEAGUES.K_LEAGUE_1)
    ]);
    
    console.log(`✅ K League 1 data: League ${league?.strLeague}, ${teams.length} teams, ${schedule.length} fixtures`);
    return { league, teams, schedule };
  }
  
  // Get K League 2 comprehensive data  
  async getKLeague2Data(): Promise<{
    league: TheSportsDBLeague | null;
    teams: TheSportsDBTeam[];
    schedule: TheSportsDBEvent[];
  }> {
    console.log('🥈 Fetching K League 2 comprehensive data...');
    
    const [league, teams, schedule] = await Promise.all([
      this.getLeagueDetails(THESPORTSDB_LEAGUES.K_LEAGUE_2),
      this.getLeagueTeams(THESPORTSDB_LEAGUES.K_LEAGUE_2),
      this.getLeagueSchedule(THESPORTSDB_LEAGUES.K_LEAGUE_2)
    ]);
    
    console.log(`✅ K League 2 data: League ${league?.strLeague}, ${teams.length} teams, ${schedule.length} fixtures`);
    return { league, teams, schedule };
  }
  
  // Get all K League data
  async getAllKLeagueData() {
    console.log('🚀 Starting comprehensive K League data collection...');
    
    const [kLeague1, kLeague2] = await Promise.all([
      this.getKLeague1Data(),
      this.getKLeague2Data()
    ]);
    
    // Collect all players for each team (with delay to avoid rate limits)
    const allPlayers: { [teamId: string]: TheSportsDBPlayer[] } = {};
    const allTeams = [...kLeague1.teams, ...kLeague2.teams];
    
    console.log(`👥 Fetching players for ${allTeams.length} teams...`);
    for (const team of allTeams) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      allPlayers[team.idTeam] = await this.getTeamPlayers(team.idTeam);
    }
    
    const totalPlayers = Object.values(allPlayers).reduce((sum, players) => sum + players.length, 0);
    console.log(`✅ Collected ${totalPlayers} total players`);
    
    return {
      kLeague1,
      kLeague2,
      players: allPlayers
    };
  }
  
  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing TheSportsDB API connection...');
      const league = await this.getLeagueDetails(THESPORTSDB_LEAGUES.K_LEAGUE_1);
      
      if (league) {
        console.log(`✅ TheSportsDB API connection successful - Found league: ${league.strLeague}`);
        return true;
      } else {
        console.warn('⚠️ TheSportsDB API connected but no league data returned');
        return false;
      }
    } catch (error) {
      console.error('❌ TheSportsDB API connection failed:', error);
      return false;
    }
  }
}

// Factory function
export function createTheSportsDBClient(): TheSportsDBClient {
  return new TheSportsDBClient();
}