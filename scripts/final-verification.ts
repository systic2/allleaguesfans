// scripts/final-verification.ts
import 'dotenv/config'
import { supa } from './lib/supabase'

async function finalVerification() {
  console.log('🏁 Final Database Status Verification')
  console.log('='.repeat(50))
  
  const tables = [
    'leagues', 'seasons', 'teams', 'team_seasons', 
    'players', 'squad_memberships', 'fixtures', 'standings'
  ]
  
  const summary: Record<string, number> = {}
  
  for (const tableName of tables) {
    try {
      const { count, error } = await supa
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.log(`❌ ${tableName}: Error - ${error.message}`)
        summary[tableName] = 0
      } else {
        const recordCount = count || 0
        console.log(`✅ ${tableName}: ${recordCount} records`)
        summary[tableName] = recordCount
      }
    } catch (err) {
      console.log(`❌ ${tableName}: Exception - ${err}`)
      summary[tableName] = 0
    }
  }
  
  console.log('\n📊 Summary Report:')
  console.log('='.repeat(30))
  
  const isComplete = (
    summary.leagues >= 2 &&
    summary.seasons >= 2 &&
    summary.teams >= 20 &&
    summary.players >= 100 &&
    summary.squad_memberships >= 100
  )
  
  if (isComplete) {
    console.log('🎉 Database appears to be properly populated!')
    console.log('✅ All major tables have reasonable amounts of data')
  } else {
    console.log('⚠️  Database may be incomplete:')
    if (summary.players < 100) console.log('   - Low player count (expected 100+)')
    if (summary.squad_memberships < 100) console.log('   - Low squad membership count (expected 100+)')
    if (summary.fixtures === 0) console.log('   - No fixtures imported')
  }
  
  // Check data connectivity
  console.log('\n🔗 Data Connectivity Test:')
  try {
    const { data: sampleData, error } = await supa
      .from('squad_memberships')
      .select(`
        season_year,
        player:players(name, nationality),
        team:teams(name, league_id:team_seasons!inner(league_id))
      `)
      .limit(5)
    
    if (error) {
      console.log(`❌ Connectivity test failed: ${error.message}`)
    } else {
      console.log(`✅ Connectivity test passed: ${sampleData?.length || 0} joined records`)
      sampleData?.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.player?.name} (${record.player?.nationality}) - ${record.team?.name} - Season ${record.season_year}`)
      })
    }
  } catch (err) {
    console.log(`❌ Connectivity test error: ${err}`)
  }
  
  console.log('\n='.repeat(50))
  console.log('🏁 Verification complete')
  console.log('='.repeat(50))
  
  return summary
}

finalVerification().catch(console.error)