// Fixed TheSportsDB API Integration - Matching Simple Schema
import 'dotenv/config';
import { supa } from './lib/supabase.js';

// Environment variables
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TheSportsDB_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!THESPORTSDB_API_KEY) {
  throw new Error('Missing THESPORTSDB_API_KEY environment variable');
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

// Pure Import Functions (Fixed for Simple Schema)
class FixedImporter {
  private thesportsdb: TheSportsDBClient;
  
  constructor() {
    this.thesportsdb = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }
  
  async importLeagues() {
    console.log('\\n📊 Starting Fixed League Import...');
    
    // K League IDs mapping
    const leagueMapping = [
      { idLeague: '4689', highlightly_id: 249276, name: 'K League 1' },
      { idLeague: '4822', highlightly_id: 250127, name: 'K League 2' }
    ];
    
    const results = [];
    
    for (const mapping of leagueMapping) {
      try {
        console.log(`\\n🏆 Processing ${mapping.name}...`);
        
        // Get TheSportsDB league data
        const leagueData = await this.thesportsdb.getLeague(mapping.idLeague);
        
        if (!leagueData) {
          console.warn(`⚠️ No data found for league ${mapping.idLeague}`);
          continue;
        }
        
        // Map to simple schema structure
        const simplifiedLeague = {
          idLeague: leagueData.idLeague,
          strLeague: leagueData.strLeague,
          strLeagueAlternate: leagueData.strLeagueAlternate,
          strSport: leagueData.strSport,
          strCountry: leagueData.strCountry,
          strCurrentSeason: leagueData.strCurrentSeason,
          intFormedYear: leagueData.intFormedYear,
          strWebsite: leagueData.strWebsite,
          highlightly_id: mapping.highlightly_id,
          strBadge: leagueData.strBadge,
          strLogo: leagueData.strLogo,
          strBanner: leagueData.strBanner,
          strDescriptionEN: leagueData.strDescriptionEN
        };
        
        console.log(`🔍 Inserting league:`, simplifiedLeague.strLeague);
        
        // Pure insert - no data transformation
        const { data, error } = await supa
          .from('leagues')
          .upsert(simplifiedLeague, { 
            onConflict: 'idLeague',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error(`❌ League import error for ${mapping.name}:`, error);
        } else {
          console.log(`✅ League imported: ${simplifiedLeague.strLeague}`);
          results.push(simplifiedLeague);
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
    console.log('\\n👥 Starting Fixed Team Import...');
    
    const allTeams = [];
    
    for (const league of leagues) {
      try {
        console.log(`\\n🏟️ Processing teams for ${league.strLeague}...`);
        
        // Get team list
        const teamList = await this.thesportsdb.getTeams(league.idLeague);
        console.log(`Found ${teamList.length} teams in list`);
        
        for (const teamBasic of teamList.slice(0, 5)) { // Limit to 5 teams for testing
          try {
            // Get detailed team data
            const teamData = await this.thesportsdb.getTeam(teamBasic.idTeam);
            
            if (!teamData) {
              console.warn(`⚠️ No detailed data for team ${teamBasic.idTeam}`);
              continue;
            }
            
            // Map to simple schema structure
            const simplifiedTeam = {
              idTeam: teamData.idTeam,
              strTeam: teamData.strTeam,
              strTeamAlternate: teamData.strTeamAlternate,
              idLeague: teamData.idLeague,
              strBadge: teamData.strBadge,
              strStadium: teamData.strStadium,
              strCountry: teamData.strCountry
            };
            
            console.log(`🔍 Inserting team:`, simplifiedTeam.strTeam);
            
            // Pure insert - no data transformation
            const { data, error } = await supa
              .from('teams')
              .upsert(simplifiedTeam, { 
                onConflict: 'idTeam',
                ignoreDuplicates: false 
              });
            
            if (error) {
              console.error(`❌ Team import error for ${teamData.strTeam}:`, error);
            } else {
              console.log(`✅ Team imported: ${teamData.strTeam}`);
              allTeams.push(simplifiedTeam);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
            
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
  
  async importEvents(leagues: any[]) {
    console.log('\\n⚽ Starting Fixed Event Import...');
    
    const allEvents = [];
    
    for (const league of leagues) {
      try {
        console.log(`\\n📅 Processing events for ${league.strLeague}...`);
        
        const events = await this.thesportsdb.getSchedule(league.idLeague, SEASON_YEAR);
        console.log(`Found ${events.length} events`);
        
        for (const eventData of events.slice(0, 10)) { // Limit to 10 events for testing
          try {
            // Map to simple schema structure
            const simplifiedEvent = {
              idEvent: eventData.idEvent,
              strEvent: eventData.strEvent,
              idLeague: eventData.idLeague,
              strHomeTeam: eventData.strHomeTeam,
              strAwayTeam: eventData.strAwayTeam,
              dateEvent: eventData.dateEvent,
              strStatus: eventData.strStatus
            };
            
            console.log(`🔍 Inserting event:`, simplifiedEvent.strEvent);
            
            // Pure insert - no data transformation
            const { data, error } = await supa
              .from('events')
              .upsert(simplifiedEvent, { 
                onConflict: 'idEvent',
                ignoreDuplicates: false 
              });
            
            if (error) {
              console.error(`❌ Event import error for ${eventData.strEvent}:`, error);
            } else {
              console.log(`✅ Event imported: ${eventData.strEvent}`);
              allEvents.push(simplifiedEvent);
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
  
  async runFullImport() {
    try {
      console.log('🚀 Starting Fixed Pure Import Process...');
      console.log('🎯 Fixed schema compatibility - Original JSON keys preserved where possible');
      
      const leagues = await this.importLeagues();
      
      if (leagues.length === 0) {
        console.log('❌ No leagues imported, stopping process');
        return;
      }
      
      const teams = await this.importTeams(leagues);
      const events = await this.importEvents(leagues);
      
      console.log('\\n🎉 Fixed Pure Import Finished!');
      console.log('📊 Final Summary:');
      console.log(`   - Leagues: ${leagues.length}`);
      console.log(`   - Teams: ${teams.length}`);
      console.log(`   - Events: ${events.length}`);
      
      return {
        leagues,
        teams,
        events
      };
      
    } catch (error) {
      console.error('❌ Fixed import failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const importer = new FixedImporter();
  await importer.runFullImport();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}