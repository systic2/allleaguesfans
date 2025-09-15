// quick-fixtures-import.ts
// 경기 데이터만 빠르게 임포트

import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet } from './lib/api-football'

const K1_LEAGUE_ID = 292
const CURRENT_SEASON = 2025

async function quickFixturesImport() {
  console.log('⚡ 빠른 경기 데이터 임포트')
  console.log('='.repeat(50))
  
  try {
    // 완료된 경기만 가져오기
    console.log('1️⃣ 완료된 경기 조회 중...')
    const fixturesResponse = await apiGet('fixtures', { 
      league: K1_LEAGUE_ID, 
      season: CURRENT_SEASON,
      status: 'FT'
    })
    
    const fixtures = fixturesResponse.response || []
    console.log(`   ✅ 완료된 경기: ${fixtures.length}개`)
    
    let successCount = 0
    let eventsCount = 0
    
    console.log('\\n2️⃣ 경기 데이터 임포트 중...')
    
    for (let i = 0; i < Math.min(fixtures.length, 30); i++) { // 최대 30개만
      const fixture = fixtures[i]
      
      try {
        console.log(`   처리 중 (${i + 1}/${Math.min(fixtures.length, 30)}): Fixture ${fixture.fixture.id}`)
        
        // venue_id는 null로 설정 (외래키 문제 방지)
        const fixtureRecord = {
          id: Number(fixture.fixture.id),
          referee: fixture.fixture.referee,
          date_utc: fixture.fixture.date,
          
          league_id: K1_LEAGUE_ID,
          season_year: CURRENT_SEASON,
          round: fixture.league?.round,
          
          home_team_id: Number(fixture.teams.home.id),
          away_team_id: Number(fixture.teams.away.id),
          
          venue_id: null, // 일단 null로 설정
          
          status_long: fixture.fixture.status?.long,
          status_short: fixture.fixture.status?.short,
          elapsed_minutes: fixture.fixture.status?.elapsed,
          
          home_goals: fixture.goals?.home,
          away_goals: fixture.goals?.away,
          
          updated_at: new Date().toISOString()
        }
        
        const { error: fixtureError } = await supa.from('fixtures').upsert([fixtureRecord], { onConflict: 'id' })
        
        if (fixtureError) {
          console.error(`   ❌ 경기 ${fixture.fixture.id} 실패: ${fixtureError.message}`)
          continue
        }
        
        successCount++
        
        // 이벤트 데이터 가져오기
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
              eventsCount += eventRecords.length
              console.log(`   ✅ ${eventRecords.length}개 이벤트 추가`)
            }
          }
          
        } catch (eventsError) {
          console.warn(`   ⚠️ 이벤트 처리 실패`)
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`   ❌ Fixture ${fixture.fixture.id} 처리 실패:`, error)
      }
    }
    
    console.log('\\n📊 결과:')
    console.log(`   임포트된 경기: ${successCount}개`)
    console.log(`   임포트된 이벤트: ${eventsCount}개`)
    
    // 데이터베이스 확인
    const { count: totalFixtures } = await supa
      .from('fixtures')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalEvents } = await supa
      .from('events')
      .select('*', { count: 'exact', head: true })
      
    console.log(`\\n📈 데이터베이스 현재 상태:`)
    console.log(`   총 경기: ${totalFixtures}개`)
    console.log(`   총 이벤트: ${totalEvents}개`)
    
  } catch (error) {
    console.error('❌ 빠른 임포트 실패:', error)
  }
}

async function main() {
  await quickFixturesImport()
}

main().catch(console.error)