// scripts/debug-import.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1 = 292
const SEASON = 2024 // Use 2024 season which should have complete data

async function debugTeamImport() {
  console.log('=== Debug Team Import ===')
  
  // Get teams from API
  const data = await apiGet('teams', { league: K1, season: SEASON })
  console.log(`Teams from API: ${data.response?.length || 0}`)
  
  if (data.response?.length > 0) {
    const firstTeam = data.response[0]
    console.log(`First team: ${firstTeam.team.name} (ID: ${firstTeam.team.id})`)
    
    // Try to get players for this team
    const playersData = await apiPaged('players', { team: firstTeam.team.id, season: SEASON })
    console.log(`Players from API for ${firstTeam.team.name}: ${playersData.length}`)
    
    if (playersData.length > 0) {
      console.log('\nTrying to import first player...')
      const firstPlayer = playersData[0]
      console.log(`Player: ${firstPlayer.player?.name} (ID: ${firstPlayer.player?.id})`)
      
      // Try to insert this player
      const height_cm = firstPlayer.player.height ? Number(String(firstPlayer.player.height).replace(/\\D/g,'')) : null
      const weight_kg = firstPlayer.player.weight ? Number(String(firstPlayer.player.weight).replace(/\\D/g,'')) : null
      
      const playerRow = {
        id: Number(firstPlayer.player.id),
        name: firstPlayer.player.name,
        firstname: firstPlayer.player.firstname,
        lastname: firstPlayer.player.lastname,
        nationality: firstPlayer.player.nationality,
        birth_date: firstPlayer.player.birth?.date || null,
        height_cm,
        weight_kg,
        foot: firstPlayer.player?.foot || null,
        photo_url: firstPlayer.player.photo || null,
        updated_at: new Date().toISOString()
      }
      
      console.log('Player row to insert:', JSON.stringify(playerRow, null, 2))
      
      const { data: insertedPlayer, error: playerError } = await supa
        .from('players')
        .upsert([playerRow], { onConflict: 'id' })
        .select()
      
      if (playerError) {
        console.error('Player insert error:', playerError)
      } else {
        console.log('Player inserted successfully:', insertedPlayer)
      }
      
      // Try to insert squad membership
      const stats = firstPlayer.statistics?.[0]?.games
      const position = stats?.position || firstPlayer.player?.position || null
      const number = firstPlayer.player?.number || null
      const isCaptain = !!stats?.captain
      
      const squadRow = {
        team_id: Number(firstTeam.team.id),
        season_year: SEASON,
        player_id: Number(firstPlayer.player.id),
        number,
        position,
        is_captain: isCaptain,
        on_loan: null,
        joined_at: null,
        left_at: null
      }
      
      console.log('Squad row to insert:', JSON.stringify(squadRow, null, 2))
      
      const { data: insertedSquad, error: squadError } = await supa
        .from('squad_memberships')
        .upsert([squadRow], { onConflict: 'team_id,season_year,player_id' })
        .select()
      
      if (squadError) {
        console.error('Squad insert error:', squadError)
      } else {
        console.log('Squad membership inserted successfully:', insertedSquad)
      }
    }
  }
}

async function debugFixtureImport() {
  console.log('\n=== Debug Fixture Import ===')
  
  // Get fixtures from API
  const fixtures = await apiPaged('fixtures', { league: K1, season: SEASON })
  console.log(`Fixtures from API: ${fixtures.length}`)
  
  if (fixtures.length > 0) {
    const firstFixture = fixtures[0]
    console.log(`First fixture: ${firstFixture.teams?.home?.name} vs ${firstFixture.teams?.away?.name}`)
    
    const s = firstFixture.score || {}
    const ht = s.halftime || {}, ft = s.fulltime || {}, et = s.extratime || {}, pen = s.penalty || {}
    
    const fixtureRow = {
      id: Number(firstFixture.fixture.id),
      league_id: K1,
      season_year: SEASON,
      round: firstFixture.league?.round || null,
      kickoff_utc: firstFixture.fixture?.date || null,
      status_short: firstFixture.fixture?.status?.short || null,
      status_long: firstFixture.fixture?.status?.long || null,
      elapsed: firstFixture.fixture?.status?.elapsed ?? null,
      venue: firstFixture.fixture?.venue?.name || null,
      referee: firstFixture.fixture?.referee || null,
      home_team_id: Number(firstFixture.teams?.home?.id),
      away_team_id: Number(firstFixture.teams?.away?.id),
      goals_home: firstFixture.goals?.home ?? null,
      goals_away: firstFixture.goals?.away ?? null,
      ht_home: ht.home ?? null, ht_away: ht.away ?? null,
      ft_home: ft.home ?? null, ft_away: ft.away ?? null,
      et_home: et.home ?? null, et_away: et.away ?? null,
      pk_home: pen.home ?? null, pk_away: pen.away ?? null,
      updated_at: new Date().toISOString()
    }
    
    console.log('Fixture row to insert:', JSON.stringify(fixtureRow, null, 2))
    
    const { data: insertedFixture, error: fixtureError } = await supa
      .from('fixtures')
      .upsert([fixtureRow], { onConflict: 'id' })
      .select()
    
    if (fixtureError) {
      console.error('Fixture insert error:', fixtureError)
    } else {
      console.log('Fixture inserted successfully:', insertedFixture)
    }
  }
}

async function main() {
  console.log('🔍 Debug Import Process')
  console.log(`Using K1=${K1}, Season=${SEASON}`)
  console.log('='.repeat(50))
  
  await debugTeamImport()
  await debugFixtureImport()
  
  console.log('\n=== Final Check ===')
  const { data: players, error: playersError } = await supa.from('players').select('*', { count: 'exact', head: true })
  const { data: fixtures, error: fixturesError } = await supa.from('fixtures').select('*', { count: 'exact', head: true })
  const { data: squads, error: squadsError } = await supa.from('squad_memberships').select('*', { count: 'exact', head: true })
  
  console.log(`Players in DB: ${players?.length || 0}`)
  console.log(`Fixtures in DB: ${fixtures?.length || 0}`)
  console.log(`Squad memberships in DB: ${squads?.length || 0}`)
  
  if (playersError) console.error('Players error:', playersError)
  if (fixturesError) console.error('Fixtures error:', fixturesError)
  if (squadsError) console.error('Squad error:', squadsError)
}

main().catch(console.error)