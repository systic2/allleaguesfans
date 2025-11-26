// scripts/sync/orchestrator.ts
import 'dotenv/config';
import { supa } from './lib/supabase.js';
import { mapTheSportsDBStandingToDomain, TheSportsDBStanding } from '../../src/lib/mappers/thesportsdb-mappers.js';
import type { Standing } from '../../src/types/domain';

// --- Configuration ---
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';
const TARGET_TABLE = 'standings_v2'; // Saving to a new table to avoid breaking the existing app

// --- TheSportsDB API Client ---
// For now, this is co-located. In a future refactor, this could move to its own file.
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
    console.log(`[TheSportsDB] ✅ Success: Received ${JSON.stringify(data).length} chars`);
    return data;
  }
  
  async getStandings(idLeague: string, season: string): Promise<TheSportsDBStanding[]> {
    const data = await this.fetch(
      `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/lookuptable.php?l=${idLeague}&s=${season}`
    );
    return data.table || [];
  }
}

// --- Main Orchestrator Logic ---
class StandingsOrchestrator {
  private client: TheSportsDBClient;
  
  constructor() {
    this.client = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }
  
  /**
   * Fetches, transforms, and saves standings data for a given set of leagues.
   */
  async syncStandings() {
    console.log(`
🚀 Starting Orchestrated Standings Sync for season ${SEASON_YEAR}...`);
    console.log(`🎯 Target table: ${TARGET_TABLE}`);
    
    const leagueMapping = [
      { id: '4689', name: 'K League 1' },
      { id: '4822', name: 'K League 2' }
    ];
    
    let totalImportedCount = 0;

    for (const league of leagueMapping) {
      try {
        console.log(`
🏆 Processing ${league.name}...`);
        
        // 1. Fetch raw data from the source API
        const rawStandings = await this.client.getStandings(league.id, SEASON_YEAR);
        if (rawStandings.length === 0) {
          console.log(`🟡 No standings data found for ${league.name}. Skipping.`);
          continue;
        }

        // 2. Map raw data to our standardized domain model (ACL)
        console.log(`[ACL] 🛡️  Mapping ${rawStandings.length} raw items to standardized domain model...`);
        const domainStandings: Standing[] = rawStandings.map(mapTheSportsDBStandingToDomain);
        console.log(`[ACL] ✅ Mapping complete.`);

        // 3. Clear existing data for the current league and season in the target table
        console.log(`[DB] 🧹 Clearing existing data for ${league.name} in '${TARGET_TABLE}'...`);
        const { error: deleteError } = await supa
          .from(TARGET_TABLE)
          .delete()
          .eq('leagueId', league.id)
          .eq('season', SEASON_YEAR);
        
        if (deleteError) {
          // This is not a fatal error, but should be logged.
          console.warn(`[DB] ⚠️ Could not clear existing data: ${deleteError.message}`);
        }

        // 4. Insert the clean, mapped data into the database
        console.log(`[DB] 💾 Inserting ${domainStandings.length} standardized standings into '${TARGET_TABLE}'...`);
        const { data, error: insertError } = await supa
          .from(TARGET_TABLE)
          .insert(domainStandings)
          .select();

        if (insertError) {
          console.error(`[DB] ❌ Insert failed for ${league.name}:`, insertError);
          // If insertion fails, we skip to the next league.
          continue;
        }

        totalImportedCount += data.length;
        console.log(`[DB] ✅ Successfully imported ${data.length} standings for ${league.name}.`);

        // 5. Rate limiting to be a good API citizen
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing league ${league.name}:`, error);
      }
    }
    
    console.log(`
🎉 Orchestrated Sync Finished!`);
    console.log(`Total standings imported into '${TARGET_TABLE}': ${totalImportedCount}`);
  }
}

// --- Main execution ---
async function main() {
  console.log('=======================================');
  console.log('Orchestrated Data Sync (v2)');
  console.log('=======================================');
  console.log('📝 PRE-REQUISITE:');
  console.log(`1. A database table named '${TARGET_TABLE}' must exist.`);
  console.log('2. The table schema must match the `Standing` interface in `src/types/domain.ts`.');
  console.log('   (Columns: rank, teamName, gamesPlayed, etc.)');
  console.log('---------------------------------------');
  
  const orchestrator = new StandingsOrchestrator();
  await orchestrator.syncStandings();
}

// This allows the script to be run directly from the command line
if (import.meta.main) {
  main().catch(error => {
    console.error('The script execution failed catastrophically.', error);
    process.exit(1);
  });
}
