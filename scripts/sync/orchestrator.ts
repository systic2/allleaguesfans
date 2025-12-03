import 'dotenv/config';
import { supa } from './lib/supabase.js';
import { mapTheSportsDBStandingToDomain, TheSportsDBStanding, mapTheSportsDBEventToDomain, TheSportsDBEvent } from '../../src/lib/mappers/thesportsdb-mappers.js';
import type { Standing, Match } from '../../src/types/domain';

// --- Configuration ---
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';
const STANDINGS_V2_TABLE = 'standings_v2';
const EVENTS_V2_TABLE = 'events_v2';

// --- TheSportsDB API Client ---
class TheSportsDBClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch(url: string): Promise<any> {
    console.log(`[TheSportsDB] 🔍 Fetching: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AllLeaguesFans/2.0 (Orchestrated Sync)' }
    });
    
    if (!response.ok) {
      console.error(`[TheSportsDB] ❌ API error: ${response.status} ${response.statusText}`);
      throw new Error(`TheSportsDB API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[TheSportsDB] ✅ Success: Received data.`);
    return data;
  }
  
  async getStandings(idLeague: string, season: string): Promise<TheSportsDBStanding[]> {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/lookuptable.php?l=${idLeague}&s=${season}`
    );
    return data.table || [];
  }

  async getLeagueEvents(idLeague: string, season: string): Promise<TheSportsDBEvent[]> {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/eventsseason.php?id=${idLeague}&s=${season}`
    );
    return data.events || [];
  }
}

// --- Main Orchestrator Logic ---
class DataOrchestrator {
  private client: TheSportsDBClient;
  private leagueMapping = [
    { id: '4689', name: 'K League 1' },
    { id: '4822', name: 'K League 2' }
  ];
  
  constructor() {
    this.client = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }
  
  /**
   * Fetches, transforms, and saves standings data.
   */
  async syncStandings() {
    console.log(`
🚀 Starting Orchestrated Standings Sync for season ${SEASON_YEAR}...`);
    console.log(`🎯 Target table: ${STANDINGS_V2_TABLE}`);
    
    let totalImportedCount = 0;

    for (const league of this.leagueMapping) {
      try {
        console.log(`
🏆 [Standings] Processing ${league.name}...`);
        
        const rawStandings = await this.client.getStandings(league.id, SEASON_YEAR);
        if (rawStandings.length === 0) {
          console.log(`🟡 No standings data found for ${league.name}. Skipping.`);
          continue;
        }

        console.log(`[ACL] 🛡️  Mapping ${rawStandings.length} raw items to standardized domain model...`);
        const domainStandings: Standing[] = rawStandings.map(mapTheSportsDBStandingToDomain);

        console.log(`[DB] 🧹 Clearing existing data for ${league.name} in '${STANDINGS_V2_TABLE}'...`);
        await supa.from(STANDINGS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', SEASON_YEAR);
        
        console.log(`[DB] 💾 Inserting ${domainStandings.length} standardized standings into '${STANDINGS_V2_TABLE}'...`);
        const { data, error: insertError } = await supa.from(STANDINGS_V2_TABLE).insert(domainStandings).select();

        if (insertError) {
          console.error(`[DB] ❌ Insert failed for ${league.name}:`, insertError);
          continue;
        }

        totalImportedCount += data.length;
        console.log(`[DB] ✅ Successfully imported ${data.length} standings for ${league.name}.`);

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing standings for ${league.name}:`, error);
      }
    }
    
    console.log(`
🎉 Orchestrated Standings Sync Finished! Total imported: ${totalImportedCount}`);
  }

  /**
   * Fetches, transforms, and saves event data.
   */
  async syncEvents() {
    console.log(`
🚀 Starting Orchestrated Events Sync for season ${SEASON_YEAR}...`);
    console.log(`🎯 Target table: ${EVENTS_V2_TABLE}`);
    
    let totalImportedCount = 0;

    for (const league of this.leagueMapping) {
      try {
        console.log(`
⚽ [Events] Processing ${league.name}...`);
        
        const rawEvents = await this.client.getLeagueEvents(league.id, SEASON_YEAR);
        if (rawEvents.length === 0) {
          console.log(`🟡 No event data found for ${league.name}. Skipping.`);
          continue;
        }

        console.log(`[ACL] 🛡️  Mapping ${rawEvents.length} raw items to standardized domain model...`);
        const domainMatches: Match[] = rawEvents.map(mapTheSportsDBEventToDomain);

        console.log(`[DB] 🧹 Clearing existing data for ${league.name} in '${EVENTS_V2_TABLE}'...`);
        await supa.from(EVENTS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', SEASON_YEAR);
        
        console.log(`[DB] 💾 Inserting ${domainMatches.length} standardized matches into '${EVENTS_V2_TABLE}'...`);
        const { data, error: insertError } = await supa.from(EVENTS_V2_TABLE).insert(domainMatches).select();

        if (insertError) {
          console.error(`[DB] ❌ Insert failed for ${league.name}:`, insertError);
          continue;
        }

        totalImportedCount += data.length;
        console.log(`[DB] ✅ Successfully imported ${data.length} matches for ${league.name}.`);

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing events for ${league.name}:`, error);
      }
    }
    
    console.log(`
🎉 Orchestrated Events Sync Finished! Total imported: ${totalImportedCount}`);
  }
}

// --- Main execution ---
async function main() {
  console.log('=======================================');
  console.log('Orchestrated Data Sync (v2)');
  console.log('=======================================');
  
  const orchestrator = new DataOrchestrator();
  await orchestrator.syncStandings();
  await orchestrator.syncEvents();
  
  console.log('\n\n✅ All synchronization tasks completed.');
}

if (import.meta.main) {
  main().catch(error => {
    console.error('The script execution failed catastrophically.', error);
    process.exit(1);
  });
}
