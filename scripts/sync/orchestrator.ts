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
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY;
if (!THESPORTSDB_API_KEY) throw new Error('THESPORTSDB_API_KEY is not set');
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
    const response = await this.fetchWithRetry(url);
    
    const data = await response.json();
    // Check if data is empty or null (API sometimes returns "" or null for empty results)
    if (!data) {
      console.warn(`[TheSportsDB] ⚠️  API returned empty/null response.`);
      return {}; 
    }
    
    console.log(`[TheSportsDB] ✅ Success: Received data.`);
    return data;
  }
  
  // 네트워크 오류·429·5xx 는 2s/4s/8s 간격으로 최대 3번 재시도, 그 외 4xx 는 즉시 실패
  private async fetchWithRetry(url: string): Promise<Response> {
    const maxRetries = 3;
    for (let attempt = 0; ; attempt++) {
      let response: Response | undefined;
      let networkError: unknown;
      try {
        // Use a browser-like User-Agent to avoid potential blocking on CI environments
        response = await fetch(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
      } catch (error) {
        networkError = error;
      }

      if (response?.ok) return response;

      const retryable = !response || response.status === 429 || response.status >= 500;
      const reason = response ? `${response.status} ${response.statusText}` : String(networkError);
      if (!retryable || attempt >= maxRetries) {
        console.error(`[TheSportsDB] ❌ API error: ${reason}`);
        // Throwing error here to be caught by caller
        throw new Error(`TheSportsDB API error: ${response?.status ?? reason}`);
      }

      const delayMs = 2000 * 2 ** attempt;
      console.warn(`[TheSportsDB] ⚠️  ${reason} — retrying in ${delayMs / 1000}s (${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
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

// --- DB helpers ---
// 같은 키가 한 번의 upsert 에 두 번 들어가면 Postgres 가 21000 으로 전체를 거부하므로 마지막 값만 남긴다.
function dedupeBy<T>(rows: T[], key: (row: T) => string): T[] {
  return [...new Map(rows.map(row => [key(row), row])).values()];
}

// 이번 API 응답에 없는 행(리그·시즌 범위)만 지운다.
// 응답이 일부만 온 경우 대량 삭제를 막기 위해, 지울 행이 기존의 20%를 넘으면 건너뛴다.
async function deleteStaleRows(
  table: string, keyColumn: string, leagueId: string, season: string, keepKeys: string[], label: string
): Promise<boolean> {
  const { data: existing, error: selectError } = await supa
    .from(table).select(keyColumn).eq('leagueId', leagueId).eq('season', season);
  if (selectError) {
    console.error(`[DB] ❌ Failed to list existing ${table} rows for ${label}:`, selectError);
    return false;
  }

  const keep = new Set(keepKeys);
  const stale = (existing as unknown as Record<string, string>[]).map(row => String(row[keyColumn])).filter(key => !keep.has(key));
  if (stale.length === 0) return true;

  if (stale.length > existing!.length * 0.2) {
    console.warn(`[DB] ⚠️  Skipping stale cleanup for ${label}: ${stale.length}/${existing!.length} ${table} rows missing from API response (possible partial response).`);
    return true;
  }

  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await supa.from(table).delete()
      .eq('leagueId', leagueId).eq('season', season).in(keyColumn, stale.slice(i, i + 200));
    if (error) {
      console.error(`[DB] ❌ Stale ${table} cleanup failed for ${label}:`, error);
      return false;
    }
  }
  console.log(`[DB] 🧹 Removed ${stale.length} stale ${table} rows for ${label}.`);
  return true;
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
        const domainTeams: Team[] = dedupeBy(teamsFromStandings.map(mapTheSportsDBTeamToDomain), t => t.id);

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
        const domainStandings: Standing[] = dedupeBy(rawStandings.map(s => {
            const mapped = mapTheSportsDBStandingToDomain(s);
            return { ...mapped, season: dbValue };
        }), s => s.teamId);

        // 예전처럼 먼저 전부 지우면 insert 실패 시 순위가 비어 버리므로 upsert 후 사라진 팀만 지운다.
        console.log(`[DB] 💾 Upserting ${domainStandings.length} standings...`);
        const { data: standingsData, error: standingsUpsertError } = await supa
          .from(STANDINGS_V2_TABLE)
          .upsert(domainStandings, { onConflict: 'leagueId,teamId,season' })
          .select();

        if (standingsUpsertError) {
          console.error(`[DB] ❌ Standings upsert failed for ${league.name}:`, standingsUpsertError);
          hasCriticalError = true;
          continue;
        }

        if (!await deleteStaleRows(STANDINGS_V2_TABLE, 'teamId', league.id, dbValue, domainStandings.map(s => s.teamId), league.name)) {
          hasCriticalError = true;
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
        const domainEvents: Match[] = dedupeBy(rawEvents.map(e => {
            const mapped = mapTheSportsDBEventToDomain(e);
            return { ...mapped, season: dbValue };
        }), e => e.id);

        // 먼저 전부 지우면 insert 실패 시 경기가 비고 events_highlightly_enhanced 도 ON DELETE CASCADE 로
        // 매시간 함께 지워지므로, upsert 후 사라진 경기만 지운다.
        console.log(`[DB] 💾 Upserting ${domainEvents.length} events...`);
        const { data: eventsData, error: eventsUpsertError } = await supa
          .from(EVENTS_V2_TABLE)
          .upsert(domainEvents, { onConflict: 'id' })
          .select('id');

        if (eventsUpsertError) {
          console.error(`[DB] ❌ Event upsert failed for ${league.name}:`, eventsUpsertError);
          hasCriticalError = true;
          continue;
        }

        if (!await deleteStaleRows(EVENTS_V2_TABLE, 'id', league.id, dbValue, domainEvents.map(e => e.id), league.name)) {
          hasCriticalError = true;
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
