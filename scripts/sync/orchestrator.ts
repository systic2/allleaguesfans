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
    { id: '4335', name: 'Spanish La Liga', seasonFormat: 'split' },
    { id: '4332', name: 'Italian Serie A', seasonFormat: 'split' },
    { id: '4331', name: 'German Bundesliga', seasonFormat: 'split' },
    { id: '4334', name: 'French Ligue 1', seasonFormat: 'split' }
  ];
  
  constructor() {
    this.client = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }

  /**
   * Calculates the current active season based on today's date and league format.
   * @param format 'single' (Spring-Autumn) or 'split' (Autumn-Spring)
   * @returns object with { queryParam: string, dbValue: string }
   */
  private getCurrentSeason(format: string): { queryParam: string, dbValue: string } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    if (format === 'split') {
      // European Leagues (Start ~Aug, End ~May)
      // If we are in Jan-June (1-6), we belong to the season that started previous year.
      // If we are in July-Dec (7-12), we belong to the season starting this year.
      const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;
      const endYear = startYear + 1;
      return {
        queryParam: `${startYear}-${endYear}`, // e.g., "2025-2026"
        dbValue: String(startYear) // We store the base year "2025" in DB for consistency
      };
    } else {
      // K-League / Asian Leagues (Start ~Mar, End ~Nov)
      // Usually matches the calendar year.
      // Note: In Jan/Feb, this will return the new year (e.g., 2026), which might not have data yet.
      // But user requested "based on today's date".
      return {
        queryParam: String(currentYear),
        dbValue: String(currentYear)
      };
    }
  }
  
  /**
   * Fetches, transforms, and saves standings data.
   */
  async syncStandingsAndTeams() {
    console.log(`\n🚀 Starting Orchestrated Standings & Teams Sync (Dynamic Season)...`);
    
    let totalStandingsImported = 0;
    let totalTeamsUpserted = 0;

    for (const league of this.leagueMapping) {
      try {
        const { queryParam, dbValue } = this.getCurrentSeason(league.seasonFormat || 'single');
        console.log(`\n🏆 [Standings & Teams] Processing ${league.name} (Season: ${queryParam}, DB: ${dbValue})...`);
        
        const rawStandings = await this.client.getStandings(league.id, queryParam);
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
          console.error(`[DB] ❌ CRITICAL: Team upsert failed for ${league.name}:`, teamsUpsertError);
          continue; 
        }
        totalTeamsUpserted += teamsData.length;
        console.log(`[DB] ✅ Successfully upserted ${teamsData.length} teams.`);
        
        // 2. Map and Insert Standings data
        console.log(`[ACL] 🛡️  Mapping ${rawStandings.length} standings...`);
        const domainStandings: Standing[] = rawStandings.map(s => {
            const mapped = mapTheSportsDBStandingToDomain(s);
            // Store the normalized base year in DB
            return { ...mapped, season: dbValue };
        });

        console.log(`[DB] 🧹 Clearing existing standings for ${league.name} (Season ${dbValue})...`);
        await supa.from(STANDINGS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', dbValue);
        
        console.log(`[DB] 💾 Inserting ${domainStandings.length} standings...`);
        const { data: standingsData, error: standingsInsertError } = await supa.from(STANDINGS_V2_TABLE).insert(domainStandings).select();

        if (standingsInsertError) {
          console.error(`[DB] ❌ Standings insert failed for ${league.name}:`, standingsInsertError);
          continue;
        }
        totalStandingsImported += standingsData.length;
        console.log(`[DB] ✅ Successfully imported ${standingsData.length} standings.`);

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
    console.log(`\n🚀 Starting Orchestrated Events Sync (Dynamic Season)...`);
    
    let totalEventsImported = 0;

    for (const league of this.leagueMapping) {
      try {
        const { queryParam, dbValue } = this.getCurrentSeason(league.seasonFormat || 'single');
        console.log(`\n⚽ [Events] Processing ${league.name} (Season: ${queryParam}, DB: ${dbValue})...`);
        
        const rawEvents = await this.client.getLeagueEvents(league.id, queryParam);
        if (rawEvents.length === 0) {
          console.log(`🟡 No events found for ${league.name}. Skipping.`);
          continue;
        }

        console.log(`[ACL] 🛡️  Mapping ${rawEvents.length} events...`);
        const domainEvents: Match[] = rawEvents.map(e => {
            const mapped = mapTheSportsDBEventToDomain(e);
            // Normalize DB season
            return { ...mapped, season: dbValue };
        });

        console.log(`[DB] 🧹 Clearing existing events for ${league.name} (Season ${dbValue})...`);
        await supa.from(EVENTS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', dbValue);
        
        console.log(`[DB] 💾 Inserting ${domainEvents.length} events...`);
        const { data: eventsData, error: eventsInsertError } = await supa.from(EVENTS_V2_TABLE).insert(domainEvents).select();

        if (eventsInsertError) {
          console.error(`[DB] ❌ Event insert failed for ${league.name}:`, eventsInsertError);
          continue;
        }
        totalEventsImported += eventsData.length;
        console.log(`[DB] ✅ Successfully imported ${eventsData.length} events.`);

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
  console.log('Orchestrated Data Sync (v2) - Dynamic Season');
  console.log('=======================================');
  
  const orchestrator = new DataOrchestrator();
  await orchestrator.syncStandingsAndTeams();
  await orchestrator.syncEvents();
  
  console.log('\n\n✅ All synchronization tasks completed.');
}

if (import.meta.main) {
  main().catch(error => {
    console.error('The script execution failed catastrophically.', error);
    process.exit(1);
  });
}