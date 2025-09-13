// scripts/test-database.ts
import 'dotenv/config'
import { supa } from './lib/supabase'

async function checkTables() {
  console.log('🔍 Checking database connection and tables...')
  
  // Test connection
  try {
    const { data: test, error: testError } = await supa.from('leagues').select('*').limit(1)
    if (testError) {
      console.log('❌ Database connection error:', testError.message)
      return false
    }
    console.log('✅ Database connection successful')
  } catch (err) {
    console.log('❌ Database connection failed:', err)
    return false
  }

  // Check each table
  const tables = ['leagues', 'seasons', 'teams', 'team_seasons', 'players', 'squad_memberships', 'fixtures', 'standings', 'lineups', 'lineup_players', 'events']
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supa.from(table).select('*', { count: 'exact', head: true })
      if (error) {
        console.log(`❌ Table ${table}: Error - ${error.message}`)
      } else {
        console.log(`✅ Table ${table}: ${count ?? 0} records`)
      }
    } catch (err) {
      console.log(`❌ Table ${table}: Exception - ${err}`)
    }
  }
}

async function checkApiFootballConnection() {
  console.log('\n🔍 Checking API Football connection...')
  
  const API_KEY = process.env.API_FOOTBALL_KEY
  if (!API_KEY) {
    console.log('❌ API_FOOTBALL_KEY not found in environment')
    return false
  }

  try {
    const response = await fetch('https://v3.football.api-sports.io/status', {
      headers: { 'x-apisports-key': API_KEY }
    })
    
    if (!response.ok) {
      console.log(`❌ API Football connection failed: ${response.status} ${response.statusText}`)
      return false
    }
    
    const data = await response.json()
    console.log('✅ API Football connection successful')
    console.log(`   Account: ${data.account?.firstname} ${data.account?.lastname}`)
    console.log(`   Requests today: ${data.requests?.current}/${data.requests?.limit_day}`)
    
    return true
  } catch (err) {
    console.log('❌ API Football connection error:', err)
    return false
  }
}

async function main() {
  console.log('='.repeat(50))
  console.log('🚀 AllLeaguesFans Database Status Check')
  console.log('='.repeat(50))
  
  await checkTables()
  await checkApiFootballConnection()
  
  console.log('\n' + '='.repeat(50))
  console.log('✨ Status check complete')
  console.log('='.repeat(50))
}

main().catch(console.error)