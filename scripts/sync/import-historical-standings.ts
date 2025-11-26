#!/usr/bin/env node
/**
 * Import historical K League standings from TheSportsDB
 * Fetches past season data (2024, 2023, 2022, etc.) for historical champions display
 */

import 'dotenv/config';
import { supa } from './lib/supabase.js';

// Environment variables
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TheSportsDB_KEY || '460915';

if (!THESPORTSDB_API_KEY) {
  throw new Error('Missing THESPORTSDB_API_KEY environment variable');
}

// TheSportsDB API Types
interface TheSportsDBStanding {
  idStanding: string;
  intRank: string;
  idTeam: string;
  strTeam: string;
  strBadge: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strForm: string;
  strDescription: string;
  intPlayed: string;
  intWin: string;
  intLoss: string;
  intDraw: string;
  intGoalsFor: string;
  intGoalsAgainst: string;
  intGoalDifference: string;
  intPoints: string;
  dateUpdated?: string;
}

interface TheSportsDBStandingsResponse {
  table: TheSportsDBStanding[];
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
        'User-Agent': 'AllLeaguesFans/1.0 (Historical Data Import)',
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

  async getStandings(idLeague: string, season: string): Promise<TheSportsDBStanding[]> {
    const data: TheSportsDBStandingsResponse = await this.fetch(
      `https://www.thesportsdb.com/api/v1/json/${this.apiKey}/lookuptable.php?l=${idLeague}&s=${season}`
    );
    return data.table || [];
  }
}

// Historical Data Importer
class HistoricalStandingsImporter {
  private client: TheSportsDBClient;

  constructor() {
    this.client = new TheSportsDBClient(THESPORTSDB_API_KEY);
  }

  async importHistoricalSeasons() {
    console.log('\n📚 Starting Historical K League Standings Import...');
    console.log('🎯 Importing past seasons for historical champions display\n');

    // Define leagues and historical seasons to import
    const leagues = [
      { idLeague: '4689', name: 'K League 1' },
      { idLeague: '4822', name: 'K League 2' }
    ];

    // Historical seasons (last 10 years)
    const currentYear = new Date().getFullYear();
    const historicalSeasons = Array.from(
      { length: 10 },
      (_, i) => String(currentYear - 1 - i)
    ).reverse(); // [2015, 2016, ..., 2024]

    console.log(`📅 Seasons to import: ${historicalSeasons.join(', ')}\n`);

    let totalImported = 0;
    let totalFailed = 0;

    for (const league of leagues) {
      console.log(`\n🏆 Processing ${league.name} (${league.idLeague})...`);

      for (const season of historicalSeasons) {
        try {
          console.log(`\n  📊 Season ${season}...`);

          // Check if data already exists
          const { data: existing } = await supa
            .from('standings')
            .select('idStanding')
            .eq('idLeague', league.idLeague)
            .eq('strSeason', season)
            .limit(1);

          if (existing && existing.length > 0) {
            console.log(`  ⏭️  Season ${season} already exists, skipping`);
            continue;
          }

          // Fetch standings from TheSportsDB
          const standings = await this.client.getStandings(league.idLeague, season);

          if (!standings || standings.length === 0) {
            console.log(`  ℹ️  No data available for season ${season}`);
            continue;
          }

          console.log(`  📥 Found ${standings.length} teams`);

          // Import to database (remove dateUpdated as it may not exist in schema)
          const standingsToInsert = standings.map(s => {
            const { dateUpdated, ...rest } = s;
            return rest;
          });

          const { error } = await supa
            .from('standings')
            .upsert(standingsToInsert, {
              onConflict: 'idStanding',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`  ❌ Error importing season ${season}:`, error.message);
            totalFailed++;
          } else {
            console.log(`  ✅ Successfully imported ${standings.length} teams`);
            totalImported += standings.length;

            // Show champion
            const champion = standings.find(s => s.intRank === '1');
            if (champion) {
              console.log(`  🏆 Champion: ${champion.strTeam} (${champion.intPoints} pts)`);
            }
          }

          // Rate limiting - wait 1 second between requests
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`  ❌ Failed to import season ${season}:`, error);
          totalFailed++;
        }
      }
    }

    console.log('\n\n📋 Import Summary:');
    console.log(`✅ Total teams imported: ${totalImported}`);
    console.log(`❌ Failed seasons: ${totalFailed}`);

    // Verify champions
    await this.verifyHistoricalChampions();
  }

  async verifyHistoricalChampions() {
    console.log('\n\n🔍 Verifying Historical Champions...');

    const currentYear = new Date().getFullYear();

    for (const idLeague of ['4689', '4822']) {
      const leagueName = idLeague === '4689' ? 'K League 1' : 'K League 2';
      console.log(`\n🏆 ${leagueName}:`);

      const { data: champions } = await supa
        .from('standings')
        .select('strSeason, strTeam, intPoints, intPlayed')
        .eq('idLeague', idLeague)
        .eq('intRank', 1)
        .lt('strSeason', String(currentYear))
        .order('strSeason', { ascending: false })
        .limit(10);

      if (!champions || champions.length === 0) {
        console.log('  ℹ️  No historical champions data available');
      } else {
        console.log(`  Found ${champions.length} historical champions:`);
        champions.forEach(c => {
          console.log(`  - ${c.strSeason}: ${c.strTeam} (${c.intPoints} pts, ${c.intPlayed} games)`);
        });
      }
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Historical K League Standings Importer');
  console.log('=' .repeat(60));

  try {
    const importer = new HistoricalStandingsImporter();
    await importer.importHistoricalSeasons();

    console.log('\n\n✅ Historical data import completed successfully!');
    console.log('🎉 Historical champions should now be visible on league pages');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main();
