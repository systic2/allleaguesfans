#!/usr/bin/env tsx
/**
 * 3-API 통합 마이그레이션 스크립트
 * K리그 공식 API + TheSportsDB Premium + Highlightly API
 * CSV 분석 기반 데이터 소스 최적화 전략 구현
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { KLeagueAPI } from './lib/kleague-api.ts'
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts'
import { HighlightlyAPI } from './lib/highlightly-api.ts'
import { HybridDataMapper } from './lib/hybrid-data-mapper.ts'

config()

// 환경 변수 확인
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE',
  'THESPORTSDB_API_KEY',
  'HIGHLIGHTLY_API_KEY'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 필수 환경 변수가 누락되었습니다: ${envVar}`)
    process.exit(1)
  }
}

// API 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
)

const kLeagueAPI = new KLeagueAPI()
const theSportsDBAPI = new TheSportsDBPremiumAPI({
  apiKey: process.env.THESPORTSDB_API_KEY!
})
const highlightlyAPI = new HighlightlyAPI({
  apiKey: process.env.HIGHLIGHTLY_API_KEY!
})

const hybridMapper = new HybridDataMapper(kLeagueAPI, theSportsDBAPI, highlightlyAPI)

/**
 * 팀 데이터 마이그레이션
 */
async function migrateTeams(teams: any[]): Promise<void> {
  console.log(`👥 ${teams.length}개 팀 데이터 마이그레이션 시작...`)
  
  const batchSize = 10
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < teams.length; i += batchSize) {
    const batch = teams.slice(i, i + batchSize)
    
    for (const team of batch) {
      try {
        const { error } = await supabase
          .from('teams')
          .upsert({
            id: team.id,
            name: team.name,
            code: team.code,
            league_id: team.league_id,
            season_year: team.season_year,
            country_name: team.country_name,
            venue_name: team.stadium,
            founded: team.founded,
            website: team.website,
            manager: team.manager,
            description: team.description,
            logo_url: team.logo_url,
            badge_url: team.badge_url,
            jersey_url: team.jersey_url,
            fanart_urls: team.fanart_urls,
            stadium_capacity: team.stadium_capacity,
            stadium_image: team.stadium_image,
            social_media: team.social_media,
            national: false, // K리그 팀들은 클럽팀
            data_source: 'hybrid',
            created_at: team.created_at,
            updated_at: team.updated_at
          }, {
            onConflict: 'id'
          })
          
        if (error) {
          console.error(`❌ 팀 ${team.name} 마이그레이션 실패:`, error.message)
          errorCount++
        } else {
          successCount++
          console.log(`✅ ${team.name} 마이그레이션 완료`)
        }
      } catch (error) {
        console.error(`❌ 팀 ${team.name} 마이그레이션 중 오류:`, error)
        errorCount++
      }
    }
    
    // API 호출 제한을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`📊 팀 마이그레이션 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)
}

/**
 * 선수 데이터 마이그레이션
 */
async function migratePlayers(players: any[]): Promise<void> {
  console.log(`⚽ ${players.length}명 선수 데이터 마이그레이션 시작...`)
  
  const batchSize = 20
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize)
    
    for (const player of batch) {
      try {
        const { error } = await supabase
          .from('players')
          .upsert({
            id: player.id,
            name: player.name,
            team_id: player.team_id,
            league_id: player.league_id,
            season_year: player.season_year,
            nationality: player.nationality,
            position: player.position,
            jersey_number: player.back_number,
            height: player.height,
            weight: player.weight,
            birth_date: player.birth_date,
            birth_place: player.birth_location,
            description: player.description,
            photo_url: player.photo_url,
            cutout_url: player.cutout_url,
            fanart_urls: player.fanart_urls,
            social_media: player.social_media,
            goals: player.goals,
            assists: player.assists,
            clean_sheets: player.clean_sheets,
            appearances: player.appearances,
            minutes_played: player.minutes_played,
            yellow_cards: player.yellow_cards,
            red_cards: player.red_cards,
            data_source: player.data_sources?.join(',') || 'hybrid',
            created_at: player.created_at,
            updated_at: player.updated_at
          }, {
            onConflict: 'id'
          })
          
        if (error) {
          console.error(`❌ 선수 ${player.name} 마이그레이션 실패:`, error.message)
          errorCount++
        } else {
          successCount++
          if (successCount % 10 === 0) {
            console.log(`✅ ${successCount}명 선수 마이그레이션 완료`)
          }
        }
      } catch (error) {
        console.error(`❌ 선수 ${player.name} 마이그레이션 중 오류:`, error)
        errorCount++
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.log(`📊 선수 마이그레이션 완료: 성공 ${successCount}명, 실패 ${errorCount}명`)
}

/**
 * 경기 데이터 마이그레이션 (3-API 통합 데이터 포함)
 */
async function migrateFixtures(fixtures: any[]): Promise<void> {
  console.log(`⚽ ${fixtures.length}개 경기 데이터 마이그레이션 시작...`)
  
  const batchSize = 15
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < fixtures.length; i += batchSize) {
    const batch = fixtures.slice(i, i + batchSize)
    
    for (const fixture of batch) {
      try {
        // 1. 기본 경기 정보 저장
        const { error: fixtureError } = await supabase
          .from('fixtures')
          .upsert({
            id: fixture.id,
            home_team_id: fixture.home_team_id,
            away_team_id: fixture.away_team_id,
            league_id: fixture.league_id,
            season_year: fixture.season_year,
            date_utc: fixture.date_utc,
            status: fixture.status,
            home_goals: fixture.home_goals,
            away_goals: fixture.away_goals,
            venue: fixture.venue,
            round: fixture.round,
            spectators: fixture.spectators,
            referee: fixture.referee,
            weather: fixture.weather,
            data_source: fixture.data_sources?.join(',') || 'hybrid',
            created_at: fixture.created_at,
            updated_at: fixture.updated_at
          }, {
            onConflict: 'id'
          })
        
        if (fixtureError) {
          console.error(`❌ 경기 ${fixture.id} 마이그레이션 실패:`, fixtureError.message)
          errorCount++
          continue
        }
        
        // 2. 실시간 스코어 정보 저장 (있는 경우)
        if (fixture.real_time_score || fixture.live_score) {
          const realTimeData = fixture.real_time_score || {
            home: fixture.live_score?.intHomeScore || fixture.home_goals,
            away: fixture.live_score?.intAwayScore || fixture.away_goals,
            minute: fixture.live_score?.minute,
            status: fixture.live_score?.strStatus || fixture.status
          }
          
          await supabase
            .from('live_scores')
            .upsert({
              fixture_id: fixture.id,
              home_score: realTimeData.home,
              away_score: realTimeData.away,
              minute: realTimeData.minute,
              status: realTimeData.status,
              source: fixture.real_time_score ? 'highlightly' : 'thesportsdb',
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'fixture_id'
            })
        }
        
        // 3. 라이브 이벤트 저장 (Highlightly)
        if (fixture.live_events?.length > 0) {
          for (const event of fixture.live_events) {
            await supabase
              .from('match_events')
              .upsert({
                fixture_id: fixture.id,
                player_name: event.player?.name,
                event_type: event.type,
                minute: event.minute + (event.additional_time || 0),
                team_side: event.team_id,
                description: event.description,
                assist_player: event.assist_player?.name,
                source: 'highlightly',
                created_at: new Date().toISOString()
              }, {
                onConflict: 'fixture_id,minute,event_type,player_name'
              })
          }
        }
        
        // 4. 하이라이트 저장 (Highlightly)
        if (fixture.highlights?.length > 0) {
          for (const highlight of fixture.highlights) {
            await supabase
              .from('highlights')
              .upsert({
                fixture_id: fixture.id,
                title: highlight.title,
                video_url: highlight.url,
                thumbnail_url: highlight.thumbnail_url,
                duration: highlight.duration,
                type: highlight.type,
                quality: highlight.quality,
                source: 'highlightly',
                created_at: new Date().toISOString()
              })
          }
        }
        
        successCount++
        if (successCount % 5 === 0) {
          console.log(`✅ ${successCount}개 경기 마이그레이션 완료`)
        }
        
      } catch (error) {
        console.error(`❌ 경기 ${fixture.id} 마이그레이션 중 오류:`, error)
        errorCount++
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`📊 경기 마이그레이션 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)
}

/**
 * 데이터 품질 검증
 */
async function validateDataQuality(): Promise<void> {
  console.log('🔍 데이터 품질 검증 시작...')
  
  try {
    // 팀 데이터 검증
    const { data: teams, count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact' })
    
    const teamsWithLogos = teams?.filter(t => t.logo_url).length || 0
    console.log(`📊 팀 데이터: 총 ${teamCount}개, 로고 ${teamsWithLogos}개 (${((teamsWithLogos/(teamCount||1))*100).toFixed(1)}%)`)
    
    // 선수 데이터 검증
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact' })
    
    const { data: playersWithPhotos } = await supabase
      .from('players')
      .select('photo_url')
      .not('photo_url', 'is', null)
    
    const photosCount = playersWithPhotos?.length || 0
    console.log(`📊 선수 데이터: 총 ${playerCount}명, 사진 ${photosCount}개 (${((photosCount/(playerCount||1))*100).toFixed(1)}%)`)
    
    // 경기 데이터 검증
    const { count: fixtureCount } = await supabase
      .from('fixtures')
      .select('*', { count: 'exact' })
    
    const { count: liveScoreCount } = await supabase
      .from('live_scores')
      .select('*', { count: 'exact' })
    
    const { count: highlightCount } = await supabase
      .from('highlights')
      .select('*', { count: 'exact' })
    
    console.log(`📊 경기 데이터: 총 ${fixtureCount}개`)
    console.log(`📊 실시간 스코어: ${liveScoreCount}개`)
    console.log(`📊 하이라이트: ${highlightCount}개`)
    
    // 데이터 소스별 통계
    const { data: sourceStats } = await supabase
      .from('teams')
      .select('data_source')
    
    const sourceCount = sourceStats?.reduce((acc: Record<string, number>, item) => {
      acc[item.data_source] = (acc[item.data_source] || 0) + 1
      return acc
    }, {}) || {}
    
    console.log('📊 데이터 소스별 통계:')
    for (const [source, count] of Object.entries(sourceCount)) {
      console.log(`   - ${source}: ${count}개`)
    }
    
  } catch (error) {
    console.error('❌ 데이터 품질 검증 중 오류:', error)
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function main(): Promise<void> {
  console.log('🚀 3-API 통합 마이그레이션 시작')
  console.log('=' * 60)
  console.log(`📅 시작 시간: ${new Date().toISOString()}`)
  console.log(`🔑 API 키 확인:`)
  console.log(`   - TheSportsDB: ${process.env.THESPORTSDB_API_KEY?.slice(0, 6)}...`)
  console.log(`   - Highlightly: ${process.env.HIGHLIGHTLY_API_KEY?.slice(0, 8)}...`)
  
  try {
    // 1. API 연결 테스트
    console.log('\n🧪 API 연결 테스트...')
    const [kLeagueOK, theSportsDBOK, highlightlyOK] = await Promise.all([
      kLeagueAPI.testConnection(),
      theSportsDBAPI.testConnection(),
      highlightlyAPI.testConnection()
    ])
    
    if (!kLeagueOK) {
      console.error('❌ K리그 API 연결 실패')
      return
    }
    
    if (!theSportsDBOK) {
      console.warn('⚠️ TheSportsDB API 연결 실패 - 이미지 데이터 제한됨')
    }
    
    if (!highlightlyOK) {
      console.warn('⚠️ Highlightly API 연결 실패 - 실시간 데이터 제한됨')
    }
    
    console.log(`✅ API 연결 테스트 완료: K리그(${kLeagueOK ? '✅' : '❌'}), TheSportsDB(${theSportsDBOK ? '✅' : '❌'}), Highlightly(${highlightlyOK ? '✅' : '❌'})`)
    
    // 2. 하이브리드 데이터 수집
    console.log('\n📊 3-API 하이브리드 데이터 수집 시작...')
    const hybridData = await hybridMapper.getComprehensiveHybridData()
    
    console.log(`\n📈 수집된 데이터 요약:`)
    console.log(`   - 팀: ${hybridData.teams.length}개`)
    console.log(`   - 선수: ${hybridData.players.length}명`)
    console.log(`   - 경기: ${hybridData.fixtures.length}개`)
    console.log(`   - 실시간 경기: ${hybridData.dataQuality.live_matches}개`)
    console.log(`   - 하이라이트: ${hybridData.dataQuality.highlights_count}개`)
    console.log(`   - 데이터 품질: 팀 이미지 ${hybridData.dataQuality.teams_with_images}개, 선수 상세정보 ${hybridData.dataQuality.players_with_details}개`)
    
    // 3. 데이터베이스 마이그레이션
    console.log('\n💾 데이터베이스 마이그레이션 시작...')
    
    await migrateTeams(hybridData.teams)
    await migratePlayers(hybridData.players)
    await migrateFixtures(hybridData.fixtures)
    
    // 4. 데이터 품질 검증
    console.log('\n🔍 마이그레이션 후 데이터 품질 검증...')
    await validateDataQuality()
    
    console.log('\n🎉 3-API 통합 마이그레이션 완료!')
    console.log(`📅 완료 시간: ${new Date().toISOString()}`)
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error)
    process.exit(1)
  }
}

// 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 마이그레이션 실패:', error)
    process.exit(1)
  })
}