// scripts/sync/orchestrator.ts
// REFACTORED to ensure teams are synced from standings before events.
// Enhanced error handling and User-Agent for GitHub Actions environment.
import 'dotenv/config';
import { supa } from './lib/supabase.js';
import { 
  mapTheSportsDBStandingToDomain, TheSportsDBStanding, 
  mapTheSportsDBEventToDomain, TheSportsDBEvent,
  mapTheSportsDBTeamToDomain, TheSportsDBTeam
} from '../../src/lib/mappers/thesportsdb-mappers.js';
import type { Standing, Match, Team } from '../../src/types/domain';
import { getCurrentSeasonForFormat } from '../../src/lib/season.js';

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
    // Use a browser-like User-Agent to avoid potential blocking on CI environments
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`[TheSportsDB] ❌ API error: ${response.status} ${response.statusText}`);
      // Throwing error here to be caught by caller
      throw new Error(`TheSportsDB API error: ${response.status}`);
    }
    
    const data = await response.json();
    // Check if data is empty or null (API sometimes returns "" or null for empty results)
    if (!data) {
      console.warn(`[TheSportsDB] ⚠️  API returned empty/null response.`);
      return {}; 
    }
    
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

  private getCurrentSeason(format: string): { queryParam: string, dbValue: string } {
    return getCurrentSeasonForFormat(format);
  }
  
  /**
   * Fetches, transforms, and saves standings data.
   * Returns true if successful, false if critical errors occurred.
   */
  async syncStandingsAndTeams(): Promise<boolean> {
    console.log(`\n🚀 Starting Orchestrated Standings & Teams Sync (Dynamic Season)...`);
    
    let totalStandingsImported = 0;
    let totalTeamsUpserted = 0;
    let hasCriticalError = false;

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
          hasCriticalError = true;
          continue; 
        }
        totalTeamsUpserted += teamsData.length;
        console.log(`[DB] ✅ Successfully upserted ${teamsData.length} teams.`);
        
        // 2. Map and Insert Standings data
        console.log(`[ACL] 🛡️  Mapping ${rawStandings.length} standings...`);
        const domainStandings: Standing[] = rawStandings.map(s => {
            const mapped = mapTheSportsDBStandingToDomain(s);
            return { ...mapped, season: dbValue };
        });

        console.log(`[DB] 🧹 Clearing existing standings for ${league.name} (Season ${dbValue})...`);
        await supa.from(STANDINGS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', dbValue);
        
        console.log(`[DB] 💾 Inserting ${domainStandings.length} standings...`);
        const { data: standingsData, error: standingsInsertError } = await supa.from(STANDINGS_V2_TABLE).insert(domainStandings).select();

        if (standingsInsertError) {
          console.error(`[DB] ❌ Standings insert failed for ${league.name}:`, standingsInsertError);
          hasCriticalError = true;
          continue;
        }
        totalStandingsImported += standingsData.length;
        console.log(`[DB] ✅ Successfully imported ${standingsData.length} standings.`);

        // Keep the leagues table's displayed season in sync with what this run just
        // persisted. Only done after a successful standings write so the badge never
        // points at a season with no backing data. Previously this column was set once
        // by a one-off script and never refreshed, so the UI season badge stayed stuck.
        const { data: leagueSeasonRows, error: leagueSeasonError } = await supa
          .from('leagues')
          .update({ strCurrentSeason: dbValue })
          .eq('idLeague', league.id)
          .select('idLeague');
        if (leagueSeasonError) {
          console.error(`[DB] ❌ Failed to update strCurrentSeason for ${league.name}:`, leagueSeasonError);
          hasCriticalError = true;
        } else if (!leagueSeasonRows || leagueSeasonRows.length === 0) {
          console.error(`[DB] ❌ strCurrentSeason update matched no row for ${league.name} (idLeague=${league.id}).`);
          hasCriticalError = true;
        }

        // Short delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing standings & teams for ${league.name}:`, error);
        hasCriticalError = true;
      }
    }
    
    console.log(`\n🎉 Orchestrated Standings & Teams Sync Finished!`);
    console.log(`   - Total Teams Upserted: ${totalTeamsUpserted}`);
    console.log(`   - Total Standings Imported: ${totalStandingsImported}`);
    
    return !hasCriticalError;
  }

  /**
   * Returns true if successful, false if critical errors occurred.
   */
  async syncEvents(): Promise<boolean> {
    console.log(`\n🚀 Starting Orchestrated Events Sync (Dynamic Season)...`);
    
    let totalEventsImported = 0;
    let hasCriticalError = false;

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
            return { ...mapped, season: dbValue };
        });

        console.log(`[DB] 🧹 Clearing existing events for ${league.name} (Season ${dbValue})...`);
        await supa.from(EVENTS_V2_TABLE).delete().eq('leagueId', league.id).eq('season', dbValue);
        
        console.log(`[DB] 💾 Inserting ${domainEvents.length} events...`);
        const { data: eventsData, error: eventsInsertError } = await supa.from(EVENTS_V2_TABLE).insert(domainEvents).select();

        if (eventsInsertError) {
          console.error(`[DB] ❌ Event insert failed for ${league.name}:`, eventsInsertError);
          hasCriticalError = true;
          continue;
        }
        totalEventsImported += eventsData.length;
        console.log(`[DB] ✅ Successfully imported ${eventsData.length} events.`);

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ A critical error occurred while processing events for ${league.name}:`, error);
        hasCriticalError = true;
      }
    }
    
    console.log(`\n🎉 Orchestrated Events Sync Finished!`);
    console.log(`   - Total Events Imported: ${totalEventsImported}`);
    
    return !hasCriticalError;
  }
}

// --- Main execution ---
async function main() {
  console.log('=======================================');
  console.log('Orchestrated Data Sync (v2) - Dynamic Season');
  console.log('=======================================');
  
  const orchestrator = new DataOrchestrator();
  
  const standingsSuccess = await orchestrator.syncStandingsAndTeams();
  const eventsSuccess = await orchestrator.syncEvents();
  
  if (!standingsSuccess || !eventsSuccess) {
    console.error('\n❌ Some sync tasks failed. Check logs for details.');
    process.exit(1); // Exit with error code to notify GitHub Actions
  }
  
  console.log('\n\n✅ All synchronization tasks completed successfully.');
}

// Execute the main function directly
main().catch(error => {
  console.error('The script execution failed catastrophically.', error);
  process.exit(1);
});
