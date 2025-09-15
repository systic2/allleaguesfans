// new-api-football-import.ts
// 완전히 새로운 API-Football 기반 데이터 임포트 시스템
import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet, apiPaged } from './lib/api-football'

const K1_LEAGUE_ID = 292
const K2_LEAGUE_ID = 293
const CURRENT_SEASON = 2025
const PREVIOUS_SEASON = 2024

interface ImportStats {
  teams: number
  players: number
  teamPlayers: number
  fixtures: number
  events: number
  standings: number
  playerStats: number
}

const stats: ImportStats = {
  teams: 0,
  players: 0,
  teamPlayers: 0,
  fixtures: 0,
  events: 0,
  standings: 0,
  playerStats: 0
}

console.log('🚀 API-Football 기반 완전 새로운 데이터 임포트')
console.log('='.repeat(60))

// ============================================
// 1. 팀 데이터 임포트
// ============================================
async function importTeams(leagueId: number, season: number) {
  console.log(`👥 팀 데이터 임포트 중... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('teams', { league: leagueId, season })
    const teams = response.response || []
    
    for (const teamData of teams) {
      const team = teamData.team
      const venue = teamData.venue
      
      const teamRecord = {
        id: Number(team.id),
        name: team.name,
        code: team.code,
        country: team.country,
        founded: team.founded,
        is_national: team.national || false,
        logo_url: team.logo,
        venue_id: venue?.id ? Number(venue.id) : null,
        venue_name: venue?.name || null,
        venue_address: venue?.address || null,
        venue_city: venue?.city || null,
        venue_capacity: venue?.capacity ? Number(venue.capacity) : null,
        venue_surface: venue?.surface || null,
        venue_image_url: venue?.image || null,
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supa.from('teams').upsert([teamRecord], { onConflict: 'id' })
      if (!error) stats.teams++
    }
    
    console.log(`  ✅ ${teams.length}개 팀 임포트 완료`)
  } catch (error) {
    console.error(`  ❌ 팀 임포트 실패:`, error)
  }
}

// ============================================
// 2. 선수 및 팀 구성 데이터 임포트  
// ============================================
async function importPlayersAndTeamPlayers(leagueId: number, season: number) {
  console.log(`⚽ 선수 데이터 임포트 중... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    // 리그의 모든 팀 가져오기
    const teamsResponse = await apiGet('teams', { league: leagueId, season })
    const teams = teamsResponse.response || []
    
    for (const teamData of teams) {
      const teamId = Number(teamData.team.id)
      console.log(`  팀 처리 중: ${teamData.team.name}`)
      
      try {
        // 팀의 모든 선수 가져오기
        const playersResponse = await apiPaged('players', { team: teamId, season })
        
        for (const playerData of playersResponse) {
          const player = playerData.player
          const statistics = playerData.statistics?.[0]
          
          // 1. 선수 정보 저장
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
          
          // 2. 팀-선수 관계 저장
          const teamPlayerRecord = {
            team_id: teamId,
            player_id: Number(player.id),
            season_year: season,
            jersey_number: statistics?.games?.number || null,
            position: statistics?.games?.position || null,
            is_captain: statistics?.games?.captain || false,
            joined_date: null, // API에서 제공하지 않음
            contract_until: null // API에서 제공하지 않음
          }
          
          const { error: teamPlayerError } = await supa.from('team_players').upsert([teamPlayerRecord], { 
            onConflict: 'team_id,player_id,season_year' 
          })
          if (!teamPlayerError) stats.teamPlayers++
          
          // 3. 선수 통계 저장 (있는 경우)
          if (statistics) {
            const games = statistics.games || {}
            const substitutes = statistics.substitutes || {}
            const shots = statistics.shots || {}
            const goals = statistics.goals || {}
            const passes = statistics.passes || {}
            const tackles = statistics.tackles || {}
            const duels = statistics.duels || {}
            const dribbles = statistics.dribbles || {}
            const fouls = statistics.fouls || {}
            const cards = statistics.cards || {}
            const penalty = statistics.penalty || {}
            
            const playerStatsRecord = {
              player_id: Number(player.id),
              team_id: teamId,
              league_id: leagueId,
              season_year: season,
              
              games_appearences: games.appearences || 0,
              games_lineups: games.lineups || 0,
              games_minutes: games.minutes || 0,
              games_number: games.number || null,
              games_position: games.position || null,
              games_rating: games.rating ? parseFloat(games.rating) : null,
              games_captain: games.captain || false,
              
              substitutes_in: substitutes.in || 0,
              substitutes_out: substitutes.out || 0,
              substitutes_bench: substitutes.bench || 0,
              
              shots_total: shots.total || 0,
              shots_on: shots.on || 0,
              
              goals_total: goals.total || 0,
              goals_conceded: goals.conceded || 0,
              goals_assists: goals.assists || 0,
              goals_saves: goals.saves || 0,
              
              passes_total: passes.total || 0,
              passes_key: passes.key || 0,
              passes_accuracy: passes.accuracy || 0,
              
              tackles_total: tackles.total || 0,
              tackles_blocks: tackles.blocks || 0,
              tackles_interceptions: tackles.interceptions || 0,
              
              duels_total: duels.total || 0,
              duels_won: duels.won || 0,
              
              dribbles_attempts: dribbles.attempts || 0,
              dribbles_success: dribbles.success || 0,
              dribbles_past: dribbles.past || 0,
              
              fouls_drawn: fouls.drawn || 0,
              fouls_committed: fouls.committed || 0,
              
              cards_yellow: cards.yellow || 0,
              cards_yellowred: cards.yellowred || 0,
              cards_red: cards.red || 0,
              
              penalty_won: penalty.won || 0,
              penalty_commited: penalty.commited || 0,
              penalty_scored: penalty.scored || 0,
              penalty_missed: penalty.missed || 0,
              penalty_saved: penalty.saved || 0,
              
              updated_at: new Date().toISOString()
            }
            
            const { error: statsError } = await supa.from('player_statistics').upsert([playerStatsRecord], {
              onConflict: 'player_id,team_id,league_id,season_year'
            })
            if (!statsError) stats.playerStats++
          }
        }
        
        // API 제한 방지
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.warn(`    팀 ${teamData.team.name} 처리 실패:`, error)
      }
    }
    
  } catch (error) {
    console.error(`  ❌ 선수 임포트 실패:`, error)
  }
}

// ============================================
// 3. 경기 및 이벤트 데이터 임포트
// ============================================
async function importFixturesAndEvents(leagueId: number, season: number) {
  console.log(`🏟️ 경기 데이터 임포트 중... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const fixtures = await apiPaged('fixtures', { league: leagueId, season })
    
    for (const fixture of fixtures) {
      try {
        // 1. 경기 정보 저장
        const score = fixture.score || {}
        const halftime = score.halftime || {}
        const fulltime = score.fulltime || {}
        const extratime = score.extratime || {}
        const penalty = score.penalty || {}
        
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
          
          venue_id: fixture.fixture.venue?.id ? Number(fixture.fixture.venue.id) : null,
          venue_name: fixture.fixture.venue?.name,
          venue_city: fixture.fixture.venue?.city,
          
          status_long: fixture.fixture.status?.long,
          status_short: fixture.fixture.status?.short,
          elapsed_minutes: fixture.fixture.status?.elapsed,
          
          home_goals: fixture.goals?.home,
          away_goals: fixture.goals?.away,
          
          ht_home: halftime.home,
          ht_away: halftime.away,
          ft_home: fulltime.home,
          ft_away: fulltime.away,
          et_home: extratime.home,
          et_away: extratime.away,
          pk_home: penalty.home,
          pk_away: penalty.away,
          
          updated_at: new Date().toISOString()
        }
        
        const { error: fixtureError } = await supa.from('fixtures').upsert([fixtureRecord], { onConflict: 'id' })
        if (!fixtureError) stats.fixtures++
        
        // 2. 완료된 경기의 이벤트 저장
        if (fixture.fixture.status?.short === 'FT') {
          try {
            const eventsResponse = await apiGet('fixtures/events', { fixture: fixture.fixture.id })
            const events = eventsResponse.response || []
            
            const eventRecords = []
            for (const event of events) {
              if (event.player?.id) { // 선수가 있는 이벤트만
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
              const { error: eventsError } = await supa.from('fixture_events').insert(eventRecords)
              if (!eventsError) stats.events += eventRecords.length
            }
            
          } catch (eventsError) {
            console.warn(`    경기 ${fixture.fixture.id} 이벤트 처리 실패:`, eventsError)
          }
        }
        
        // API 제한 방지  
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.warn(`  경기 ${fixture.fixture?.id} 처리 실패:`, error)
      }
    }
    
  } catch (error) {
    console.error(`  ❌ 경기 임포트 실패:`, error)
  }
}

// ============================================
// 4. 순위표 데이터 임포트
// ============================================
async function importStandings(leagueId: number, season: number) {
  console.log(`📊 순위표 임포트 중... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('standings', { league: leagueId, season })
    const standings = response.response?.[0]?.league?.standings?.flat() || []
    
    // 기존 순위표 삭제
    await supa.from('standings').delete().eq('league_id', leagueId).eq('season_year', season)
    
    const standingRecords = standings.map((standing: any) => ({
      league_id: leagueId,
      season_year: season,
      team_id: Number(standing.team.id),
      rank: standing.rank,
      points: standing.points,
      goals_diff: standing.goalsDiff,
      group_name: standing.group,
      form: standing.form,
      status: standing.status,
      description: standing.description,
      
      played: standing.all?.played || 0,
      win: standing.all?.win || 0,
      draw: standing.all?.draw || 0,
      lose: standing.all?.lose || 0,
      goals_for: standing.all?.goals?.for || 0,
      goals_against: standing.all?.goals?.against || 0,
      
      home_played: standing.home?.played || 0,
      home_win: standing.home?.win || 0,
      home_draw: standing.home?.draw || 0,
      home_lose: standing.home?.lose || 0,
      home_goals_for: standing.home?.goals?.for || 0,
      home_goals_against: standing.home?.goals?.against || 0,
      
      away_played: standing.away?.played || 0,
      away_win: standing.away?.win || 0,
      away_draw: standing.away?.draw || 0,
      away_lose: standing.away?.lose || 0,
      away_goals_for: standing.away?.goals?.for || 0,
      away_goals_against: standing.away?.goals?.against || 0,
      
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
// 메인 임포트 실행
// ============================================
async function runCompleteImport() {
  const startTime = Date.now()
  
  try {
    console.log('1️⃣ 팀 데이터 임포트...')
    await importTeams(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importTeams(K1_LEAGUE_ID, CURRENT_SEASON)
    await importTeams(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importTeams(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n2️⃣ 선수 및 팀 구성 데이터 임포트...')
    await importPlayersAndTeamPlayers(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importPlayersAndTeamPlayers(K1_LEAGUE_ID, CURRENT_SEASON)
    await importPlayersAndTeamPlayers(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importPlayersAndTeamPlayers(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n3️⃣ 경기 및 이벤트 데이터 임포트...')
    await importFixturesAndEvents(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importFixturesAndEvents(K1_LEAGUE_ID, CURRENT_SEASON)
    await importFixturesAndEvents(K2_LEAGUE_ID, PREVIOUS_SEASON)  
    await importFixturesAndEvents(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n4️⃣ 순위표 데이터 임포트...')
    await importStandings(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importStandings(K1_LEAGUE_ID, CURRENT_SEASON)
    await importStandings(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importStandings(K2_LEAGUE_ID, CURRENT_SEASON)
    
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    
    console.log('\\n' + '='.repeat(60))
    console.log('🎉 완전 새로운 API-Football 기반 임포트 완료!')
    console.log(`⏱️ 소요 시간: ${duration}초`)
    console.log('\\n📊 임포트 통계:')
    console.log(`   팀: ${stats.teams}개`)
    console.log(`   선수: ${stats.players}명`)
    console.log(`   팀-선수 관계: ${stats.teamPlayers}개`)
    console.log(`   경기: ${stats.fixtures}경기`)
    console.log(`   이벤트: ${stats.events}개`)
    console.log(`   순위: ${stats.standings}개`)
    console.log(`   선수 통계: ${stats.playerStats}개`)
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error)
    throw error
  }
}

async function main() {
  await runCompleteImport()
}

// 실행
main().catch(console.error)

export { runCompleteImport }