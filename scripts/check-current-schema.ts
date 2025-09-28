// check-current-schema.ts
// 현재 데이터베이스 스키마 확인

import { config } from 'dotenv'
import { supa } from './lib/supabase.ts'

config()

async function checkCurrentSchema() {
  console.log('🔍 현재 데이터베이스 스키마 확인...')
  
  const tables = ['leagues', 'teams', 'players', 'fixtures', 'standings']
  
  for (const tableName of tables) {
    console.log(`\n📋 ${tableName} 테이블 확인...`)
    
    try {
      // 테이블 존재 여부 및 샘플 데이터 확인
      const { data, error, count } = await supa
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(1)
      
      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`)
      } else {
        console.log(`✅ ${tableName}: ${count}개 레코드 존재`)
        if (data && data.length > 0) {
          console.log(`   샘플 필드: ${Object.keys(data[0]).join(', ')}`)
        }
      }
    } catch (err) {
      console.log(`💥 ${tableName}: ${err}`)
    }
  }
  
  // 특별히 leagues 테이블의 구조 확인
  console.log('\n🏆 leagues 테이블 상세 확인...')
  try {
    const { data } = await supa
      .from('leagues')
      .select('*')
      .limit(1)
    
    if (data && data.length > 0) {
      console.log('현재 leagues 필드:', Object.keys(data[0]))
      console.log('샘플 데이터:', data[0])
    }
  } catch (err) {
    console.log('leagues 테이블 확인 실패:', err)
  }
  
  // teams 테이블 구조 확인
  console.log('\n⚽ teams 테이블 상세 확인...')
  try {
    const { data } = await supa
      .from('teams')
      .select('*')
      .limit(1)
    
    if (data && data.length > 0) {
      console.log('현재 teams 필드:', Object.keys(data[0]))
      console.log('샘플 데이터:', data[0])
    }
  } catch (err) {
    console.log('teams 테이블 확인 실패:', err)
  }
}

checkCurrentSchema().catch(console.error)