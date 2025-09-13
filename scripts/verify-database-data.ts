// scripts/verify-database-data.ts
import 'dotenv/config'
import { supa } from './lib/supabase'

async function verifyDatabaseData() {
  console.log('🔍 Verifying Database Data')
  console.log('='.repeat(50))
  
  // Check each table with both count and select methods
  const tables = [
    'leagues', 'seasons', 'teams', 'team_seasons', 
    'players', 'squad_memberships', 'fixtures', 'standings', 
    'lineups', 'lineup_players', 'events'
  ]
  
  for (const tableName of tables) {
    console.log(`\n--- Table: ${tableName} ---`)
    
    try {
      // Method 1: Count query
      const { count: countResult, error: countError } = await supa
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.log(`❌ Count error: ${countError.message}`)
      } else {
        console.log(`📊 Count method: ${countResult} records`)
      }
      
      // Method 2: Select first few records
      const { data: selectResult, error: selectError } = await supa
        .from(tableName)
        .select('*')
        .limit(5)
      
      if (selectError) {
        console.log(`❌ Select error: ${selectError.message}`)
      } else {
        console.log(`📋 Select method: ${selectResult?.length || 0} records (first 5)`)
        if (selectResult && selectResult.length > 0) {
          console.log(`   First record keys: ${Object.keys(selectResult[0]).join(', ')}`)
          
          // Show some sample data for key tables
          if (tableName === 'players' && selectResult.length > 0) {
            console.log(`   Sample player: ${selectResult[0].name} (ID: ${selectResult[0].id})`)
          } else if (tableName === 'teams' && selectResult.length > 0) {
            console.log(`   Sample team: ${selectResult[0].name} (ID: ${selectResult[0].id})`)
          } else if (tableName === 'fixtures' && selectResult.length > 0) {
            console.log(`   Sample fixture: ID ${selectResult[0].id}, Date: ${selectResult[0].kickoff_utc}`)
          }
        }
      }
      
      // Method 3: Raw SQL count for verification
      try {
        const { data: sqlCount, error: sqlError } = await supa
          .rpc('count_table_rows', { table_name: tableName })
          .single()
        
        if (!sqlError && sqlCount !== null) {
          console.log(`🔢 SQL count: ${sqlCount}`)
        }
      } catch (err) {
        // RPC function might not exist, that's okay
      }
      
    } catch (err) {
      console.log(`❌ Exception: ${err}`)
    }
  }
  
  // Check if we can see players by season
  console.log('\n--- Players by Season ---')
  const { data: playersByYear, error: playersError } = await supa
    .from('squad_memberships')
    .select(`
      season_year,
      player:players(name),
      team:teams(name)
    `)
    .limit(10)
  
  if (playersError) {
    console.log(`❌ Players by season error: ${playersError.message}`)
  } else {
    console.log(`📊 Squad memberships with joins: ${playersByYear?.length || 0} records`)
    if (playersByYear && playersByYear.length > 0) {
      playersByYear.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.player?.name} (${entry.team?.name}) - Season ${entry.season_year}`)
      })
    }
  }
  
  // Check seasons and which ones have data
  console.log('\n--- Available Seasons ---')
  const { data: seasons, error: seasonsError } = await supa
    .from('seasons')
    .select('*')
    .order('year', { ascending: false })
  
  if (seasonsError) {
    console.log(`❌ Seasons error: ${seasonsError.message}`)
  } else {
    console.log(`📅 Available seasons:`)
    seasons?.forEach(season => {
      console.log(`   League ${season.league_id}: ${season.year} (Current: ${season.is_current})`)
    })
  }
}

async function main() {
  await verifyDatabaseData()
  console.log('\n' + '='.repeat(50))
  console.log('✨ Database verification complete')
  console.log('='.repeat(50))
}

main().catch(console.error)