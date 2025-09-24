#!/usr/bin/env tsx
/**
 * 하이브리드 종합 마이그레이션 스크립트
 * K리그 공식 API + TheSportsDB Premium API 결합
 * 
 * 데이터 소스 전략:
 * - 실시간 스코어/이벤트: K리그 API (공식, 빠름)
 * - 팀 로고/선수 이미지: TheSportsDB (풍부함)  
 * - 기본 정보: K리그 API (신뢰성)
 * - 선수 상세 정보: 두 API 결합
 * - 라이브 스코어: TheSportsDB Premium
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { KLeagueAPI } from './lib/kleague-api.ts'
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts'
import HybridDataMapper from './lib/hybrid-data-mapper.ts'

// 환경 변수 로드
config()

interface EnvironmentConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  theSportsDBApiKey: string
  seasonYear: number
}

function validateEnvironment(): EnvironmentConfig {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE
  const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY
  const seasonYear = parseInt(process.env.SEASON_YEAR || '2025')

  console.log('🔍 환경 변수 확인:')
  console.log(`✅ SUPABASE_URL: ${supabaseUrl?.substring(0, 20)}...`)
  console.log(`✅ SUPABASE_SERVICE_ROLE: ${supabaseServiceKey?.substring(0, 20)}...`)
  console.log(`✅ THESPORTSDB_API_KEY: ${theSportsDBApiKey ? '프리미엄 키 설정됨' : '❌ 누락'}`)
  console.log(`✅ SEASON_YEAR: ${seasonYear}`)

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('❌ Supabase 환경 변수가 설정되지 않았습니다')
  }

  if (!theSportsDBApiKey) {
    throw new Error('❌ TheSportsDB Premium API Key가 설정되지 않았습니다')
  }

  return { 
    supabaseUrl, 
    supabaseServiceKey, 
    theSportsDBApiKey,
    seasonYear 
  }
}

async function main() {
  console.log('🚨 하이브리드 종합 마이그레이션 시작')
  console.log('🎯 목표: K리그 공식 + TheSportsDB 프리미엄 데이터 결합')
  console.log('💎 혜택: 공식 데이터 + 풍부한 이미지/상세 정보')
  console.log('')

  const startTime = performance.now()
  
  try {
    // 1. 환경 설정 검증
    const env = validateEnvironment()
    
    // 2. 클라이언트 초기화
    console.log('🔧 API 클라이언트 초기화...')
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey)
    const kLeagueAPI = new KLeagueAPI()
    const theSportsDBAPI = new TheSportsDBPremiumAPI({
      apiKey: env.theSportsDBApiKey
    })
    const hybridMapper = new HybridDataMapper(kLeagueAPI, theSportsDBAPI)

    // 3. API 연결 테스트
    console.log('🧪 API 연결 테스트...')
    const [kLeagueConnected, theSportsDBConnected] = await Promise.all([
      kLeagueAPI.testConnection(),
      theSportsDBAPI.testConnection()
    ])

    if (!kLeagueConnected) {
      throw new Error('❌ K리그 API 연결 실패')
    }

    if (!theSportsDBConnected) {
      console.warn('⚠️ TheSportsDB Premium API 연결 실패 - 기본 데이터만 사용')
    }

    console.log('✅ API 연결 상태:')
    console.log(`  🇰🇷 K리그 공식: ${kLeagueConnected ? '연결됨' : '실패'}`)
    console.log(`  💎 TheSportsDB Premium: ${theSportsDBConnected ? '연결됨' : '실패'}`)
    console.log('')

    // 4. 하이브리드 데이터 수집
    console.log('🚀 하이브리드 데이터 수집 시작...')
    const hybridData = await hybridMapper.getComprehensiveHybridData()

    // 5. 데이터베이스 저장
    console.log('📥 데이터베이스 저장 시작...')
    
    let teamsSaved = 0
    let teamsErrors = 0
    let playersSaved = 0
    let playersErrors = 0

    // 5.1 하이브리드 팀 저장
    console.log(`👥 ${hybridData.teams.length}개 하이브리드 팀 저장 중...`)
    for (const team of hybridData.teams) {
      try {
        const { error } = await supabase
          .from('teams')
          .upsert({
            id: team.id,
            name: team.name,
            code: team.code,
            logo_url: team.logo_url,
            country_name: team.country_name,
            founded: team.founded,
            national: false,
            league_id: team.league_id,
            season_year: team.season_year,
            venue_name: team.stadium || null,
            data_source: 'hybrid',
            created_at: team.created_at,
            updated_at: team.updated_at
          })

        if (error) {
          console.error(`❌ 팀 저장 실패 ${team.name}:`, error.message)
          teamsErrors++
        } else {
          console.log(`✅ 하이브리드 팀 저장: ${team.name} (로고: ${team.logo_url ? '✓' : '✗'})`)
          teamsSaved++
        }
      } catch (error) {
        console.error(`❌ 팀 저장 오류 ${team.name}:`, error)
        teamsErrors++
      }
    }

    // 5.2 하이브리드 선수 저장 (기존 player_statistics 테이블 활용)
    console.log(`⚽ ${hybridData.players.length}명 하이브리드 선수 저장 중...`)
    for (const player of hybridData.players) {
      try {
        // 선수 기본 정보는 players 테이블에, 통계는 player_statistics에
        const { error: playerError } = await supabase
          .from('players')
          .upsert({
            id: player.id || Math.floor(Math.random() * 1000000), // 임시 ID
            name: player.name,
            nationality: player.nationality,
            height_cm: player.height,
            weight_kg: player.weight,
            birth_date: player.birth_date,
            birth_place: player.birth_location,
            birth_country: player.birth_country,
            photo_url: player.photo_url,
            injured: false,
            created_at: player.created_at,
            updated_at: player.updated_at
          })

        if (playerError) {
          console.error(`❌ 선수 저장 실패 ${player.name}:`, playerError.message)
          playersErrors++
        } else {
          console.log(`✅ 하이브리드 선수 저장: ${player.name} (사진: ${player.photo_url ? '✓' : '✗'})`)
          playersSaved++
        }
      } catch (error) {
        console.error(`❌ 선수 저장 오류 ${player.name}:`, error)
        playersErrors++
      }
    }

    // 6. 실시간 스코어 저장 (별도 테이블 또는 로그)
    if (hybridData.liveScores.length > 0) {
      console.log(`📡 ${hybridData.liveScores.length}개 실시간 스코어 기록...`)
      // TODO: 실시간 스코어를 위한 별도 테이블 또는 로깅 시스템
      for (const liveScore of hybridData.liveScores) {
        console.log(`🔴 LIVE: ${liveScore.strHomeTeam} ${liveScore.intHomeScore || 0} - ${liveScore.intAwayScore || 0} ${liveScore.strAwayTeam}`)
      }
    }

    // 7. 최종 검증
    console.log('🔍 최종 데이터 검증...')
    const [
      { count: totalTeams },
      { count: hybridTeams },
      { count: totalPlayers }
    ] = await Promise.all([
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('teams').select('*', { count: 'exact', head: true }).eq('data_source', 'hybrid'),
      supabase.from('players').select('*', { count: 'exact', head: true })
    ])

    const endTime = performance.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log('')
    console.log('📊 하이브리드 마이그레이션 요약:')
    console.log(`👥 팀: ${teamsSaved}개 저장, ${teamsErrors}개 오류`)
    console.log(`⚽ 선수: ${playersSaved}명 저장, ${playersErrors}개 오류`)
    console.log(`📡 실시간: ${hybridData.liveScores.length}경기`)
    console.log('')
    console.log('🔍 데이터베이스 검증:')
    console.log(`   전체 팀: ${totalTeams}개`)
    console.log(`   하이브리드 팀: ${hybridTeams}개`)
    console.log(`   전체 선수: ${totalPlayers}명`)
    console.log('')
    console.log('📈 데이터 품질:')
    console.log(`   로고 보유 팀: ${hybridData.dataQuality.teams_with_images}/${hybridData.teams.length}`)
    console.log(`   상세 정보 선수: ${hybridData.dataQuality.players_with_details}/${hybridData.players.length}`)
    console.log(`   데이터 소스: ${hybridData.dataQuality.data_sources_used.join(', ')}`)
    console.log('')
    console.log(`⏱️  마이그레이션 완료 시간: ${duration}초`)
    
    if (teamsErrors + playersErrors === 0) {
      console.log('🎉 하이브리드 종합 마이그레이션 성공!')
      console.log('✅ K리그 공식 + TheSportsDB Premium 데이터 결합 완료')
      console.log('🚀 확장된 데이터 범위: 공식 정확성 + 풍부한 미디어')
    } else {
      console.log(`⚠️  마이그레이션 완료 (오류 ${teamsErrors + playersErrors}개) - 수동 검토 권장`)
    }

    console.log('')
    console.log('📋 하이브리드 시스템 사용 가이드:')
    console.log('   - 실시간 스코어: K리그 공식 API (최신, 정확)')
    console.log('   - 팀 로고/이미지: TheSportsDB Premium (고품질)')  
    console.log('   - 선수 상세 정보: 두 API 결합 (포괄적)')
    console.log('   - 기본 데이터: K리그 우선 (공식 신뢰성)')
    console.log('')
    console.log('🔗 데이터 소스:')
    console.log('   🇰🇷 K리그 공식: https://www.kleague.com')
    console.log('   💎 TheSportsDB Premium: v2 API 활용')
    
  } catch (error) {
    console.error('💥 하이브리드 마이그레이션 실패:', error)
    process.exit(1)
  }
}

// 메인 함수 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 스크립트 실행 오류:', error)
    process.exit(1)
  })
}