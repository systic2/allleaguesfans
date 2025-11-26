// TheSportsDB API Integration - Pure Import (No Data Transformation)
import 'dotenv/config';
import { supa } from './lib/supabase.js';

// Environment variables
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TheSportsDB_KEY;
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY;
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!THESPORTSDB_API_KEY) {
  throw new Error('Missing THESPORTSDB_API_KEY environment variable');
}

if (!HIGHLIGHTLY_API_KEY) {
  throw new Error('Missing HIGHLIGHTLY_API_KEY environment variable');
}

// TheSportsDB API Client
class TheSportsDBClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch(url: string) {
    console.log(`🔍 Fetching: ${url}`);
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
    console.log(`✅ Success: Got ${JSON.stringify(data).length} chars`);
    return data;
  }
  
  async getLeague(idLeague: string) {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v2/json/lookup/league/${idLeague}`
    );
    return data.lookup?.[0] || null;
  }
  
  async getTeams(idLeague: string) {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v2/json/list/teams/${idLeague}`
    );
    return data.list || [];
  }
  
  async getTeam(idTeam: string) {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v2/json/lookup/team/${idTeam}`
    );
    return data.lookup?.[0] || null;
  }
  
  async getPlayers(idTeam: string) {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v2/json/list/players/${idTeam}`
    );
    return data.list || [];
  }
  
  async getSchedule(idLeague: string, season: string) {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v2/json/schedule/league/${idLeague}/${season}`
    );
    return data.schedule || [];
  }
}

// Highlightly API Client
class HighlightlyClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch(url: string) {
    console.log(`🔍 Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AllLeaguesFans/1.0 (Highlightly Integration)',
        'X-API-KEY': this.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Highlightly API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Success: Got ${JSON.stringify(data).length} chars`);
    return data;
  }
  
  async getLeagues(countryCode = 'KR') {
    const data = await this.fetch(
      `https://sports.highlightly.net/football/leagues?countryCode=${countryCode}`
    );
    return data.data || [];
  }
  
  async getStandings(leagueId: number, season: number) {
    const data = await this.fetch(
      `https://sports.highlightly.net/football/standings?leagueId=${leagueId}&season=${season}`
    );
    return data.groups || [];
  }
}

// Pure Import Functions (No Data Transformation)
class PureImporter {
  private thesportsdb: TheSportsDBClient;
  private highlightly: HighlightlyClient;
  
  constructor() {
    this.thesportsdb = new TheSportsDBClient(THESPORTSDB_API_KEY);
    this.highlightly = new HighlightlyClient(HIGHLIGHTLY_API_KEY);
  }
  
  async importLeagues() {
    console.log('\\n📊 Starting Pure League Import...');
    
    // K League IDs mapping
    const leagueMapping = [
      { idLeague: '4689', highlightly_id: 249276, name: 'K League 1' },
      { idLeague: '4822', highlightly_id: 250127, name: 'K League 2' }
    ];
    
    const results = [];
    
    for (const mapping of leagueMapping) {
      try {
        console.log(`\\n🏆 Processing ${mapping.name}...`);
        
        // Get TheSportsDB league data (original JSON structure)
        const leagueData = await this.thesportsdb.getLeague(mapping.idLeague);
        
        if (!leagueData) {
          console.warn(`⚠️ No data found for league ${mapping.idLeague}`);
          continue;
        }
        
        // Add Highlightly mapping
        leagueData.highlightly_id = mapping.highlightly_id;
        
        // Pure insert - no data transformation
        const { data, error } = await supa
          .from('leagues')
          .upsert(leagueData, { 
            onConflict: 'idLeague',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error(`❌ League import error for ${mapping.name}:`, error);
        } else {
          console.log(`✅ League imported: ${leagueData.strLeague}`);
          results.push(leagueData);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing league ${mapping.name}:`, error);
      }
    }
    
    console.log(`\\n🏆 League Import Complete: ${results.length} leagues imported`);
    return results;
  }
  
  async importTeams(leagues: any[]) {
    console.log('\\n👥 Starting Pure Team Import...');
    
    const allTeams = [];
    
    for (const league of leagues) {
      try {
        console.log(`\\n🏟️ Processing teams for ${league.strLeague}...`);
        
        // Get team list
        const teamList = await this.thesportsdb.getTeams(league.idLeague);
        console.log(`Found ${teamList.length} teams in list`);
        
        for (const teamBasic of teamList) {
          try {
            // Get detailed team data
            const teamData = await this.thesportsdb.getTeam(teamBasic.idTeam);
            
            if (!teamData) {
              console.warn(`⚠️ No detailed data for team ${teamBasic.idTeam}`);
              continue;
            }
            
            // Pure insert - no data transformation
            const { data, error } = await supa
              .from('teams')
              .upsert(teamData, { 
                onConflict: 'idTeam',
                ignoreDuplicates: false 
              });
            
            if (error) {
              console.error(`❌ Team import error for ${teamData.strTeam}:`, error);
            } else {
              console.log(`✅ Team imported: ${teamData.strTeam}`);
              allTeams.push(teamData);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`❌ Error processing team ${teamBasic.idTeam}:`, error);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing teams for league ${league.idLeague}:`, error);
      }
    }
    
    console.log(`\\n👥 Team Import Complete: ${allTeams.length} teams imported`);
    return allTeams;
  }
  
  async importPlayers(teams: any[]) {
    console.log('\\n🏃 Starting Pure Player Import...');
    
    const allPlayers = [];
    
    for (const team of teams) {
      try {
        console.log(`\\n⚽ Processing players for ${team.strTeam}...`);
        
        const players = await this.thesportsdb.getPlayers(team.idTeam);
        console.log(`Found ${players.length} players`);
        
        for (const playerData of players) {
          try {
            // Pure insert - no data transformation
            const { data, error } = await supa
              .from('players')
              .upsert(playerData, { 
                onConflict: 'idPlayer',
                ignoreDuplicates: false 
              });
            
            if (error) {
              console.error(`❌ Player import error for ${playerData.strPlayer}:`, error);
            } else {
              console.log(`✅ Player imported: ${playerData.strPlayer} (${playerData.strPosition})`);
              allPlayers.push(playerData);
            }
            
          } catch (error) {
            console.error(`❌ Error processing player ${playerData.idPlayer}:`, error);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing players for team ${team.idTeam}:`, error);
      }
    }
    
    console.log(`\\n🏃 Player Import Complete: ${allPlayers.length} players imported`);
    return allPlayers;
  }
  
  async importEvents(leagues: any[]) {
    console.log('\\n⚽ Starting Pure Event Import...');
    
    const allEvents = [];
    
    for (const league of leagues) {
      try {
        console.log(`\\n📅 Processing events for ${league.strLeague}...`);
        
        const events = await this.thesportsdb.getSchedule(league.idLeague, SEASON_YEAR);
        console.log(`Found ${events.length} events`);
        
        for (const eventData of events) {
          try {
            // Pure insert - no data transformation
            const { data, error } = await supa
              .from('events')
              .upsert(eventData, { 
                onConflict: 'idEvent',
                ignoreDuplicates: false 
              });
            
            if (error) {
              console.error(`❌ Event import error for ${eventData.strEvent}:`, error);
            } else {
              console.log(`✅ Event imported: ${eventData.strEvent} (${eventData.dateEvent})`);
              allEvents.push(eventData);
            }
            
          } catch (error) {
            console.error(`❌ Error processing event ${eventData.idEvent}:`, error);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing events for league ${league.idLeague}:`, error);
      }
    }
    
    console.log(`\\n⚽ Event Import Complete: ${allEvents.length} events imported`);
    return allEvents;
  }
  
  async importStandings() {
    console.log('\\n📊 Starting Pure Standing Import...');
    
    const leagueMapping = [
      { idLeague: '4689', highlightly_id: 249276, name: 'K League 1' },
      { idLeague: '4822', highlightly_id: 250127, name: 'K League 2' }
    ];
    
    const allStandings = [];
    
    for (const mapping of leagueMapping) {
      try {
        console.log(`\\n🏆 Processing standings for ${mapping.name}...`);
        
        const groups = await this.highlightly.getStandings(mapping.highlightly_id, parseInt(SEASON_YEAR));
        
        for (const group of groups) {
          for (const standing of group.standings) {
            try {
              // Prepare standing data with mapping
              const standingData = {
                league_id: mapping.highlightly_id,
                idLeague: mapping.idLeague,
                season: parseInt(SEASON_YEAR),
                group_name: group.name,
                team_id: standing.team.id,
                team_name: standing.team.name,
                team_logo: standing.team.logo,
                rank: standing.rank,
                points: standing.points,
                home_wins: standing.home.wins,
                home_draws: standing.home.draws,
                home_losses: standing.home.losses,
                home_games: standing.home.games,
                home_goals_for: standing.home.goalsFor,
                home_goals_against: standing.home.goalsAgainst,
                away_wins: standing.away.wins,
                away_draws: standing.away.draws,
                away_losses: standing.away.losses,
                away_games: standing.away.games,
                away_goals_for: standing.away.goalsFor,
                away_goals_against: standing.away.goalsAgainst,
                total_wins: standing.total.wins,
                total_draws: standing.total.draws,
                total_losses: standing.total.losses,
                total_games: standing.total.games,
                total_goals_for: standing.total.goalsFor,
                total_goals_against: standing.total.goalsAgainst,
                goal_difference: standing.total.goalDifference,
                form: standing.form
              };
              
              // Pure insert - no data transformation
              const { data, error } = await supa
                .from('standings')
                .upsert(standingData, { 
                  onConflict: 'league_id,season,team_id',
                  ignoreDuplicates: false 
                });
              
              if (error) {
                console.error(`❌ Standing import error for ${standingData.team_name}:`, error);
              } else {
                console.log(`✅ Standing imported: ${standingData.team_name} (Rank ${standingData.rank})`);
                allStandings.push(standingData);
              }
              
            } catch (error) {
              console.error(`❌ Error processing standing:`, error);
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing standings for league ${mapping.name}:`, error);
      }
    }
    
    console.log(`\\n📊 Standing Import Complete: ${allStandings.length} standings imported`);
    return allStandings;
  }
  
  async runFullImport() {
    try {
      console.log('🚀 Starting Complete Pure Import Process...');
      console.log('🎯 No data transformation - Original JSON keys preserved');
      
      const leagues = await this.importLeagues();
      const teams = await this.importTeams(leagues);
      const players = await this.importPlayers(teams);
      const events = await this.importEvents(leagues);
      const standings = await this.importStandings();
      
      console.log('\\n🎉 Complete Pure Import Finished!');
      console.log('📊 Final Summary:');
      console.log(`   - Leagues: ${leagues.length}`);
      console.log(`   - Teams: ${teams.length}`);
      console.log(`   - Players: ${players.length}`);
      console.log(`   - Events: ${events.length}`);
      console.log(`   - Standings: ${standings.length}`);
      
      return {
        leagues,
        teams,
        players,
        events,
        standings
      };
      
    } catch (error) {
      console.error('❌ Pure import failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const importer = new PureImporter();
  await importer.runFullImport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}