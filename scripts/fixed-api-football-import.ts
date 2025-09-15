// fixed-api-football-import.ts
// 외래키 제약조건 문제를 해결한 수정된 임포트 스크립트

import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1_LEAGUE_ID = 292
const K2_LEAGUE_ID = 293
const CURRENT_SEASON = 2025
const PREVIOUS_SEASON = 2024

interface ImportStats {
  teams: number
  venues: number
  players: number
  playersSquads: number
  playersStatistics: number
  fixtures: number
  events: number
  lineups: number
  standings: number
  topScorers: number
}

const stats: ImportStats = {
  teams: 0,
  venues: 0,
  players: 0,
  playersSquads: 0,
  playersStatistics: 0,
  fixtures: 0,
  events: 0,
  lineups: 0,
  standings: 0,
  topScorers: 0
}

// 존재하는 venue_id들을 캐시
const existingVenues = new Set<number>()

console.log('🔧 수정된 API-Football 데이터 임포트 (외래키 문제 해결)')
console.log('='.repeat(70))

// ============================================
// 1. TEAMS 및 VENUES 임포트 (venues 먼저 생성)
// ============================================
async function importTeamsAndVenues(leagueId: number, season: number) {
  console.log(`🏟️ 팀 및 경기장 데이터 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('teams', { league: leagueId, season })
    const teams = response.response || []
    
    for (const teamData of teams) {
      const team = teamData.team
      const venue = teamData.venue
      
      // 1. VENUE 데이터 저장 (있는 경우)
      let venueId = null
      if (venue && venue.id) {
        const venueRecord = {
          id: Number(venue.id),
          name: venue.name || `Venue ${venue.id}`,
          address: venue.address,
          city: venue.city,
          country_name: 'South Korea',
          capacity: venue.capacity ? Number(venue.capacity) : null,
          surface: venue.surface,
          image_url: venue.image
        }
        
        const { error: venueError } = await supa.from('venues').upsert([venueRecord], { onConflict: 'id' })
        if (!venueError) {
          stats.venues++
          venueId = Number(venue.id)
          existingVenues.add(venueId) // 캐시에 추가
        }
      }
      
      // 2. TEAM 데이터 저장  
      const teamRecord = {
        id: Number(team.id),
        name: team.name,
        code: team.code,
        country_name: 'South Korea',
        founded: team.founded,
        is_national: team.national || false,
        logo_url: team.logo,
        venue_id: venueId,
        updated_at: new Date().toISOString()
      }
      
      const { error: teamError } = await supa.from('teams').upsert([teamRecord], { onConflict: 'id' })
      if (!teamError) stats.teams++
    }
    
    console.log(`  ✅ ${teams.length}개 팀 및 ${stats.venues}개 경기장 임포트 완료`)
  } catch (error) {
    console.error(`  ❌ 팀/경기장 임포트 실패:`, error)
  }
}

// ============================================
// 2. 추가 VENUES 생성 (경기에서 참조하는 경기장들)
// ============================================
async function createMissingVenues(leagueId: number, season: number) {
  console.log(`🏟️ 누락된 경기장 생성... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    // 몇 개 경기를 샘플로 가져와서 venue_id들 확인
    const fixturesResponse = await apiGet('fixtures', { league: leagueId, season, last: 50 })
    const fixtures = fixturesResponse.response || []
    
    const venueIds = new Set<number>()
    fixtures.forEach((fixture: any) => {
      if (fixture.fixture.venue?.id) {
        venueIds.add(Number(fixture.fixture.venue.id))
      }
    })
    
    // 누락된 venue들 생성
    for (const venueId of venueIds) {
      if (!existingVenues.has(venueId)) {
        const venueRecord = {
          id: venueId,
          name: `Stadium ${venueId}`, // 기본 이름
          country_name: 'South Korea'
        }
        
        const { error: venueError } = await supa.from('venues').upsert([venueRecord], { onConflict: 'id' })
        if (!venueError) {
          existingVenues.add(venueId)
          stats.venues++
        }
      }
    }
    
    console.log(`  ✅ 총 ${existingVenues.size}개 경기장 준비 완료`)
  } catch (error) {
    console.error(`  ❌ 경기장 생성 실패:`, error)
  }
}

// ============================================
// 3. PLAYERS 및 관련 데이터 임포트
// ============================================
async function importPlayersAndRelated(leagueId: number, season: number) {
  console.log(`⚽ 선수 관련 데이터 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const teamsResponse = await apiGet('teams', { league: leagueId, season })
    const teams = teamsResponse.response || []
    
    for (const teamData of teams) {
      const teamId = Number(teamData.team.id)
      console.log(`  팀 처리 중: ${teamData.team.name}`)
      
      try {
        const playersResponse = await apiPaged('players', { team: teamId, season })
        
        for (const playerData of playersResponse) {
          const player = playerData.player
          const statistics = playerData.statistics?.[0]
          
          // 1. PLAYERS 테이블
          const playerRecord = {
            id: Number(player.id),
            name: player.name,
            firstname: player.firstname,
            lastname: player.lastname,
            age: player.age,
            birth_date: player.birth?.date || null,
            birth_place: player.birth?.place || null,
            birth_country: player.birth?.country || null,
            nationality: player.nationality,
            height_cm: player.height ? Number(String(player.height).replace(/\\D/g, '')) : null,
            weight_kg: player.weight ? Number(String(player.weight).replace(/\\D/g, '')) : null,
            injured: player.injured || false,
            photo_url: player.photo,
            updated_at: new Date().toISOString()
          }
          
          const { error: playerError } = await supa.from('players').upsert([playerRecord], { onConflict: 'id' })
          if (!playerError) stats.players++
          
          // 2. PLAYERS_SQUADS 테이블
          const squadRecord = {
            player_id: Number(player.id),
            team_id: teamId,
            season_year: season,
            jersey_number: statistics?.games?.number || null,
            position: statistics?.games?.position || null,
            is_captain: statistics?.games?.captain || false
          }
          
          const { error: squadError } = await supa.from('players_squads').upsert([squadRecord], { 
            onConflict: 'player_id,team_id,season_year' 
          })
          if (!squadError) stats.playersSquads++
          
          // 3. PLAYERS_STATISTICS 테이블
          if (statistics) {
            const games = statistics.games || {}
            const goals = statistics.goals || {}
            const cards = statistics.cards || {}
            
            const statsRecord = {
              player_id: Number(player.id),
              team_id: teamId,
              league_id: leagueId,
              season_year: season,
              
              games_appearances: games.appearences || 0,
              games_lineups: games.lineups || 0,
              games_minutes: games.minutes || 0,
              games_position: games.position || null,
              games_rating: games.rating ? parseFloat(games.rating) : null,
              games_captain: games.captain || false,
              
              goals_total: goals.total || 0,
              goals_assists: goals.assists || 0,
              goals_saves: goals.saves || 0,
              
              cards_yellow: cards.yellow || 0,
              cards_red: cards.red || 0,
              
              updated_at: new Date().toISOString()
            }
            
            const { error: statsError } = await supa.from('players_statistics').upsert([statsRecord], {
              onConflict: 'player_id,team_id,league_id,season_year'
            })
            if (!statsError) stats.playersStatistics++
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.warn(`    팀 ${teamData.team.name} 처리 실패:`, error)
      }
    }
    
  } catch (error) {
    console.error(`  ❌ 선수 데이터 임포트 실패:`, error)
  }
}

// ============================================
// 4. FIXTURES 및 EVENTS 임포트 (수정됨)
// ============================================
async function importFixturesAndEvents(leagueId: number, season: number) {
  console.log(`🏟️ 경기 및 이벤트 데이터 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    // 완료된 경기만 가져오기
    const fixturesResponse = await apiGet('fixtures', { 
      league: leagueId, 
      season,
      status: 'FT' // 완료된 경기만
    })
    const fixtures = fixturesResponse.response || []
    
    console.log(`  📊 완료된 경기: ${fixtures.length}개`)
    
    for (const fixture of fixtures) {
      try {
        // venue_id 검증 (존재하지 않으면 null로 설정)
        let venueId = null
        if (fixture.fixture.venue?.id) {
          const checkVenueId = Number(fixture.fixture.venue.id)
          if (existingVenues.has(checkVenueId)) {
            venueId = checkVenueId
          }
        }
        
        // 1. FIXTURES 테이블
        const score = fixture.score || {}
        const halftime = score.halftime || {}
        const fulltime = score.fulltime || {}
        
        const fixtureRecord = {
          id: Number(fixture.fixture.id),
          referee: fixture.fixture.referee,
          timezone: fixture.fixture.timezone,
          date_utc: fixture.fixture.date,
          timestamp_unix: fixture.fixture.timestamp,
          
          league_id: leagueId,
          season_year: season,
          round: fixture.league?.round,
          
          home_team_id: Number(fixture.teams.home.id),
          away_team_id: Number(fixture.teams.away.id),
          
          venue_id: venueId, // 검증된 venue_id만 사용
          
          status_long: fixture.fixture.status?.long,
          status_short: fixture.fixture.status?.short,
          elapsed_minutes: fixture.fixture.status?.elapsed,
          
          home_goals: fixture.goals?.home,
          away_goals: fixture.goals?.away,
          
          ht_home: halftime.home,
          ht_away: halftime.away,
          ft_home: fulltime.home,
          ft_away: fulltime.away,
          
          updated_at: new Date().toISOString()
        }
        
        const { error: fixtureError } = await supa.from('fixtures').upsert([fixtureRecord], { onConflict: 'id' })
        if (fixtureError) {
          console.warn(`  ⚠️ 경기 ${fixture.fixture.id} 임포트 실패: ${fixtureError.message}`)
          continue
        }
        
        stats.fixtures++
        
        // 2. EVENTS 테이블 (완료된 경기만)
        try {
          const eventsResponse = await apiGet('fixtures/events', { fixture: fixture.fixture.id })
          const events = eventsResponse.response || []
          
          const eventRecords = []
          for (const event of events) {
            if (event.player?.id) {
              eventRecords.push({
                fixture_id: Number(fixture.fixture.id),
                team_id: Number(event.team.id),
                player_id: Number(event.player.id),
                assist_player_id: event.assist?.id ? Number(event.assist.id) : null,
                elapsed_minutes: event.time?.elapsed ?? 0,
                extra_minutes: event.time?.extra ?? null,
                event_type: event.type,
                event_detail: event.detail,
                comments: event.comments
              })
            }
          }
          
          if (eventRecords.length > 0) {
            const { error: eventsError } = await supa.from('events').insert(eventRecords)
            if (!eventsError) {
              stats.events += eventRecords.length
            }
          }
          
        } catch (eventsError) {
          // 이벤트 실패해도 경기는 임포트됨
          console.warn(`    경기 ${fixture.fixture.id} 이벤트 처리 실패`)
        }
        
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.warn(`  경기 ${fixture.fixture?.id} 처리 실패:`, error)
      }
    }
    
    console.log(`  ✅ ${stats.fixtures}개 경기, ${stats.events}개 이벤트 임포트 완료`)
    
  } catch (error) {
    console.error(`  ❌ 경기 데이터 임포트 실패:`, error)
  }
}

// ============================================
// 5. STANDINGS 임포트
// ============================================
async function importStandings(leagueId: number, season: number) {
  console.log(`📊 순위표 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('standings', { league: leagueId, season })
    const standings = response.response?.[0]?.league?.standings?.flat() || []
    
    await supa.from('standings').delete().eq('league_id', leagueId).eq('season_year', season)
    
    const standingRecords = standings.map((standing: any) => ({
      league_id: leagueId,
      season_year: season,
      team_id: Number(standing.team.id),
      rank: standing.rank,
      points: standing.points,
      goals_diff: standing.goalsDiff,
      form: standing.form,
      
      played: standing.all?.played || 0,
      win: standing.all?.win || 0,
      draw: standing.all?.draw || 0,
      lose: standing.all?.lose || 0,
      goals_for: standing.all?.goals?.for || 0,
      goals_against: standing.all?.goals?.against || 0,
      
      updated_at: new Date().toISOString()
    }))
    
    if (standingRecords.length > 0) {
      const { error } = await supa.from('standings').insert(standingRecords)
      if (!error) stats.standings += standingRecords.length
    }
    
    console.log(`  ✅ ${standingRecords.length}개 순위 임포트 완료`)
    
  } catch (error) {
    console.error(`  ❌ 순위표 임포트 실패:`, error)
  }
}

// ============================================
// 6. TOP_SCORERS 임포트
// ============================================
async function importTopScorers(leagueId: number, season: number) {
  console.log(`🏆 득점왕 순위 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('players/topscorers', { league: leagueId, season })
    const topScorers = response.response || []
    
    await supa.from('top_scorers').delete().eq('league_id', leagueId).eq('season_year', season)
    
    const topScorerRecords = topScorers.map((scorer: any, index: number) => ({
      league_id: leagueId,
      season_year: season,
      player_id: Number(scorer.player.id),
      team_id: Number(scorer.statistics[0]?.team?.id),
      goals: scorer.statistics[0]?.goals?.total || 0,
      assists: scorer.statistics[0]?.goals?.assists || 0,
      games_played: scorer.statistics[0]?.games?.appearences || 0,
      rank: index + 1,
      updated_at: new Date().toISOString()
    }))
    
    if (topScorerRecords.length > 0) {
      const { error } = await supa.from('top_scorers').insert(topScorerRecords)
      if (!error) stats.topScorers += topScorerRecords.length
    }
    
    console.log(`  ✅ ${topScorerRecords.length}명 득점왕 순위 임포트 완료`)
    
  } catch (error) {
    console.error(`  ❌ 득점왕 임포트 실패:`, error)
  }
}

// ============================================
// 메인 임포트 실행 (수정됨)
// ============================================
async function runFixedImport() {
  const startTime = Date.now()
  
  try {
    console.log('1️⃣ 팀 및 경기장 데이터 임포트...')
    await importTeamsAndVenues(K1_LEAGUE_ID, CURRENT_SEASON)
    await importTeamsAndVenues(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n2️⃣ 추가 경기장 생성...')
    await createMissingVenues(K1_LEAGUE_ID, CURRENT_SEASON)
    await createMissingVenues(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n3️⃣ 선수 관련 데이터 임포트...')
    await importPlayersAndRelated(K1_LEAGUE_ID, CURRENT_SEASON)
    await importPlayersAndRelated(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n4️⃣ 경기 및 이벤트 데이터 임포트...')
    await importFixturesAndEvents(K1_LEAGUE_ID, CURRENT_SEASON)
    await importFixturesAndEvents(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n5️⃣ 순위표 데이터 임포트...')
    await importStandings(K1_LEAGUE_ID, CURRENT_SEASON)
    await importStandings(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n6️⃣ 득점왕 순위 임포트...')
    await importTopScorers(K1_LEAGUE_ID, CURRENT_SEASON)
    await importTopScorers(K2_LEAGUE_ID, CURRENT_SEASON)
    
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    
    console.log('\\n' + '='.repeat(70))
    console.log('🎉 수정된 API-Football 임포트 완료!')
    console.log(`⏱️ 소요 시간: ${duration}초`)
    console.log('\\n📊 임포트 통계:')
    console.log(`   팀: ${stats.teams}개`)
    console.log(`   경기장: ${stats.venues}개`)
    console.log(`   선수: ${stats.players}명`)
    console.log(`   선수-팀 관계: ${stats.playersSquads}개`)
    console.log(`   선수 통계: ${stats.playersStatistics}개`)
    console.log(`   경기: ${stats.fixtures}경기`)
    console.log(`   이벤트: ${stats.events}개`)
    console.log(`   순위: ${stats.standings}개`)
    console.log(`   득점왕: ${stats.topScorers}명`)
    console.log('='.repeat(70))
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error)
    throw error
  }
}

async function main() {
  await runFixedImport()
}

main().catch(console.error)

export { runFixedImport }