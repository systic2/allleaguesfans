#!/usr/bin/env tsx

/**
 * 3-API 통합 마이그레이션 (스키마 호환성 수정 버전)
 * K리그 공식 API + TheSportsDB Premium + Highlightly API
 * 실제 데이터베이스 스키마에 맞춰 수정된 버전
 */

import { config } from 'dotenv'
import { KLeagueAPI } from './lib/kleague-api.ts'
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts'
import { HighlightlyAPI } from './lib/highlightly-api.ts'
import { HybridDataMapper } from './lib/hybrid-data-mapper.ts'
import { supa } from './lib/supabase.ts'

config()

interface MigrationStats {
  teams: { success: number; failed: number; errors: string[] }
  players: { success: number; failed: number; errors: string[] }
  fixtures: { success: number; failed: number; errors: string[] }
}

async function testAPIConnections() {
  console.log('🧪 API 연결 테스트...')
  
  const kLeagueAPI = new KLeagueAPI()
  const theSportsDBAPI = new TheSportsDBPremiumAPI({ 
    apiKey: process.env.THESPORTSDB_API_KEY || ''
  })
  const highlightlyAPI = new HighlightlyAPI({
    apiKey: process.env.HIGHLIGHTLY_API_KEY || ''
  })

  const [kLeague, theSportsDB, highlightly] = await Promise.all([
    kLeagueAPI.testConnection(),
    theSportsDBAPI.testConnection(),
    highlightlyAPI.testConnection()
  ])

  console.log(`✅ API 연결 테스트 완료: K리그(${kLeague ? '✅' : '❌'}), TheSportsDB(${theSportsDB ? '✅' : '❌'}), Highlightly(${highlightly ? '✅' : '❌'})`)
  
  return { kLeague, theSportsDB, highlightly }
}

async function collect3APIData() {
  console.log('📊 3-API 하이브리드 데이터 수집 시작...')
  
  const hybridMapper = new HybridDataMapper()
  const hybridData = await hybridMapper.getComprehensiveHybridData()
  
  console.log(`📈 수집된 데이터 요약:`)
  console.log(`   - 팀: ${hybridData.teams.length}개`)
  console.log(`   - 선수: ${hybridData.players.length}명`)
  console.log(`   - 경기: ${hybridData.fixtures.length}개`)
  console.log(`   - 실시간 경기: ${hybridData.liveMatches.length}개`)
  console.log(`   - 하이라이트: ${hybridData.highlights.length}개`)
  
  return hybridData
}

async function migrateTeamsWithCorrectSchema(teams: any[], stats: MigrationStats) {
  console.log(`👥 ${teams.length}개 팀 데이터 마이그레이션 시작 (스키마 수정)...`)
  
  for (const team of teams) {
    try {
      // 실제 DB 스키마에 맞춰 수정
      const teamData = {
        // 기본 정보
        id: team.id,
        name: team.name,
        code: team.code,
        league_id: team.league_id,
        season_year: team.season_year,
        country_name: team.country_name,
        founded: team.founded,
        
        // 로고 - badge_url 대신 logo_url 사용
        logo_url: team.badge_url || team.logo_url,
        
        // 경기장 정보
        venue_name: team.stadium,
        venue_capacity: team.stadium_capacity,
        venue_image: team.stadium_image,
        
        // 메타데이터
        data_source: 'hybrid',
        highlightly_id: team.highlightly_id || null,
        last_sync_highlightly: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supa
        .from('teams')
        .upsert(teamData, { onConflict: 'id' })

      if (error) {
        stats.teams.failed++
        stats.teams.errors.push(`팀 ${team.name} 마이그레이션 실패: ${error.message}`)
        console.warn(`❌ 팀 ${team.name} 마이그레이션 실패: ${error.message}`)
      } else {
        stats.teams.success++
      }
    } catch (err) {
      stats.teams.failed++
      const error = err instanceof Error ? err.message : 'Unknown error'
      stats.teams.errors.push(`팀 ${team.name} 마이그레이션 실패: ${error}`)
      console.warn(`❌ 팀 ${team.name} 마이그레이션 실패: ${error}`)
    }
  }
  
  console.log(`📊 팀 마이그레이션 완료: 성공 ${stats.teams.success}개, 실패 ${stats.teams.failed}개`)
}

async function migratePlayersWithCorrectSchema(players: any[], stats: MigrationStats) {
  console.log(`⚽ ${players.length}명 선수 데이터 마이그레이션 시작 (스키마 수정)...`)
  
  for (const player of players) {
    try {
      // 실제 DB 스키마에 맞춰 수정 (appearances 컬럼 제거)
      const playerData = {
        // 기본 정보
        id: player.id,
        name: player.name,
        firstname: player.firstname || null,
        lastname: player.lastname || null,
        nationality: player.nationality,
        birth_date: player.birth_date,
        birth_place: player.birth_location,
        height: player.height,
        weight: player.weight,
        position: player.position,
        
        // 팀 정보
        team_id: player.team_id,
        season_year: player.season_year,
        jersey_number: player.back_number,
        
        // 이미지
        photo: player.photo_url,
        
        // 메타데이터
        data_source: 'hybrid',
        highlightly_id: player.highlightly_id || null,
        last_sync_highlightly: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supa
        .from('players')
        .upsert(playerData, { onConflict: 'id' })

      if (error) {
        stats.players.failed++
        stats.players.errors.push(`선수 ${player.name} 마이그레이션 실패: ${error.message}`)
        console.warn(`❌ 선수 ${player.name} 마이그레이션 실패: ${error.message}`)
      } else {
        stats.players.success++
      }
    } catch (err) {
      stats.players.failed++
      const error = err instanceof Error ? err.message : 'Unknown error'
      stats.players.errors.push(`선수 ${player.name || 'Unknown'} 마이그레이션 실패: ${error}`)
      console.warn(`❌ 선수 ${player.name || 'Unknown'} 마이그레이션 실패: ${error}`)
    }
  }
  
  console.log(`📊 선수 마이그레이션 완료: 성공 ${stats.players.success}명, 실패 ${stats.players.failed}명`)
}

async function migrateFixturesWithCorrectSchema(fixtures: any[], stats: MigrationStats) {
  console.log(`⚽ ${fixtures.length}개 경기 데이터 마이그레이션 시작 (스키마 수정)...`)
  
  for (const fixture of fixtures) {
    try {
      // 실제 DB 스키마에 맞춰 수정 (spectators 컬럼 제거)
      const fixtureData = {
        // 기본 정보
        id: fixture.id,
        league_id: fixture.league_id,
        season_year: fixture.season_year,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        
        // 경기 정보
        date_utc: fixture.date_utc,
        status_short: fixture.status_short,
        status_long: fixture.status_long,
        elapsed: fixture.elapsed,
        round: fixture.round,
        
        // 스코어
        home_goals: fixture.home_goals,
        away_goals: fixture.away_goals,
        
        // 기타 정보
        referee: fixture.referee,
        venue_id: fixture.venue_id,
        
        // 메타데이터
        data_source: 'hybrid',
        highlightly_id: fixture.highlightly_id || null,
        last_sync_highlightly: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supa
        .from('fixtures')
        .upsert(fixtureData, { onConflict: 'id' })

      if (error) {
        stats.fixtures.failed++
        stats.fixtures.errors.push(`경기 ${fixture.id} 마이그레이션 실패: ${error.message}`)
        console.warn(`❌ 경기 ${fixture.id} 마이그레이션 실패: ${error.message}`)
      } else {
        stats.fixtures.success++
      }
    } catch (err) {
      stats.fixtures.failed++
      const error = err instanceof Error ? err.message : 'Unknown error'
      stats.fixtures.errors.push(`경기 ${fixture.id} 마이그레이션 실패: ${error}`)
      console.warn(`❌ 경기 ${fixture.id} 마이그레이션 실패: ${error}`)
    }
  }
  
  console.log(`📊 경기 마이그레이션 완료: 성공 ${stats.fixtures.success}개, 실패 ${stats.fixtures.failed}개`)
}

async function validateDataQuality() {
  console.log('🔍 마이그레이션 후 데이터 품질 검증...')
  
  try {
    const [
      { count: teamsCount },
      { count: teamsWithLogos },
      { count: playersCount },
      { count: playersWithPhotos },
      { count: fixturesCount }
    ] = await Promise.all([
      supa.from('teams').select('*', { count: 'exact' }).eq('data_source', 'hybrid'),
      supa.from('teams').select('*', { count: 'exact' }).not('logo_url', 'is', null),
      supa.from('players').select('*', { count: 'exact' }).eq('data_source', 'hybrid'),
      supa.from('players').select('*', { count: 'exact' }).not('photo', 'is', null),
      supa.from('fixtures').select('*', { count: 'exact' }).eq('data_source', 'hybrid')
    ])
    
    console.log('📊 데이터 품질 검증 결과:')
    console.log(`📊 하이브리드 팀 데이터: 총 ${teamsCount}개, 로고 ${teamsWithLogos}개 (${teamsWithLogos && teamsCount ? (teamsWithLogos/teamsCount*100).toFixed(1) : '0'}%)`)
    console.log(`📊 하이브리드 선수 데이터: 총 ${playersCount}명, 사진 ${playersWithPhotos}개 (${playersWithPhotos && playersCount ? (playersWithPhotos/playersCount*100).toFixed(1) : '0'}%)`)
    console.log(`📊 하이브리드 경기 데이터: 총 ${fixturesCount}개`)
    
  } catch (error) {
    console.warn('⚠️ 데이터 품질 검증 중 오류:', error)
  }
}

async function main() {
  const startTime = Date.now()
  console.log('🚀 3-API 통합 마이그레이션 시작 (스키마 수정 버전)')
  console.log('=' + '='.repeat(60))
  console.log(`📅 시작 시간: ${new Date().toISOString()}`)
  
  const stats: MigrationStats = {
    teams: { success: 0, failed: 0, errors: [] },
    players: { success: 0, failed: 0, errors: [] },
    fixtures: { success: 0, failed: 0, errors: [] }
  }
  
  try {
    // 1. API 연결 테스트
    const connections = await testAPIConnections()
    if (!connections.kLeague || !connections.theSportsDB || !connections.highlightly) {
      console.warn('⚠️ 일부 API 연결 실패 - 계속 진행')
    }
    
    // 2. 3-API 하이브리드 데이터 수집
    const hybridData = await collect3APIData()
    
    // 3. 데이터베이스 마이그레이션 (스키마 수정 버전)
    console.log('💾 데이터베이스 마이그레이션 시작 (스키마 호환성 수정)...')
    
    if (hybridData.teams.length > 0) {
      await migrateTeamsWithCorrectSchema(hybridData.teams, stats)
    }
    
    if (hybridData.players.length > 0) {
      await migratePlayersWithCorrectSchema(hybridData.players, stats)
    }
    
    if (hybridData.fixtures.length > 0) {
      await migrateFixturesWithCorrectSchema(hybridData.fixtures, stats)
    }
    
    // 4. 데이터 품질 검증
    await validateDataQuality()
    
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    
    console.log('\n🎉 3-API 통합 마이그레이션 완료!')
    console.log(`📅 완료 시간: ${new Date().toISOString()}`)
    console.log(`⏱️  소요 시간: ${duration}초`)
    
    console.log('\n📊 마이그레이션 결과:')
    console.log(`   팀: 성공 ${stats.teams.success}개, 실패 ${stats.teams.failed}개`)
    console.log(`   선수: 성공 ${stats.players.success}명, 실패 ${stats.players.failed}명`)
    console.log(`   경기: 성공 ${stats.fixtures.success}개, 실패 ${stats.fixtures.failed}개`)
    
    // 오류 요약
    const totalErrors = stats.teams.errors.length + stats.players.errors.length + stats.fixtures.errors.length
    if (totalErrors > 0) {
      console.log(`\n⚠️ 총 ${totalErrors}개 오류 발생`)
      if (stats.teams.errors.length > 0) {
        console.log(`\n❌ 팀 마이그레이션 오류 (${stats.teams.errors.length}개):`)
        stats.teams.errors.slice(0, 5).forEach(error => console.log(`   ${error}`))
        if (stats.teams.errors.length > 5) {
          console.log(`   ... 및 ${stats.teams.errors.length - 5}개 추가 오류`)
        }
      }
    } else {
      console.log('\n✅ 모든 마이그레이션 성공!')
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
    throw error
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ 3-API 통합 마이그레이션 실패:', error)
    process.exit(1)
  })
}