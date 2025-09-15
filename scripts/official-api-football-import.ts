// official-api-football-import.ts
// API-Football 공식 아키텍처 다이어그램을 정확히 따르는 데이터 임포트 시스템
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
  fixtureStatistics: number
  standings: number
  topScorers: number
  teamsStatistics: number
  coaches: number
  injuries: number
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
  fixtureStatistics: 0,
  standings: 0,
  topScorers: 0,
  teamsStatistics: 0,
  coaches: 0,
  injuries: 0
}

console.log('🎯 API-Football 공식 아키텍처 기반 완전 새로운 데이터 임포트')
console.log('='.repeat(70))

// ============================================
// 1. TEAMS 및 VENUES 임포트 (다이어그램 우측)
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
          name: venue.name,
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
    
    console.log(`  ✅ ${teams.length}개 팀 및 경기장 임포트 완료`)
  } catch (error) {
    console.error(`  ❌ 팀/경기장 임포트 실패:`, error)
  }
}

// ============================================
// 2. PLAYERS, PLAYERS_SQUADS, PLAYERS_STATISTICS 임포트
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
          
          // 2. PLAYERS_SQUADS 테이블 (팀-선수 관계)
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
          
          // 3. PLAYERS_STATISTICS 테이블 (선수 통계)
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
            
            const statsRecord = {
              player_id: Number(player.id),
              team_id: teamId,
              league_id: leagueId,
              season_year: season,
              
              games_appearances: games.appearences || 0,
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
              penalty_committed: penalty.commited || 0,
              penalty_scored: penalty.scored || 0,
              penalty_missed: penalty.missed || 0,
              penalty_saved: penalty.saved || 0,
              
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
// 3. FIXTURES 및 관련 데이터 임포트 (EVENTS, LINEUPS, FIXTURE_STATISTICS)
// ============================================
async function importFixturesAndRelated(leagueId: number, season: number) {
  console.log(`🏟️ 경기 관련 데이터 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const fixtures = await apiPaged('fixtures', { league: leagueId, season })
    
    for (const fixture of fixtures) {
      try {
        // 1. FIXTURES 테이블
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
        
        // 2. EVENTS 테이블 (완료된 경기만)
        if (fixture.fixture.status?.short === 'FT') {
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
              if (!eventsError) stats.events += eventRecords.length
            }
            
          } catch (eventsError) {
            console.warn(`    경기 ${fixture.fixture.id} 이벤트 처리 실패:`, eventsError)
          }
          
          // 3. LINEUPS 테이블 (완료된 경기만)
          try {
            const lineupsResponse = await apiGet('fixtures/lineups', { fixture: fixture.fixture.id })
            const lineups = lineupsResponse.response || []
            
            for (const lineup of lineups) {
              const lineupRecord = {
                fixture_id: Number(fixture.fixture.id),
                team_id: Number(lineup.team.id),
                formation: lineup.formation,
                coach_name: lineup.coach?.name,
                coach_photo_url: lineup.coach?.photo
              }
              
              const { error: lineupError } = await supa.from('lineups').insert([lineupRecord])
              if (!lineupError) stats.lineups++
            }
            
          } catch (lineupError) {
            console.warn(`    경기 ${fixture.fixture.id} 라인업 처리 실패:`, lineupError)
          }
          
          // 4. FIXTURE_STATISTICS 테이블 (완료된 경기만)
          try {
            const statisticsResponse = await apiGet('fixtures/statistics', { fixture: fixture.fixture.id })
            const statistics = statisticsResponse.response || []
            
            for (const teamStats of statistics) {
              const stats_data = {}
              for (const stat of teamStats.statistics) {
                const type = stat.type?.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                const value = stat.value
                
                // 주요 통계만 매핑
                switch(type) {
                  case 'shots_on_goal': stats_data['shots_on_goal'] = parseInt(value) || 0; break
                  case 'shots_off_goal': stats_data['shots_off_goal'] = parseInt(value) || 0; break
                  case 'total_shots': stats_data['total_shots'] = parseInt(value) || 0; break
                  case 'blocked_shots': stats_data['blocked_shots'] = parseInt(value) || 0; break
                  case 'shots_insidebox': stats_data['shots_inside_box'] = parseInt(value) || 0; break
                  case 'shots_outsidebox': stats_data['shots_outside_box'] = parseInt(value) || 0; break
                  case 'fouls': stats_data['fouls'] = parseInt(value) || 0; break
                  case 'corner_kicks': stats_data['corner_kicks'] = parseInt(value) || 0; break
                  case 'offsides': stats_data['offside'] = parseInt(value) || 0; break
                  case 'ball_possession': 
                    const possession = String(value).replace('%', '')
                    stats_data['ball_possession'] = parseInt(possession) || 0
                    break
                  case 'yellow_cards': stats_data['yellow_cards'] = parseInt(value) || 0; break
                  case 'red_cards': stats_data['red_cards'] = parseInt(value) || 0; break
                  case 'goalkeeper_saves': stats_data['goalkeeper_saves'] = parseInt(value) || 0; break
                  case 'total_passes': stats_data['total_passes'] = parseInt(value) || 0; break
                  case 'passes_accurate': stats_data['passes_accurate'] = parseInt(value) || 0; break
                  case 'passes_': 
                    const percentage = String(value).replace('%', '')
                    stats_data['passes_percentage'] = parseInt(percentage) || 0
                    break
                }
              }
              
              const fixtureStatsRecord = {
                fixture_id: Number(fixture.fixture.id),
                team_id: Number(teamStats.team.id),
                ...stats_data
              }
              
              const { error: statsError } = await supa.from('fixture_statistics').insert([fixtureStatsRecord])
              if (!statsError) stats.fixtureStatistics++
            }
            
          } catch (statisticsError) {
            console.warn(`    경기 ${fixture.fixture.id} 통계 처리 실패:`, statisticsError)
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.warn(`  경기 ${fixture.fixture?.id} 처리 실패:`, error)
      }
    }
    
  } catch (error) {
    console.error(`  ❌ 경기 데이터 임포트 실패:`, error)
  }
}

// ============================================
// 4. STANDINGS 임포트
// ============================================
async function importStandings(leagueId: number, season: number) {
  console.log(`📊 순위표 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
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
// 5. TOP_SCORERS 임포트 (득점왕 순위)
// ============================================
async function importTopScorers(leagueId: number, season: number) {
  console.log(`🏆 득점왕 순위 임포트... (리그: ${leagueId}, 시즌: ${season})`)
  
  try {
    const response = await apiGet('players/topscorers', { league: leagueId, season })
    const topScorers = response.response || []
    
    // 기존 득점왕 데이터 삭제
    await supa.from('top_scorers').delete().eq('league_id', leagueId).eq('season_year', season)
    
    const topScorerRecords = topScorers.map((scorer: any, index: number) => ({
      league_id: leagueId,
      season_year: season,
      player_id: Number(scorer.player.id),
      team_id: Number(scorer.statistics[0]?.team?.id),
      goals: scorer.statistics[0]?.goals?.total || 0,
      assists: scorer.statistics[0]?.goals?.assists || 0,
      games_played: scorer.statistics[0]?.games?.appearences || 0,
      penalty_goals: scorer.statistics[0]?.penalty?.scored || 0,
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
// 메인 임포트 실행
// ============================================
async function runOfficialImport() {
  const startTime = Date.now()
  
  try {
    console.log('1️⃣ 팀 및 경기장 데이터 임포트...')
    await importTeamsAndVenues(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importTeamsAndVenues(K1_LEAGUE_ID, CURRENT_SEASON)
    await importTeamsAndVenues(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importTeamsAndVenues(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n2️⃣ 선수 관련 데이터 임포트...')
    await importPlayersAndRelated(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importPlayersAndRelated(K1_LEAGUE_ID, CURRENT_SEASON)
    await importPlayersAndRelated(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importPlayersAndRelated(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n3️⃣ 경기 관련 데이터 임포트...')
    await importFixturesAndRelated(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importFixturesAndRelated(K1_LEAGUE_ID, CURRENT_SEASON)
    await importFixturesAndRelated(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importFixturesAndRelated(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n4️⃣ 순위표 데이터 임포트...')
    await importStandings(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importStandings(K1_LEAGUE_ID, CURRENT_SEASON)
    await importStandings(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importStandings(K2_LEAGUE_ID, CURRENT_SEASON)
    
    console.log('\\n5️⃣ 득점왕 순위 임포트...')
    await importTopScorers(K1_LEAGUE_ID, PREVIOUS_SEASON)
    await importTopScorers(K1_LEAGUE_ID, CURRENT_SEASON)
    await importTopScorers(K2_LEAGUE_ID, PREVIOUS_SEASON)
    await importTopScorers(K2_LEAGUE_ID, CURRENT_SEASON)
    
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    
    console.log('\\n' + '='.repeat(70))
    console.log('🎉 API-Football 공식 아키텍처 기반 완전 새로운 임포트 완료!')
    console.log(`⏱️ 소요 시간: ${duration}초`)
    console.log('\\n📊 임포트 통계:')
    console.log(`   팀: ${stats.teams}개`)
    console.log(`   경기장: ${stats.venues}개`)
    console.log(`   선수: ${stats.players}명`)
    console.log(`   선수-팀 관계: ${stats.playersSquads}개`)
    console.log(`   선수 통계: ${stats.playersStatistics}개`)
    console.log(`   경기: ${stats.fixtures}경기`)
    console.log(`   이벤트: ${stats.events}개`)
    console.log(`   라인업: ${stats.lineups}개`)
    console.log(`   경기 통계: ${stats.fixtureStatistics}개`)
    console.log(`   순위: ${stats.standings}개`)
    console.log(`   득점왕: ${stats.topScorers}명`)
    console.log('='.repeat(70))
    
  } catch (error) {
    console.error('❌ 임포트 실패:', error)
    throw error
  }
}

async function main() {
  await runOfficialImport()
}

// 실행
main().catch(console.error)

export { runOfficialImport }