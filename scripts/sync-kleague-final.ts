// sync-kleague-final.ts
// Pure TheSportsDB K League Final Sync
import 'dotenv/config';
import { supa } from './lib/supabase.js';

// Environment variables
const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TheSportsDB_KEY || '460915';
const SEASON_YEAR = process.env.SEASON_YEAR || '2025';

if (!THESPORTSDB_API_KEY) {
  throw new Error('Missing THESPORTSDB_API_KEY environment variable');
}

// TheSportsDB API Types (Pure Original JSON Structure)
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

// TheSportsDB API Client (Pure)
class PureTheSportsDBClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch(url: string) {
    console.log(`🔍 Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AllLeaguesFans/1.0 (TheSportsDB Pure Integration)',
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

// Pure Import Manager (No Mapping)
class PureKLeagueImporter {
  private client: PureTheSportsDBClient;
  
  constructor() {
    this.client = new PureTheSportsDBClient(THESPORTSDB_API_KEY);
  }
  
  async importPureStandings() {
    console.log('\\n📊 Starting Pure TheSportsDB Standings Import...');
    console.log('🎯 Direct JSON to database mapping - Zero transformation');
    
    // K League IDs mapping (TheSportsDB)
    const leagueMapping = [
      { idLeague: '4689', name: 'K League 1' },
      { idLeague: '4822', name: 'K League 2' }
    ];
    
    const allStandings: TheSportsDBStanding[] = [];
    
    for (const league of leagueMapping) {
      try {
        console.log(`\\n🏆 Processing pure standings for ${league.name}...`);
        
        // Clear existing standings for this league and season (Pure TheSportsDB schema)
        console.log(`🧹 Clearing existing standings for ${league.name} season ${SEASON_YEAR}...`);
        const { error: deleteError } = await supa
          .from('standings')
          .delete()
          .eq('idLeague', league.idLeague)
          .eq('strSeason', SEASON_YEAR);
        
        if (deleteError) {
          console.warn(`⚠️ Error clearing existing data: ${deleteError.message}`);
        }
        
        // Get standings data from TheSportsDB
        const standings = await this.client.getStandings(league.idLeague, SEASON_YEAR);
        console.log(`Found ${standings.length} teams in standings`);
        
        // Show raw TheSportsDB data for verification
        console.log(`\\n📋 Pure TheSportsDB Data Sample (${league.name}):`);
        if (standings.length > 0) {
          const sample = standings[0];
          console.log(`   🏆 #${sample.intRank}: ${sample.strTeam}`);
          console.log(`   📊 ${sample.intWin}W ${sample.intDraw}D ${sample.intLoss}L = ${sample.intPoints}pts`);
          console.log(`   ⚽ ${sample.intGoalsFor}-${sample.intGoalsAgainst} (${sample.intGoalDifference})`);
          console.log(`   📈 Form: ${sample.strForm || 'N/A'}`);
          console.log(`   🎯 League: ${sample.strLeague} (ID: ${sample.idLeague})`);
        }
        
        for (const standing of standings) {
          try {
            console.log(`🔍 Importing PURE: ${standing.strTeam} (Rank ${standing.intRank}, ${standing.intPoints} pts)`);
            
            // Direct insert - NO MAPPING - Pure TheSportsDB structure
            const pureStanding = {
              idStanding: standing.idStanding || `${standing.idLeague}_${standing.idTeam}_${SEASON_YEAR}`,
              intRank: standing.intRank,
              idTeam: standing.idTeam,
              strTeam: standing.strTeam,
              strBadge: standing.strBadge,
              idLeague: standing.idLeague,
              strLeague: standing.strLeague,
              strSeason: standing.strSeason || SEASON_YEAR,
              strForm: standing.strForm,
              strDescription: standing.strDescription,
              intPlayed: standing.intPlayed,
              intWin: standing.intWin,
              intLoss: standing.intLoss,
              intDraw: standing.intDraw,
              intGoalsFor: standing.intGoalsFor,
              intGoalsAgainst: standing.intGoalsAgainst,
              intGoalDifference: standing.intGoalDifference,
              intPoints: standing.intPoints
            };
            
            const { data, error } = await supa
              .from('standings')
              .insert(pureStanding)
              .select();
            
            if (error) {
              console.error(`❌ Pure import error for ${standing.strTeam}:`, error);
            } else {
              console.log(`✅ PURE IMPORTED: ${standing.strTeam} - ${standing.intPoints} pts (TheSportsDB ID: ${standing.idLeague})`);
              allStandings.push(standing);
            }
            
          } catch (error) {
            console.error(`❌ Error processing ${standing.strTeam}:`, error);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing league ${league.name}:`, error);
      }
    }
    
    console.log(`\\n📊 Pure Import Complete: ${allStandings.length} teams imported`);
    return allStandings;
  }
  
  async runFullSync() {
    try {
      console.log('🚀 Starting Pure TheSportsDB K League Final Sync...');
      console.log('🎯 ZERO transformation - Direct API to database');
      console.log('📋 Original TheSportsDB JSON structure preserved 100%');
      console.log('💾 Database schema: Pure TheSportsDB column names');
      
      const standings = await this.importPureStandings();
      
      console.log('\\n🎉 Pure TheSportsDB Sync Finished!');
      console.log('📊 Final Summary:');
      console.log(`   - Team Standings: ${standings.length}`);
      console.log(`   - Season: ${SEASON_YEAR}`);
      console.log(`   - Data Source: TheSportsDB v1 lookuptable API (100% PURE)`);
      console.log(`   - Schema: Pure TheSportsDB (zero mapping, zero transformation)`);
      console.log(`   - Column Names: Original JSON keys (idStanding, intRank, strTeam, etc.)`);
      
      // Generate league breakdown using pure TheSportsDB data
      const leagueSummary = standings.reduce((acc, standing) => {
        const idLeague = standing.idLeague;
        const leagueName = idLeague === '4689' ? 'K League 1' : idLeague === '4822' ? 'K League 2' : `League ${idLeague}`;
        if (!acc[leagueName]) {
          acc[leagueName] = {
            count: 0,
            totalPoints: 0,
            totalGoals: 0
          };
        }
        acc[leagueName].count++;
        acc[leagueName].totalPoints += parseInt(standing.intPoints) || 0;
        acc[leagueName].totalGoals += parseInt(standing.intGoalsFor) || 0;
        return acc;
      }, {} as Record<string, { count: number; totalPoints: number; totalGoals: number }>);
      
      console.log('\\n📋 League Summary (Pure TheSportsDB Data):');
      Object.entries(leagueSummary).forEach(([league, stats]) => {
        console.log(`   - ${league}: ${stats.count} teams, ${stats.totalPoints} total pts, ${stats.totalGoals} total goals`);
      });
      
      console.log('\\n🔧 Pure TheSportsDB Structure:');
      console.log(`   - Original League IDs: ${standings.map(s => s.idLeague).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
      console.log(`   - Column Names: All original TheSportsDB JSON keys preserved`);
      console.log(`   - Data Types: All TEXT (matches TheSportsDB API exactly)`);
      console.log(`   - Season: ${SEASON_YEAR} (strSeason column)`);
      
      return standings;
      
    } catch (error) {
      console.error('❌ Pure sync failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  console.log('🎯 Pure TheSportsDB K League Final Sync');
  console.log('====================================');
  console.log('📝 Requirements:');
  console.log('1. Database schema must use pure TheSportsDB structure');
  console.log('2. Apply pure-thesportsdb-standings-schema.sql first');
  console.log('3. Table columns: idStanding, intRank, strTeam, etc.');
  console.log('\\n🚀 Starting sync...');
  
  const importer = new PureKLeagueImporter();
  await importer.runFullSync();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PureKLeagueImporter };