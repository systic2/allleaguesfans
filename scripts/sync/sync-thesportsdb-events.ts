// Sync TheSportsDB Events (Pure JSON Structure)
import 'dotenv/config';
import { supa } from './lib/supabase.js';

// Environment variables
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TheSportsDB_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!THESPORTSDB_API_KEY) {
  throw new Error('Missing THESPORTSDB_API_KEY environment variable');
}

// TheSportsDB Events API Types (Pure Original JSON Structure)
interface TheSportsDBEvent {
  idEvent: string;
  idAPIfootball?: string;
  strEvent: string;
  strEventAlternate?: string;
  strFilename?: string;
  strSport?: string;
  idLeague: string;
  strLeague: string;
  strLeagueBadge?: string;
  strSeason: string;
  strDescriptionEN?: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore?: string;
  intRound?: string;
  intAwayScore?: string;
  intSpectators?: string;
  strOfficial?: string;
  strTimestamp?: string;
  dateEvent: string;
  dateEventLocal?: string;
  strTime?: string;
  strTimeLocal?: string;
  strGroup?: string;
  idHomeTeam?: string;
  strHomeTeamBadge?: string;
  idAwayTeam?: string;
  strAwayTeamBadge?: string;
  intScore?: string;
  intScoreVotes?: string;
  strResult?: string;
  idVenue?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strPoster?: string;
  strSquare?: string;
  strFanart?: string;
  strThumb?: string;
  strBanner?: string;
  strMap?: string;
  strTweet1?: string;
  strTweet2?: string;
  strTweet3?: string;
  strVideo?: string;
  strStatus?: string;
  strPostponed?: string;
  strLocked?: string;
}

interface TheSportsDBEventsResponse {
  events: TheSportsDBEvent[];
}

// TheSportsDB Events API Client (Pure)
class PureTheSportsDBEventsClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch(url: string) {
    console.log(`🔍 Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AllLeaguesFans/1.0 (TheSportsDB Pure Events Integration)',
        'X-API-KEY': this.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Success: Got ${JSON.stringify(data).length} chars`);
    return data;
  }
  
  async getLeagueEvents(idLeague: string, season: string): Promise<TheSportsDBEvent[]> {
    const data: TheSportsDBEventsResponse = await this.fetch(
      `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/eventsseason.php?id=${idLeague}&s=${season}`
    );
    return data.events || [];
  }
}

// Pure Events Import Manager (No Mapping)
class PureEventsImporter {
  private client: PureTheSportsDBEventsClient;
  
  constructor() {
    this.client = new PureTheSportsDBEventsClient(THESPORTSDB_API_KEY);
  }
  
  async importPureEvents() {
    console.log('\\n⚽ Starting Pure TheSportsDB Events Import...');
    console.log('🎯 Direct JSON to database mapping - Zero transformation');
    
    // K League IDs mapping (TheSportsDB)
    const leagueMapping = [
      { idLeague: '4689', name: 'K League 1' },
      { idLeague: '4822', name: 'K League 2' }
    ];
    
    const allEvents: TheSportsDBEvent[] = [];
    
    for (const league of leagueMapping) {
      try {
        console.log(`\\n🏆 Processing pure events for ${league.name}...`);
        
        // Clear existing events for this league and season (Pure TheSportsDB schema)
        console.log(`🧹 Clearing existing events for ${league.name} season ${SEASON_YEAR}...`);
        const { error: deleteError } = await supa
          .from('events')
          .delete()
          .eq('idLeague', league.idLeague)
          .eq('strSeason', SEASON_YEAR);
        
        if (deleteError) {
          console.warn(`⚠️ Error clearing existing data: ${deleteError.message}`);
        }
        
        // Get events data from TheSportsDB
        const events = await this.client.getLeagueEvents(league.idLeague, SEASON_YEAR);
        console.log(`Found ${events.length} events in ${league.name}`);
        
        // Show raw TheSportsDB data for verification
        console.log(`\\n📋 Pure TheSportsDB Events Sample (${league.name}):`);
        if (events.length > 0) {
          const sample = events[0];
          console.log(`   ⚽ ${sample.strEvent}`);
          console.log(`   📅 ${sample.dateEvent} ${sample.strTimeLocal || sample.strTime}`);
          console.log(`   🏟️ Round ${sample.intRound || 'N/A'}`);
          console.log(`   📊 Score: ${sample.intHomeScore || '?'} - ${sample.intAwayScore || '?'}`);
          console.log(`   🔖 Status: ${sample.strStatus || 'Unknown'}`);
          console.log(`   🎯 League: ${sample.strLeague} (ID: ${sample.idLeague})`);
        }
        
        let importedCount = 0;
        for (const event of events) {
          try {
            console.log(`🔍 Importing PURE: ${event.strEvent} (${event.dateEvent})`);
            
            // Direct insert - NO MAPPING - Pure TheSportsDB structure
            const pureEvent = {
              idEvent: event.idEvent,
              idAPIfootball: event.idAPIfootball || null,
              strEvent: event.strEvent,
              strEventAlternate: event.strEventAlternate || null,
              strFilename: event.strFilename || null,
              strSport: event.strSport || null,
              idLeague: event.idLeague,
              strLeague: event.strLeague,
              strLeagueBadge: event.strLeagueBadge || null,
              strSeason: event.strSeason || SEASON_YEAR,
              strDescriptionEN: event.strDescriptionEN || null,
              strHomeTeam: event.strHomeTeam,
              strAwayTeam: event.strAwayTeam,
              intHomeScore: event.intHomeScore || null,
              intRound: event.intRound || null,
              intAwayScore: event.intAwayScore || null,
              intSpectators: event.intSpectators || null,
              strOfficial: event.strOfficial || null,
              strTimestamp: event.strTimestamp || null,
              dateEvent: event.dateEvent,
              dateEventLocal: event.dateEventLocal || null,
              strTime: event.strTime || null,
              strTimeLocal: event.strTimeLocal || null,
              strGroup: event.strGroup || null,
              idHomeTeam: event.idHomeTeam || null,
              strHomeTeamBadge: event.strHomeTeamBadge || null,
              idAwayTeam: event.idAwayTeam || null,
              strAwayTeamBadge: event.strAwayTeamBadge || null,
              intScore: event.intScore || null,
              intScoreVotes: event.intScoreVotes || null,
              strResult: event.strResult || null,
              idVenue: event.idVenue || null,
              strVenue: event.strVenue || null,
              strCountry: event.strCountry || null,
              strCity: event.strCity || null,
              strPoster: event.strPoster || null,
              strSquare: event.strSquare || null,
              strFanart: event.strFanart || null,
              strThumb: event.strThumb || null,
              strBanner: event.strBanner || null,
              strMap: event.strMap || null,
              strTweet1: event.strTweet1 || null,
              strTweet2: event.strTweet2 || null,
              strTweet3: event.strTweet3 || null,
              strVideo: event.strVideo || null,
              strStatus: event.strStatus || null,
              strPostponed: event.strPostponed || null,
              strLocked: event.strLocked || null
            };
            
            const { data, error } = await supa
              .from('events')
              .insert(pureEvent)
              .select();
            
            if (error) {
              console.error(`❌ Pure import error for ${event.strEvent}:`, error);
            } else {
              console.log(`✅ PURE IMPORTED: ${event.strEvent} (${event.dateEvent})`);
              allEvents.push(event);
              importedCount++;
            }
            
          } catch (error) {
            console.error(`❌ Error processing ${event.strEvent}:`, error);
          }
        }
        
        console.log(`📊 ${league.name}: ${importedCount}/${events.length} events imported`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing league ${league.name}:`, error);
      }
    }
    
    console.log(`\\n⚽ Pure Events Import Complete: ${allEvents.length} events imported`);
    return allEvents;
  }
  
  async runFullSync() {
    try {
      console.log('🚀 Starting Pure TheSportsDB Events Final Sync...');
      console.log('🎯 ZERO transformation - Direct API to database');
      console.log('📋 Original TheSportsDB JSON structure preserved 100%');
      console.log('💾 Database schema: Pure TheSportsDB column names');
      console.log('⚽ Event data: Fixtures, results, and schedules');
      
      const events = await this.importPureEvents();
      
      console.log('\\n🎉 Pure TheSportsDB Events Sync Finished!');
      console.log('📊 Final Summary:');
      console.log(`   - Total Events: ${events.length}`);
      console.log(`   - Season: ${SEASON_YEAR}`);
      console.log(`   - Data Source: TheSportsDB v1 eventsseason API (100% PURE)`);
      console.log(`   - Schema: Pure TheSportsDB (zero mapping, zero transformation)`);
      console.log(`   - Column Names: Original JSON keys (idEvent, strEvent, dateEvent, etc.)`);
      
      // Generate league breakdown using pure TheSportsDB data
      const leagueSummary = events.reduce((acc, event) => {
        const idLeague = event.idLeague;
        const leagueName = idLeague === '4689' ? 'K League 1' : idLeague === '4822' ? 'K League 2' : `League ${idLeague}`;
        if (!acc[leagueName]) {
          acc[leagueName] = {
            total: 0,
            finished: 0,
            upcoming: 0
          };
        }
        acc[leagueName].total++;
        if (event.strStatus === 'Match Finished') {
          acc[leagueName].finished++;
        } else {
          acc[leagueName].upcoming++;
        }
        return acc;
      }, {} as Record<string, { total: number; finished: number; upcoming: number }>);
      
      console.log('\\n📋 League Events Summary (Pure TheSportsDB Data):');
      Object.entries(leagueSummary).forEach(([league, stats]) => {
        console.log(`   - ${league}: ${stats.total} events (${stats.finished} finished, ${stats.upcoming} upcoming)`);
      });
      
      console.log('\\n🔧 Pure TheSportsDB Events Structure:');
      console.log(`   - Original League IDs: ${events.map(e => e.idLeague).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
      console.log(`   - Column Names: All original TheSportsDB JSON keys preserved`);
      console.log(`   - Data Types: All TEXT (matches TheSportsDB API exactly)`);
      console.log(`   - Season: ${SEASON_YEAR} (strSeason column)`);
      console.log(`   - Events Include: Fixtures, scores, venues, teams, dates, status`);
      
      return events;
      
    } catch (error) {
      console.error('❌ Pure events sync failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  console.log('🎯 Pure TheSportsDB Events Final Sync');
  console.log('====================================');
  console.log('📝 Requirements:');
  console.log('1. Database schema must use pure TheSportsDB structure');
  console.log('2. Apply pure-thesportsdb-events-schema.sql first');
  console.log('3. Table columns: idEvent, strEvent, dateEvent, etc.');
  console.log('\\n🚀 Starting events sync...');
  
  const importer = new PureEventsImporter();
  await importer.runFullSync();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PureEventsImporter };