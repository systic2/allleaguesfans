#!/usr/bin/env node
// scripts/sync/import-historical-champions-euro.ts
//
// The "지난 우승팀" (past champions) list on the league detail page reads
// standings_v2 rows with rank=1 and season < current season
// (see fetchHistoricalChampions in src/lib/api.ts). K League 1/2 got a
// one-time manual backfill (scripts/migrations/10-insert-historical-champions.sql)
// going back to 1983/2013, but the 5 European leagues never did — they only
// have the current + previous season from the regular daily sync, so once the
// current season is excluded only one row remains. This backfills real
// historical champion rows for those leagues from TheSportsDB, reusing the
// same mappers/schema as the live sync (scripts/sync/orchestrator.ts).
import 'dotenv/config';
import { supa } from './lib/supabase.js';
import {
  mapTheSportsDBStandingToDomain, TheSportsDBStanding,
  mapTheSportsDBTeamToDomain, TheSportsDBTeam,
} from '../../src/lib/mappers/thesportsdb-mappers.js';
import type { Standing, Team } from '../../src/types/domain';

const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || '460915';
const STANDINGS_V2_TABLE = 'standings_v2';
const TEAMS_V2_TABLE = 'teams_v2';

const LEAGUES = [
  { id: '4328', name: 'English Premier League' },
  { id: '4335', name: 'Spanish La Liga' },
  { id: '4332', name: 'Italian Serie A' },
  { id: '4331', name: 'German Bundesliga' },
  { id: '4334', name: 'French Ligue 1' },
];

// Split-format season: TheSportsDB's table endpoint wants "startYear-endYear",
// we store just the start year, mirroring getCurrentSeasonForFormat('split').
const now = new Date();
const currentStartYear = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
// currentStartYear and currentStartYear-1 are already covered by the daily sync
// (current + previous season); backfill the 15 seasons before that.
const HISTORICAL_START_YEARS = Array.from({ length: 15 }, (_, i) => currentStartYear - 2 - i);

async function fetchTable(leagueId: string, queryParam: string): Promise<TheSportsDBStanding[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}/lookuptable.php?l=${leagueId}&s=${queryParam}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`TheSportsDB API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return data.table || [];
}

async function main() {
  console.log('🏆 Historical European Champions Backfill');
  console.log(`Seasons: ${HISTORICAL_START_YEARS.map((y) => `${y}-${y + 1}`).join(', ')}\n`);

  let inserted = 0;
  let skippedExisting = 0;
  let skippedNoData = 0;
  let failed = 0;

  for (const league of LEAGUES) {
    console.log(`\n=== ${league.name} (${league.id}) ===`);

    for (const startYear of HISTORICAL_START_YEARS) {
      const dbSeason = String(startYear);
      const queryParam = `${startYear}-${startYear + 1}`;

      const { data: existing, error: existingError } = await supa
        .from(STANDINGS_V2_TABLE)
        .select('leagueId')
        .eq('leagueId', league.id)
        .eq('season', dbSeason)
        .limit(1);
      if (existingError) {
        console.error(`  ❌ ${dbSeason}: failed to check existing rows:`, existingError.message);
        failed++;
        continue;
      }
      if (existing && existing.length > 0) {
        console.log(`  ⏭️  ${dbSeason}: already has data, skipping`);
        skippedExisting++;
        continue;
      }

      try {
        const table = await fetchTable(league.id, queryParam);
        const championRaw = table.find((row) => row.intRank === '1');
        if (!championRaw) {
          console.log(`  ℹ️  ${dbSeason}: no table data from TheSportsDB, skipping`);
          skippedNoData++;
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const team: Team = mapTheSportsDBTeamToDomain(championRaw as unknown as TheSportsDBTeam);
        const { error: teamError } = await supa.from(TEAMS_V2_TABLE).upsert(team, { onConflict: 'id' });
        if (teamError) {
          console.error(`  ❌ ${dbSeason}: team upsert failed for ${team.name}:`, teamError.message);
          failed++;
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const standing: Standing = { ...mapTheSportsDBStandingToDomain(championRaw), season: dbSeason };
        const { error: standingError } = await supa.from(STANDINGS_V2_TABLE).insert(standing);
        if (standingError) {
          console.error(`  ❌ ${dbSeason}: standings insert failed for ${standing.teamName}:`, standingError.message);
          failed++;
        } else {
          console.log(`  ✅ ${dbSeason}: ${standing.teamName}`);
          inserted++;
        }
      } catch (err) {
        console.error(`  ❌ ${dbSeason}: request failed:`, err instanceof Error ? err.message : err);
        failed++;
      }

      // Rate limiting - matches the K League historical import script's pacing.
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log('\n\n📋 Summary:');
  console.log(`✅ Inserted: ${inserted}`);
  console.log(`⏭️  Already present: ${skippedExisting}`);
  console.log(`ℹ️  No data from TheSportsDB: ${skippedNoData}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
