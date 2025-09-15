// scripts/master-import.ts
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1 = Number(process.env.API_FOOTBALL_K1_ID) || 292
const K2 = Number(process.env.API_FOOTBALL_K2_ID) || 293
const CURRENT_SEASON = 2025
const PREVIOUS_SEASON = 2024

interface ImportStats {
  leagues: number
  seasons: number
  teams: number
  players: number
  squads: number
  fixtures: number
  standings: number
  lineups: number
  events: number
}

const stats: ImportStats = {
  leagues: 0,
  seasons: 0,
  teams: 0,
  players: 0,
  squads: 0,
  fixtures: 0,
  standings: 0,
  lineups: 0,
  events: 0
}

async function ensureSeasons() {
  console.log('📅 Ensuring seasons exist...')
  
  const seasons = [
    { league_id: K1, year: PREVIOUS_SEASON, is_current: false },
    { league_id: K1, year: CURRENT_SEASON, is_current: true },
    { league_id: K2, year: PREVIOUS_SEASON, is_current: false },
    { league_id: K2, year: CURRENT_SEASON, is_current: true }
  ]
  
  for (const season of seasons) {
    const { error } = await supa.from('seasons').upsert([season], { onConflict: 'league_id,year' })
    if (!error) stats.seasons++
  }
  
  console.log(`✅ Seasons ensured: ${stats.seasons}`)
}

async function importPlayersAndSquads(leagueId: number, season: number) {
  console.log(`👥 Importing players and squads for league ${leagueId}, season ${season}...`)
  
  // Get teams for this league and season
  const teamsData = await apiGet('teams', { league: leagueId, season })
  const teams = teamsData.response || []
  
  let playerCount = 0
  let squadCount = 0
  
  for (const teamData of teams) {
    const teamId = Number(teamData.team.id)
    console.log(`  Processing team: ${teamData.team.name} (${teamId})`)
    
    try {
      // Get all players for this team and season (with pagination)
      const playersData = await apiPaged('players', { team: teamId, season })
      
      for (const playerData of playersData) {
        try {
          // Import player
          const height_cm = playerData.player.height ? Number(String(playerData.player.height).replace(/\\D/g,'')) : null
          const weight_kg = playerData.player.weight ? Number(String(playerData.player.weight).replace(/\\D/g,'')) : null
          
          const playerRow = {
            id: Number(playerData.player.id),
            name: playerData.player.name,
            firstname: playerData.player.firstname,
            lastname: playerData.player.lastname,
            nationality: playerData.player.nationality,
            birth_date: playerData.player.birth?.date || null,
            height_cm,
            weight_kg,
            foot: playerData.player?.foot || null,
            photo_url: playerData.player.photo || null,
            updated_at: new Date().toISOString()
          }
          
          const { error: playerError } = await supa.from('players').upsert([playerRow], { onConflict: 'id' })
          if (!playerError) playerCount++
          
          // Import squad membership
          const stats = playerData.statistics?.[0]?.games
          const position = stats?.position || playerData.player?.position || null
          const number = playerData.player?.number || null
          const isCaptain = !!stats?.captain
          
          const squadRow = {
            team_id: teamId,
            season_year: season,
            player_id: Number(playerData.player.id),
            number,
            position,
            is_captain: isCaptain,
            on_loan: null,
            joined_at: null,
            left_at: null
          }
          
          const { error: squadError } = await supa.from('squad_memberships').upsert([squadRow], { onConflict: 'team_id,season_year,player_id' })
          if (!squadError) squadCount++
          
        } catch (err) {
          console.warn(`    Failed to import player ${playerData.player?.name}: ${err}`)
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (err) {
      console.warn(`  Failed to import team ${teamData.team.name}: ${err}`)
    }
  }
  
  stats.players += playerCount
  stats.squads += squadCount
  console.log(`✅ Imported ${playerCount} players and ${squadCount} squad memberships`)
}

async function importFixtures(leagueId: number, season: number) {
  console.log(`⚽ Importing fixtures for league ${leagueId}, season ${season}...`)
  
  try {
    const fixtures = await apiPaged('fixtures', { league: leagueId, season })
    let fixtureCount = 0
    let eventCount = 0
    
    for (const fixture of fixtures) {
      try {
        // Import fixture
        const s = fixture.score || {}
        const ht = s.halftime || {}, ft = s.fulltime || {}, et = s.extratime || {}, pen = s.penalty || {}
        
        const fixtureRow = {
          id: Number(fixture.fixture.id),
          league_id: leagueId,
          season_year: season,
          round: fixture.league?.round || null,
          kickoff_utc: fixture.fixture?.date || null,
          status_short: fixture.fixture?.status?.short || null,
          status_long: fixture.fixture?.status?.long || null,
          elapsed: fixture.fixture?.status?.elapsed ?? null,
          venue: fixture.fixture?.venue?.name || null,
          referee: fixture.fixture?.referee || null,
          home_team_id: Number(fixture.teams?.home?.id),
          away_team_id: Number(fixture.teams?.away?.id),
          goals_home: fixture.goals?.home ?? null,
          goals_away: fixture.goals?.away ?? null,
          ht_home: ht.home ?? null, ht_away: ht.away ?? null,
          ft_home: ft.home ?? null, ft_away: ft.away ?? null,
          et_home: et.home ?? null, et_away: et.away ?? null,
          pk_home: pen.home ?? null, pk_away: pen.away ?? null,
          updated_at: new Date().toISOString()
        }
        
        const { error: fixtureError } = await supa.from('fixtures').upsert([fixtureRow], { onConflict: 'id' })
        if (!fixtureError) fixtureCount++
        
        // Import events for completed matches
        if (fixture.fixture?.status?.short === 'FT') {
          try {
            const eventsData = await apiGet('fixtures/events', { fixture: fixture.fixture.id })
            const events = (eventsData.response || [])
              .filter((event: any) => event.player?.id) // player_id가 있는 것만
              .map((event: any) => ({
                fixture_id: Number(fixture.fixture.id),
                team_id: Number(event.team?.id),
                player_id: Number(event.player.id),
                assist_id: event.assist?.id ? Number(event.assist.id) : null,
                type: event.type || null,
                detail: event.detail || null,
                comments: event.comments || null,
                minute: event.time?.elapsed ?? null,
                extra_minute: event.time?.extra ?? null
              }))
            
            if (events.length > 0) {
              // 🔒 중복 방지: 기존 이벤트 확인
              const existingEvents = await supa.from('events')
                .select('id, fixture_id, team_id, player_id, elapsed_minutes, extra_minutes, event_type, event_detail')
                .eq('fixture_id', fixture.fixture.id)

              const existingEventKeys = new Set()
              if (existingEvents.data) {
                existingEvents.data.forEach(event => {
                  const key = `${event.fixture_id}-${event.team_id}-${event.player_id}-${event.elapsed_minutes || 0}-${event.extra_minutes || 0}-${event.event_type}-${event.event_detail || ''}`
                  existingEventKeys.add(key)
                })
              }

              // 새로운 이벤트만 필터링
              const newEvents = events.filter((event: any) => {
                const key = `${event.fixture_id}-${event.team_id}-${event.player_id}-${event.minute || 0}-${event.extra_minute || 0}-${event.type}-${event.detail || ''}`
                return !existingEventKeys.has(key)
              })

              if (newEvents.length > 0) {
                // events 테이블에 올바른 컬럼명으로 매핑
                const mappedEvents = newEvents.map((event: any) => ({
                  fixture_id: event.fixture_id,
                  team_id: event.team_id,
                  player_id: event.player_id,
                  assist_player_id: event.assist_id,
                  elapsed_minutes: event.minute,
                  extra_minutes: event.extra_minute,
                  event_type: event.type,
                  event_detail: event.detail,
                  comments: event.comments
                }))

                const { error: eventsError } = await supa.from('events').insert(mappedEvents)
                if (!eventsError) {
                  eventCount += mappedEvents.length
                  console.log(`    ✅ Added ${mappedEvents.length} new events (${events.length - newEvents.length} duplicates skipped)`)
                } else {
                  console.warn(`    ❌ Events insert error:`, eventsError)
                }
              } else {
                console.log(`    ℹ️ All ${events.length} events already exist, skipping`)
              }
            }
          } catch (err) {
            // Events might not be available for all fixtures - try with events table as fallback
            console.warn(`    Events import failed for fixture ${fixture.fixture.id}: ${err}`)
          }
        }
        
      } catch (err) {
        console.warn(`  Failed to import fixture ${fixture.fixture?.id}: ${err}`)
      }
    }
    
    stats.fixtures += fixtureCount
    stats.events += eventCount
    console.log(`✅ Imported ${fixtureCount} fixtures and ${eventCount} events`)
    
  } catch (err) {
    console.warn(`Failed to import fixtures for league ${leagueId}: ${err}`)
  }
}

async function importStandings(leagueId: number, season: number) {
  console.log(`📊 Importing standings for league ${leagueId}, season ${season}...`)
  
  try {
    const data = await apiGet('standings', { league: leagueId, season })
    const tables: any[] = data.response?.[0]?.league?.standings?.flat() ?? []
    
    // Clear existing standings for this league/season to avoid conflicts
    await supa.from('standings').delete().eq('league_id', leagueId).eq('season_year', season)
    
    const rows = tables.map((row: any) => ({
      league_id: leagueId,
      season_year: season,
      team_id: Number(row.team?.id),
      rank: row.rank,
      points: row.points,
      goals_diff: row.goalsDiff,
      played: row.all?.played,
      win: row.all?.win,
      draw: row.all?.draw,
      lose: row.all?.lose,
      form: row.form,
      group_name: row.group || null,
      updated_at: new Date().toISOString()
    }))
    
    if (rows.length > 0) {
      const { error } = await supa.from('standings').insert(rows)
      if (!error) stats.standings += rows.length
    }
    
    console.log(`✅ Imported ${rows.length} standings`)
    
  } catch (err) {
    console.warn(`Failed to import standings for league ${leagueId}: ${err}`)
  }
}

async function runFullImport() {
  console.log('🚀 Starting comprehensive API Football data import')
  console.log('='.repeat(60))
  
  const startTime = Date.now()
  
  try {
    // 1. Ensure seasons exist
    await ensureSeasons()
    
    // 2. Import players and squads for both leagues and seasons
    await importPlayersAndSquads(K1, PREVIOUS_SEASON)
    await importPlayersAndSquads(K2, PREVIOUS_SEASON)
    await importPlayersAndSquads(K1, CURRENT_SEASON)
    await importPlayersAndSquads(K2, CURRENT_SEASON)
    
    // 3. Import fixtures and events
    await importFixtures(K1, PREVIOUS_SEASON)
    await importFixtures(K2, PREVIOUS_SEASON)
    await importFixtures(K1, CURRENT_SEASON)
    await importFixtures(K2, CURRENT_SEASON)
    
    // 4. Import standings
    await importStandings(K1, PREVIOUS_SEASON)
    await importStandings(K2, PREVIOUS_SEASON)
    await importStandings(K1, CURRENT_SEASON)
    await importStandings(K2, CURRENT_SEASON)
    
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Import completed successfully!')
    console.log(`⏱️  Duration: ${duration} seconds`)
    console.log('\n📊 Import Statistics:')
    console.log(`   Seasons: ${stats.seasons}`)
    console.log(`   Players: ${stats.players}`)
    console.log(`   Squad memberships: ${stats.squads}`)
    console.log(`   Fixtures: ${stats.fixtures}`)
    console.log(`   Standings: ${stats.standings}`)
    console.log(`   Events: ${stats.events}`)
    console.log('='.repeat(60))
    
  } catch (err) {
    console.error('❌ Import failed:', err)
    throw err
  }
}

async function main() {
  await runFullImport()
}

// Run if this is the main module
main().catch(console.error)

export { runFullImport }