#!/usr/bin/env tsx

/**
 * GitHub Actions 오류 진단을 위한 API 연결 테스트
 */

import { config } from 'dotenv'
import { KLeagueAPI } from './lib/kleague-api.ts'
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts'
import { HighlightlyAPI } from './lib/highlightly-api.ts'

config()

async function debugAPIConnections() {
  console.log('🔍 GitHub Actions 오류 진단 - API 연결 테스트')
  console.log('=' + '='.repeat(60))
  
  // 환경 변수 확인
  const theSportsDBKey = process.env.THESPORTSDB_API_KEY
  const highlightlyKey = process.env.HIGHLIGHTLY_API_KEY
  
  console.log(`🔑 API 키 상태:`)
  console.log(`   TheSportsDB: ${theSportsDBKey ? '✅ 설정됨' : '❌ 누락'}`)
  console.log(`   Highlightly: ${highlightlyKey ? '✅ 설정됨' : '❌ 누락'}`)
  console.log('')
  
  // 1. K리그 API 테스트 (항상 작동해야 함)
  console.log('🇰🇷 K리그 API 테스트...')
  try {
    const kLeagueAPI = new KLeagueAPI()
    const kResult = await kLeagueAPI.testConnection()
    console.log(`   결과: ${kResult ? '✅ 성공' : '❌ 실패'}`)
  } catch (error) {
    console.log(`   오류: ${error.message}`)
  }
  
  // 2. TheSportsDB API 테스트
  console.log('💎 TheSportsDB API 테스트...')
  if (theSportsDBKey) {
    try {
      const theSportsDBAPI = new TheSportsDBPremiumAPI({ apiKey: theSportsDBKey })
      const tsResult = await theSportsDBAPI.testConnection()
      console.log(`   결과: ${tsResult ? '✅ 성공' : '❌ 실패'}`)
    } catch (error) {
      console.log(`   오류: ${error.message}`)
    }
  } else {
    console.log('   ⚠️ API 키가 설정되지 않음')
  }
  
  // 3. Highlightly API 테스트
  console.log('⚡ Highlightly API 테스트...')
  if (highlightlyKey) {
    try {
      const highlightlyAPI = new HighlightlyAPI({ apiKey: highlightlyKey })
      const hResult = await highlightlyAPI.testConnection()
      console.log(`   결과: ${hResult ? '✅ 성공' : '❌ 실패'}`)
    } catch (error) {
      console.log(`   오류: ${error.message}`)
      
      // 401 오류의 경우 추가 정보 제공
      if (error.message.includes('401')) {
        console.log('   🔍 401 오류 원인:')
        console.log('     - API 키가 잘못됨')
        console.log('     - API 키가 만료됨')
        console.log('     - API 사용량 한도 초과')
        console.log('     - API 키 권한 부족')
      }
    }
  } else {
    console.log('   ⚠️ API 키가 설정되지 않음')
  }
  
  console.log('')
  console.log('🎯 진단 결과 요약:')
  console.log('   - K리그 API는 항상 작동해야 함 (무료 공개 API)')
  console.log('   - TheSportsDB/Highlightly는 유료 API로 키가 필요함')
  console.log('   - GitHub Actions Secrets에서 API 키 확인 필요')
}

if (import.meta.main) {
  debugAPIConnections().catch(console.error)
}