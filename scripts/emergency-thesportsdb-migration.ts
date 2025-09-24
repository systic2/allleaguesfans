/**
 * Emergency TheSportsDB Migration Script
 * Replaces API-Football before October 2nd deadline
 * Comprehensive K League data import using free TheSportsDB API
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createTheSportsDBAPI } from './lib/thesportsdb-api.js'
import TheSportsDBMapper from './lib/thesportsdb-mappers.js'

// Environment validation
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
}

console.log('🔍 Environment Check:')
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ ${key} is not set`)
    process.exit(1)
  }
  console.log(`✅ ${key}: ${value.substring(0, 20)}...`)
}

const supabase = createClient(
  requiredEnvVars.SUPABASE_URL!,
  requiredEnvVars.SUPABASE_SERVICE_ROLE!
)

const theSportsDB = createTheSportsDBAPI({
  rateLimit: { requests: 8, window: 60000 } // Conservative rate limiting
})

interface ImportStats {
  leagues: { imported: number, errors: number }
  teams: { imported: number, errors: number }
  fixtures: { imported: number, errors: number }
  standings: { imported: number, errors: number }
}

const stats: ImportStats = {
  leagues: { imported: 0, errors: 0 },
  teams: { imported: 0, errors: 0 },
  fixtures: { imported: 0, errors: 0 },
  standings: { imported: 0, errors: 0 }
}

/**
 * Import leagues to database
 */
async function importLeagues(leagues: any[]): Promise<void> {
  console.log(`🏟️ Importing ${leagues.length} leagues...`)
  
  for (const league of leagues) {
    try {
      const standardizedLeague = TheSportsDBMapper.mapLeague(league)
      
      // Use standardized K League IDs for compatibility
      const leagueId = TheSportsDBMapper.getKLeagueStandardIds(league)
      standardizedLeague.id = leagueId
      
      const { error } = await supabase
        .from('leagues')
        .upsert({
          id: standardizedLeague.id,
          name: standardizedLeague.name,
          country_name: standardizedLeague.country,
          logo_url: standardizedLeague.logo,
          season_year: standardizedLeague.season_year,
          created_at: standardizedLeague.created_at,
          updated_at: standardizedLeague.updated_at
        })

      if (error) {
        console.error(`❌ Error importing league ${standardizedLeague.name}:`, error.message)
        stats.leagues.errors++
      } else {
        console.log(`✅ Imported league: ${standardizedLeague.name} (ID: ${standardizedLeague.id})`)
        stats.leagues.imported++
      }
    } catch (error) {
      console.error(`❌ Error processing league:`, error)
      stats.leagues.errors++
    }
  }
}

/**
 * Import teams to database
 */
async function importTeams(teams: any[]): Promise<void> {
  console.log(`👥 Importing ${teams.length} teams...`)
  
  for (const team of teams) {
    try {
      const standardizedTeam = TheSportsDBMapper.mapTeam(team)
      
      // Map to K League standard IDs
      const leagueMapping: Record<string, number> = {
        // Will be populated based on actual TheSportsDB league IDs
      }
      
      // Try to get the league name to determine correct ID
      const originalLeagueId = parseInt(team.idLeague, 10)
      let mappedLeagueId = originalLeagueId
      
      // For Korean teams, try to map to standard K League IDs
      if (team.strCountry === 'South Korea' && team.strLeague) {
        if (team.strLeague.includes('K League 1') || team.strLeague.includes('K-League 1')) {
          mappedLeagueId = 292
        } else if (team.strLeague.includes('K League 2') || team.strLeague.includes('K-League 2')) {
          mappedLeagueId = 293
        }
      }
      
      standardizedTeam.league_id = mappedLeagueId
      
      // Generate team code if missing
      if (!standardizedTeam.code) {
        standardizedTeam.code = TheSportsDBMapper.generateTeamCode(standardizedTeam.name)
      }

      const { error } = await supabase
        .from('teams')
        .upsert({
          id: standardizedTeam.id,
          name: standardizedTeam.name,
          code: standardizedTeam.code,
          logo_url: standardizedTeam.logo_url,
          league_id: standardizedTeam.league_id,
          season_year: standardizedTeam.season_year,
          country_name: standardizedTeam.country_name,
          data_source: standardizedTeam.data_source,
          created_at: standardizedTeam.created_at,
          updated_at: standardizedTeam.updated_at
        })

      if (error) {
        console.error(`❌ Error importing team ${standardizedTeam.name}:`, error.message)
        stats.teams.errors++
      } else {
        console.log(`✅ Imported team: ${standardizedTeam.name} (League: ${mappedLeagueId})`)
        stats.teams.imported++
      }
    } catch (error) {
      console.error(`❌ Error processing team:`, error)
      stats.teams.errors++
    }
  }
}

/**
 * Import fixtures to database
 */
async function importFixtures(fixtures: any[]): Promise<void> {
  console.log(`⚽ Importing ${fixtures.length} fixtures...`)
  
  for (const fixture of fixtures) {
    try {
      const standardizedFixture = TheSportsDBMapper.mapFixture(fixture)
      
      // Map league ID to standard K League IDs
      let mappedLeagueId = standardizedFixture.league_id
      if (fixture.strLeague) {
        if (fixture.strLeague.includes('K League 1') || fixture.strLeague.includes('K-League 1')) {
          mappedLeagueId = 292
        } else if (fixture.strLeague.includes('K League 2') || fixture.strLeague.includes('K-League 2')) {
          mappedLeagueId = 293
        }
      }
      
      standardizedFixture.league_id = mappedLeagueId

      const { error } = await supabase
        .from('fixtures')
        .upsert({
          id: standardizedFixture.id,
          home_team_id: standardizedFixture.home_team_id,
          away_team_id: standardizedFixture.away_team_id,
          league_id: standardizedFixture.league_id,
          season_year: standardizedFixture.season_year,
          match_date: standardizedFixture.match_date,
          status: standardizedFixture.status,
          home_score: standardizedFixture.home_score,
          away_score: standardizedFixture.away_score,
          venue: standardizedFixture.venue,
          round: standardizedFixture.round,
          created_at: standardizedFixture.created_at,
          updated_at: standardizedFixture.updated_at
        })

      if (error) {
        console.error(`❌ Error importing fixture ${standardizedFixture.id}:`, error.message)
        stats.fixtures.errors++
      } else {
        console.log(`✅ Imported fixture: ${fixture.strHomeTeam} vs ${fixture.strAwayTeam}`)
        stats.fixtures.imported++
      }
    } catch (error) {
      console.error(`❌ Error processing fixture:`, error)
      stats.fixtures.errors++
    }
  }
}

/**
 * Import standings to database
 */
async function importStandings(standings: any[]): Promise<void> {
  console.log(`📊 Importing ${standings.length} standings...`)
  
  for (const standing of standings) {
    try {
      const standardizedStanding = TheSportsDBMapper.mapStanding(standing)
      
      // Map league ID to standard K League IDs
      let mappedLeagueId = standardizedStanding.league_id
      if (standing.strLeague) {
        if (standing.strLeague.includes('K League 1') || standing.strLeague.includes('K-League 1')) {
          mappedLeagueId = 292
        } else if (standing.strLeague.includes('K League 2') || standing.strLeague.includes('K-League 2')) {
          mappedLeagueId = 293
        }
      }
      
      standardizedStanding.league_id = mappedLeagueId

      const { error } = await supabase
        .from('standings')
        .upsert({
          team_id: standardizedStanding.team_id,
          league_id: standardizedStanding.league_id,
          season_year: standardizedStanding.season_year,
          position: standardizedStanding.position,
          played: standardizedStanding.played,
          wins: standardizedStanding.wins,
          draws: standardizedStanding.draws,
          losses: standardizedStanding.losses,
          goals_for: standardizedStanding.goals_for,
          goals_against: standardizedStanding.goals_against,
          goal_difference: standardizedStanding.goal_difference,
          points: standardizedStanding.points,
          form: standardizedStanding.form,
          created_at: standardizedStanding.created_at,
          updated_at: standardizedStanding.updated_at
        })

      if (error) {
        console.error(`❌ Error importing standing for team ${standardizedStanding.team_id}:`, error.message)
        stats.standings.errors++
      } else {
        console.log(`✅ Imported standing: Team ${standardizedStanding.team_id} - Position ${standardizedStanding.position}`)
        stats.standings.imported++
      }
    } catch (error) {
      console.error(`❌ Error processing standing:`, error)
      stats.standings.errors++
    }
  }
}

/**
 * Test TheSportsDB API connectivity
 */
async function testAPIConnectivity(): Promise<boolean> {
  console.log('🧪 Testing TheSportsDB API connectivity...')
  
  try {
    const countries = await theSportsDB.getAllCountries()
    console.log(`✅ TheSportsDB API connected successfully - ${countries.length} countries available`)
    
    // Test Korean leagues specifically
    const koreanLeagues = await theSportsDB.getKoreanLeagues()
    console.log(`✅ Found ${koreanLeagues.length} Korean leagues`)
    koreanLeagues.forEach(league => {
      console.log(`  - ${league.strLeague} (ID: ${league.idLeague})`)
    })
    
    return true
  } catch (error) {
    console.error('❌ TheSportsDB API connectivity test failed:', error)
    return false
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚨 EMERGENCY MIGRATION: API-Football → TheSportsDB')
  console.log('⏰ Deadline: October 2nd, 2024')
  console.log('🎯 Target: Complete K League data migration\n')

  const startTime = Date.now()

  try {
    // 1. Test API connectivity
    const apiConnected = await testAPIConnectivity()
    if (!apiConnected) {
      throw new Error('TheSportsDB API connectivity test failed')
    }

    // 2. Fetch comprehensive K League data
    console.log('\n🚀 Starting comprehensive K League data fetch...')
    const data = await theSportsDB.getComprehensiveKLeagueData()
    
    // 3. Validate and clean data
    const cleanData = TheSportsDBMapper.validateAndCleanData(data)
    
    console.log('\n📥 Starting database import process...')
    
    // 4. Import data in order (maintain referential integrity)
    await importLeagues(cleanData.leagues)
    await importTeams(cleanData.teams)
    await importFixtures(cleanData.fixtures)
    await importStandings(cleanData.standings)

    // 5. Final validation
    console.log('\n🔍 Performing final validation...')
    const { data: leagueCount } = await supabase
      .from('leagues')
      .select('id', { count: 'exact' })
      .eq('season_year', 2024)
    
    const { data: teamCount } = await supabase
      .from('teams')
      .select('id', { count: 'exact' })
      .eq('season_year', 2024)
      .eq('data_source', 'thesportsdb')

    console.log(`\n📊 Migration Summary:`)
    console.log(`🏟️  Leagues: ${stats.leagues.imported} imported, ${stats.leagues.errors} errors`)
    console.log(`👥 Teams: ${stats.teams.imported} imported, ${stats.teams.errors} errors`)
    console.log(`⚽ Fixtures: ${stats.fixtures.imported} imported, ${stats.fixtures.errors} errors`)
    console.log(`📊 Standings: ${stats.standings.imported} imported, ${stats.standings.errors} errors`)
    console.log(`\n🔍 Database Validation:`)
    console.log(`   Leagues in DB: ${leagueCount?.length || 0}`)
    console.log(`   TheSportsDB Teams in DB: ${teamCount?.length || 0}`)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n⏱️  Migration completed in ${duration} seconds`)
    
    if (stats.leagues.errors + stats.teams.errors + stats.fixtures.errors + stats.standings.errors === 0) {
      console.log('🎉 EMERGENCY MIGRATION SUCCESSFUL!')
      console.log('✅ API-Football replacement complete - ready for October 2nd deadline')
    } else {
      console.log('⚠️  Migration completed with some errors - manual review recommended')
    }

  } catch (error) {
    console.error('💥 Emergency migration failed:', error)
    process.exit(1)
  }
}

// Execute migration
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}