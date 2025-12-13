// scripts/sync/orchestrator.ts
// REFACTORED to ensure teams are synced from standings before events.
import 'dotenv/config';
import { supa } from './lib/supabase.js';
import { 
  mapTheSportsDBStandingToDomain, TheSportsDBStanding, 
  mapTheSportsDBEventToDomain, TheSportsDBEvent,
  mapTheSportsDBTeamToDomain, TheSportsDBTeam
} from '../../src/lib/mappers/thesportsdb-mappers.js';
import type { Standing, Match, Team } from '../../src/types/domain';

// --- Configuration ---
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';
const STANDINGS_V2_TABLE = 'standings_v2';
const EVENTS_V2_TABLE = 'events_v2';
const TEAMS_V2_TABLE = 'teams_v2';

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
    { id: '4689', name: 'K League 1', seasonFormat: 'single' },
    { id: '4822', name: 'K League 2', seasonFormat: 'single' },
    { id: '4328', name: 'English Premier League', seasonFormat: 'split' },
    { id: '4335', name: 'Spanish La Liga', seasonFormat: 'split' }
  ];
  
  constructor() {
    this.client = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }

  private getSeasonString(format: string): string {
    if (format === 'split') {
      const nextYear = parseInt(SEASON_YEAR) + 1;
      return `${SEASON_YEAR}-${nextYear}`;
    }
    return SEASON_YEAR;
  }
  
  /**
   * Fetches, transforms, and saves standings data.
   * As part of this process, it also extracts and upserts team information
   * into teams_v2 to ensure data integrity before syncing events.
   */
  async syncStandingsAndTeams() {
    console.log(`\n🚀 Starting Orchestrated Standings & Teams Sync for base year ${SEASON_YEAR}...`);
    
    let totalStandingsImported = 0;
    let totalTeamsUpserted = 0;

    for (const league of this.leagueMapping) {
      try {
        const seasonParam = this.getSeasonString(league.seasonFormat || 'single');
        console.log(`\n🏆 [Standings & Teams] Processing ${league.name} (${seasonParam})...`);
        
        const rawStandings = await this.client.getStandings(league.id, seasonParam);
        if (rawStandings.length === 0) {
          console.log(`🟡 No standings data found for ${league.name}. Skipping.`);
          continue;
        }

        // 1. Extract Team info from standings and upsert into teams_v2
        const teamsFromStandings: TheSportsDBTeam[] = rawStandings.map(s => ({ idTeam: s.idTeam, strTeam: s.strTeam, strBadge: s.strBadge }));
        console.log(`[ACL] 🛡️  Mapping ${teamsFromStandings.length} teams from standings...`);
        const domainTeams: Team[] = teamsFromStandings.map(mapTheSportsDBTeamToDomain);

        console.log(`[DB] 💾 Upserting ${domainTeams.length} teams into '${TEAMS_V2_TABLE}'...`);
        const { data: teamsData, error: teamsUpsertError } = await supa
          .from(TEAMS_V2_TABLE)
          .upsert(domainTeams, { onConflict: 'id' })
          .select();

        if (teamsUpsertError) {
          // This is a critical error, as events might fail if teams are not present.
          console.error(`[DB] ❌ CRITICAL: Team upsert failed for ${league.name}:`, teamsUpsertError);
          continue; // Skip to next league
        }
        totalTeamsUpserted += teamsData.length;
        console.log(`[DB] ✅ Successfully upserted ${teamsData.length} teams.`);
        
        // 2. Map and Insert Standings data
        console.log(`[ACL] 🛡️  Mapping ${rawStandings.length} standings...`);
        const domainStandings: Standing[] = rawStandings.map(s => {
            const mapped = mapTheSportsDBStandingToDomain(s);
            // Ensure we store the simplified "2025" season in DB for consistency, 
            // OR store "2025-2026". Currently the DB schema and app seem to expect "2025".
            // Let's stick to SEASON_YEAR ("2025") for the DB 'season' column to keep querying simple across leagues,
            // unless we want to distinguish. Given the input env is 2025, let's normalize to 2025 in DB.
            return { ...mapped, season: SEASON_YEAR };
        });

        console.log(`[DB] 🧹 Clearing existing standings for ${league.name} in '${STANDINGS_V2_TABLE}'...`);
        await supa.from(STANDINGS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', SEASON_YEAR);
        
        console.log(`[DB] 💾 Inserting ${domainStandings.length} standings into '${STANDINGS_V2_TABLE}'...`);
        const { data: standingsData, error: standingsInsertError } = await supa.from(STANDINGS_V2_TABLE).insert(domainStandings).select();

        if (standingsInsertError) {
          console.error(`[DB] ❌ Standings insert failed for ${league.name}:`, standingsInsertError);
          continue;
        }
        totalStandingsImported += standingsData.length;
        console.log(`[DB] ✅ Successfully imported ${standingsData.length} standings for ${league.name}.`);

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing standings & teams for ${league.name}:`, error);
      }
    }
    
    console.log(`\n🎉 Orchestrated Standings & Teams Sync Finished!`);
    console.log(`   - Total Teams Upserted: ${totalTeamsUpserted}`);
    console.log(`   - Total Standings Imported: ${totalStandingsImported}`);
  }

  async syncEvents() {
    console.log(`\n🚀 Starting Orchestrated Events Sync for base year ${SEASON_YEAR}...`);
    
    let totalEventsImported = 0;

    for (const league of this.leagueMapping) {
      try {
        const seasonParam = this.getSeasonString(league.seasonFormat || 'single');
        console.log(`\n⚽ [Events] Processing ${league.name} (${seasonParam})...`);
        
        const rawEvents = await this.client.getLeagueEvents(league.id, seasonParam);
        if (rawEvents.length === 0) {
          console.log(`🟡 No events found for ${league.name}. Skipping.`);
          continue;
        }

        console.log(`[ACL] 🛡️  Mapping ${rawEvents.length} events...`);
        const domainEvents: Match[] = rawEvents.map(e => {
            const mapped = mapTheSportsDBEventToDomain(e);
            // Normalize DB season to "2025"
            return { ...mapped, season: SEASON_YEAR };
        });

        console.log(`[DB] 🧹 Clearing existing events for ${league.name} in '${EVENTS_V2_TABLE}'...`);
        await supa.from(EVENTS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', SEASON_YEAR);
        
        console.log(`[DB] 💾 Inserting ${domainEvents.length} events into '${EVENTS_V2_TABLE}'...`);
        const { data: eventsData, error: eventsInsertError } = await supa.from(EVENTS_V2_TABLE).insert(domainEvents).select();

        if (eventsInsertError) {
          console.error(`[DB] ❌ Event insert failed for ${league.name}:`, eventsInsertError);
          continue;
        }
        totalEventsImported += eventsData.length;
        console.log(`[DB] ✅ Successfully imported ${eventsData.length} events for ${league.name}.`);

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing events for ${league.name}:`, error);
      }
    }
    
    console.log(`\n🎉 Orchestrated Events Sync Finished!`);
    console.log(`   - Total Events Imported: ${totalEventsImported}`);
  }
}

// --- Main execution ---
async function main() {
  console.log('=======================================');
  console.log('Orchestrated Data Sync (v2)');
  console.log('=======================================');
  
  const orchestrator = new DataOrchestrator();
  // Run Standings & Teams sync FIRST to ensure teams exist
  await orchestrator.syncStandingsAndTeams();
  // Then run Events sync
  await orchestrator.syncEvents();
  
  console.log('\n\n✅ All synchronization tasks completed.');
}

if (import.meta.main) {
  main().catch(error => {
    console.error('The script execution failed catastrophically.', error);
    process.exit(1);
  });
}
