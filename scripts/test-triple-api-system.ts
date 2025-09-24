#!/usr/bin/env tsx
/**
 * 3-API 통합 시스템 테스트 스크립트
 * K리그 API + TheSportsDB Premium + Highlightly API
 * CSV 분석 전략 검증 및 성능 테스트
 */

import { config } from 'dotenv'
import { KLeagueAPI } from './lib/kleague-api.ts'
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts'
import { HighlightlyAPI } from './lib/highlightly-api.ts'
import { HybridDataMapper } from './lib/hybrid-data-mapper.ts'

config()

async function testTripleAPISystem() {
  console.log('🧪 3-API 통합 시스템 테스트 시작')
  console.log('=' * 60)
  
  try {
    // 1. 개별 API 연결 테스트
    console.log('🔌 개별 API 연결 테스트...')
    
    console.log('\n🇰🇷 K리그 공식 API 테스트...')
    const kLeagueAPI = new KLeagueAPI()
    const kLeagueConnected = await kLeagueAPI.testConnection()
    console.log(`결과: ${kLeagueConnected ? '✅ 연결 성공' : '❌ 연결 실패'}`)
    
    if (kLeagueConnected) {
      const recentMatches = await kLeagueAPI.getRecentMatches()
      console.log(`📊 최근 경기: ${recentMatches.all.length}개 (K1: ${recentMatches.league1.length}, K2: ${recentMatches.league2.length})`)
      
      const rankings = await kLeagueAPI.getTeamRankings()
      console.log(`📊 팀 순위: K1 ${rankings.league1.length}팀, K2 ${rankings.league2.length}팀`)
    }
    
    console.log('\n💎 TheSportsDB Premium API 테스트...')
    const theSportsDBKey = process.env.THESPORTSDB_API_KEY
    if (theSportsDBKey && theSportsDBKey.length > 3) {
      const theSportsDBAPI = new TheSportsDBPremiumAPI({
        apiKey: theSportsDBKey
      })
      
      const theSportsDBConnected = await theSportsDBAPI.testConnection()
      console.log(`결과: ${theSportsDBConnected ? '✅ Premium 연결 성공' : '❌ Premium 연결 실패'}`)
      
      if (theSportsDBConnected) {
        const liveScores = await theSportsDBAPI.getLiveScores()
        console.log(`📡 실시간 스코어: ${liveScores.length}경기`)
        
        // 한국 리그 검색 테스트
        const koreanData = await theSportsDBAPI.getComprehensiveKoreanData()
        console.log(`🇰🇷 한국 데이터: ${koreanData.leagues.length}개 리그, ${koreanData.teams.length}개 팀`)
      }
    } else {
      console.log('⚠️ TheSportsDB Premium API 키가 설정되지 않음')
    }
    
    console.log('\n⚡ Highlightly API 테스트...')
    const highlightlyKey = process.env.HIGHLIGHTLY_API_KEY
    if (highlightlyKey && highlightlyKey.length > 8) {
      const highlightlyAPI = new HighlightlyAPI({
        apiKey: highlightlyKey
      })
      
      const highlightlyConnected = await highlightlyAPI.testConnection()
      console.log(`결과: ${highlightlyConnected ? '✅ 연결 성공' : '❌ 연결 실패'}`)
      
      if (highlightlyConnected) {
        const liveMatches = await highlightlyAPI.getLiveMatches()
        console.log(`📡 실시간 경기: ${liveMatches.length}경기`)
        
        // 한국 리그 데이터 테스트
        const koreanData = await highlightlyAPI.getKoreanLeagueComprehensiveData()
        console.log(`🇰🇷 한국 데이터: ${koreanData.leagues.length}개 리그, ${koreanData.liveMatches.length}개 실시간 경기, ${koreanData.highlights.length}개 하이라이트`)
      }
    } else {
      console.log('⚠️ Highlightly API 키가 설정되지 않음')
    }
    
    // 2. 하이브리드 매퍼 테스트
    console.log('\n🔗 3-API 하이브리드 매퍼 테스트...')
    
    if (kLeagueConnected && (theSportsDBKey || highlightlyKey)) {
      const theSportsDBAPI = new TheSportsDBPremiumAPI({ apiKey: theSportsDBKey || 'dummy' })
      const highlightlyAPI = new HighlightlyAPI({ apiKey: highlightlyKey || 'dummy' })
      const hybridMapper = new HybridDataMapper(kLeagueAPI, theSportsDBAPI, highlightlyAPI)
      
      console.log('📊 샘플 하이브리드 데이터 생성 중...')
      
      // 샘플 팀 데이터 테스트
      const rankings = await kLeagueAPI.getTeamRankings()
      if (rankings.league1.length > 0) {
        const sampleTeam = rankings.league1[0]
        console.log(`🏆 샘플 팀: ${sampleTeam.teamName} (${sampleTeam.rank}위)`)
        
        const hybridTeam = await hybridMapper.createHybridTeam(sampleTeam)
        console.log(`✅ 하이브리드 팀 데이터 생성:`)
        console.log(`   - 기본 정보: ${hybridTeam.name}`)
        console.log(`   - 이미지: ${hybridTeam.logo_url ? '있음' : '없음'}`)
        console.log(`   - 소셜미디어: ${Object.keys(hybridTeam.social_media).filter(k => hybridTeam.social_media[k]).length}개`)
      }
      
      // 샘플 경기 데이터 테스트
      const recentMatches = await kLeagueAPI.getRecentMatches()
      if (recentMatches.all.length > 0) {
        const sampleMatch = recentMatches.all[0]
        console.log(`⚽ 샘플 경기: ${sampleMatch.homeTeamName} vs ${sampleMatch.awayTeamName}`)
        
        const hybridFixture = await hybridMapper.createHybridFixture(sampleMatch)
        console.log(`✅ 하이브리드 경기 데이터 생성:`)
        console.log(`   - 기본 정보: ${hybridFixture.status}`)
        console.log(`   - 실시간 데이터: ${hybridFixture.real_time_score ? '있음' : '없음'}`)
        console.log(`   - 하이라이트: ${hybridFixture.highlights.length}개`)
        console.log(`   - 라이브 이벤트: ${hybridFixture.live_events.length}개`)
        console.log(`   - 데이터 소스: ${hybridFixture.data_sources.join(', ')}`)
      }
      
    } else {
      console.log('⚠️ 하이브리드 매퍼 테스트 스킵 (API 연결 실패)') 
    }
    
    // 3. CSV 전략 검증
    console.log('\n📋 CSV 분석 전략 검증...')
    console.log('🎯 데이터 소스 전략:')
    console.log('   - 실시간 스코어/이벤트: Highlightly (주요) → TheSportsDB (보조)')
    console.log('   - 라인업/경기 통계: Highlightly + K리그 (결합하여 높은 정확도)')
    console.log('   - 팀 로고/선수 이미지: TheSportsDB (주요) → Highlightly (보조)')
    console.log('   - 기본 팀/리그 정보: TheSportsDB (주요) → Highlightly (보조)')
    console.log('   - 비디오 하이라이트: Highlightly (주요) → TheSportsDB 유튜브 링크 (보조)')
    
    // 4. 성능 및 안정성 점검
    console.log('\n⚡ 성능 및 안정성 점검...')
    
    const startTime = Date.now()
    let apiCallCount = 0
    
    try {
      if (kLeagueConnected) {
        await kLeagueAPI.getTeamRankings()
        apiCallCount++
      }
      
      if (theSportsDBKey) {
        const theSportsDBAPI = new TheSportsDBPremiumAPI({ apiKey: theSportsDBKey })
        await theSportsDBAPI.getLiveScores()
        apiCallCount++
      }
      
      if (highlightlyKey) {
        const highlightlyAPI = new HighlightlyAPI({ apiKey: highlightlyKey })
        await highlightlyAPI.getLiveMatches()
        apiCallCount++
      }
    } catch (error) {
      console.warn('⚠️ 일부 API 호출 실패:', error)
    }
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    console.log(`📊 성능 결과:`)
    console.log(`   - 총 API 호출: ${apiCallCount}개`)
    console.log(`   - 소요 시간: ${totalTime}ms`)
    console.log(`   - 평균 응답 시간: ${apiCallCount > 0 ? (totalTime / apiCallCount).toFixed(0) : '측정 불가'}ms`)
    
    // 5. 환경 설정 요약
    console.log('\n📋 환경 설정 요약:')
    console.log(`✅ SUPABASE_URL: ${process.env.SUPABASE_URL ? '설정됨' : '❌ 누락'}`)
    console.log(`✅ SUPABASE_SERVICE_ROLE: ${process.env.SUPABASE_SERVICE_ROLE ? '설정됨' : '❌ 누락'}`)
    console.log(`🔑 THESPORTSDB_API_KEY: ${theSportsDBKey && theSportsDBKey.length > 3 ? '✅ 설정됨' : '❌ 누락 또는 무효'}`)
    console.log(`⚡ HIGHLIGHTLY_API_KEY: ${highlightlyKey && highlightlyKey.length > 8 ? '✅ 설정됨' : '❌ 누락 또는 무효'}`)
    console.log(`📅 SEASON_YEAR: ${process.env.SEASON_YEAR || '2025'}`)
    
    // 6. 준비 상태 평가
    console.log('\n🎯 3-API 통합 시스템 준비 상태:')
    const readinessScore = [
      kLeagueConnected,
      !!process.env.SUPABASE_URL,
      !!process.env.SUPABASE_SERVICE_ROLE,
      !!(theSportsDBKey && theSportsDBKey.length > 3),
      !!(highlightlyKey && highlightlyKey.length > 8)
    ].filter(Boolean).length
    
    console.log(`준비도: ${readinessScore}/5 (${(readinessScore/5*100).toFixed(0)}%)`)
    
    if (readinessScore >= 4) {
      console.log('✅ 3-API 통합 마이그레이션 실행 준비 완료!')
      console.log('🚀 다음 명령어로 실행:')
      console.log('   npx tsx scripts/triple-api-comprehensive-migration.ts')
    } else if (readinessScore >= 3) {
      console.log('⚠️ 기본 마이그레이션 가능 (일부 기능 제한)')
      console.log('🚀 실행:')
      console.log('   npx tsx scripts/triple-api-comprehensive-migration.ts')
    } else {
      console.log('❌ 추가 설정이 필요합니다.')
      
      if (!kLeagueConnected) {
        console.log('   - K리그 API 연결 확인 필요')
      }
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
        console.log('   - Supabase 환경 변수 설정 필요')
      }
      if (!theSportsDBKey || theSportsDBKey.length <= 3) {
        console.log('   - TheSportsDB Premium API 키 설정 필요')
      }
      if (!highlightlyKey || highlightlyKey.length <= 8) {
        console.log('   - Highlightly API 키 설정 필요')
      }
    }

  } catch (error) {
    console.error('💥 3-API 시스템 테스트 실패:', error)
    process.exit(1)
  }
}

// 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  testTripleAPISystem().catch(console.error)
}