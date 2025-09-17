// fix-event-import-schema-mismatch.ts
// 스키마 불일치로 인한 이벤트 임포트 문제 해결

import 'dotenv/config'
import { supa } from './lib/supabase'
import { apiGet } from './lib/api-football'

const K1_LEAGUE_ID = 292
const K2_LEAGUE_ID = 293
const CURRENT_SEASON = 2025

interface APIFootballEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist?: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

console.log('🔧 이벤트 임포트 스키마 불일치 문제 해결')
console.log('='.repeat(60))

async function fixEventImport() {
  const startTime = Date.now()
  let totalEventsImported = 0

  try {
    // 1. 완료된 경기 목록 가져오기
    console.log('\n📋 완료된 경기 목록 조회...')
    const { data: completedFixtures, error: fixtureError } = await supa
      .from('fixtures')
      .select('id, league_id, season_year, home_team_id, away_team_id')
      .in('league_id', [K1_LEAGUE_ID, K2_LEAGUE_ID])
      .eq('season_year', CURRENT_SEASON)
      .not('home_goals', 'is', null)
      .not('away_goals', 'is', null)
      .limit(20) // 테스트용으로 제한

    if (fixtureError) {
      console.error('❌ 경기 목록 조회 실패:', fixtureError)
      return
    }

    console.log(`📊 완료된 경기: ${completedFixtures?.length || 0}개`)

    if (!completedFixtures || completedFixtures.length === 0) {
      console.log('⚠️ 완료된 경기가 없습니다.')
      return
    }

    // 2. 각 경기의 이벤트 임포트
    for (const fixture of completedFixtures) {
      console.log(`\n🏟️ 경기 ${fixture.id} 이벤트 처리...`)

      try {
        // 기존 이벤트 확인
        const { count: existingEvents } = await supa
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('fixture_id', fixture.id)

        if (existingEvents && existingEvents > 0) {
          console.log(`  ⏭️ 이미 ${existingEvents}개 이벤트 존재, 스킵`)
          continue
        }

        // API-Football에서 이벤트 가져오기
        const eventsResponse = await apiGet('fixtures/events', { fixture: fixture.id })
        const events: APIFootballEvent[] = eventsResponse.response || []

        console.log(`  📊 API에서 ${events.length}개 이벤트 조회`)

        if (events.length === 0) {
          console.log(`  ⚠️ 이벤트 데이터 없음`)
          continue
        }

        // 3. 이벤트 데이터 변환 (신규 스키마에 맞춤)
        const eventRecords = []
        for (const event of events) {
          // player_id가 있는 이벤트만 임포트
          if (event.player?.id) {
            eventRecords.push({
              fixture_id: fixture.id,
              team_id: event.team.id,
              player_id: event.player.id,
              assist_player_id: event.assist?.id || null,
              time_elapsed: event.time.elapsed,
              time_extra: event.time.extra,
              type: event.type, // 신규 스키마: event_type → type
              detail: event.detail, // 신규 스키마: event_detail → detail
              comments: event.comments
            })
          }
        }

        // 4. 데이터베이스에 삽입
        if (eventRecords.length > 0) {
          const { error: insertError } = await supa
            .from('events')
            .insert(eventRecords)

          if (insertError) {
            console.error(`  ❌ 이벤트 삽입 실패:`, insertError.message)
            
            // 상세한 오류 분석
            if (insertError.message.includes('foreign key')) {
              console.log(`  🔍 외래키 오류 - team_id: ${eventRecords[0].team_id}, player_id: ${eventRecords[0].player_id}`)
              
              // 팀 존재 여부 확인
              const { data: teamCheck } = await supa
                .from('teams')
                .select('id')
                .eq('id', eventRecords[0].team_id)
                .eq('season_year', CURRENT_SEASON)
                .maybeSingle()
              
              if (!teamCheck) {
                console.log(`  ⚠️ 팀 ${eventRecords[0].team_id} (시즌 ${CURRENT_SEASON}) 존재하지 않음`)
              }

              // 선수 존재 여부 확인
              const { data: playerCheck } = await supa
                .from('players')
                .select('id')
                .eq('id', eventRecords[0].player_id)
                .eq('season_year', CURRENT_SEASON)
                .maybeSingle()
              
              if (!playerCheck) {
                console.log(`  ⚠️ 선수 ${eventRecords[0].player_id} (시즌 ${CURRENT_SEASON}) 존재하지 않음`)
              }
            }
            
          } else {
            totalEventsImported += eventRecords.length
            console.log(`  ✅ ${eventRecords.length}개 이벤트 임포트 완료`)
            
            // 골 이벤트 수 확인
            const goals = eventRecords.filter(e => e.type === 'Goal').length
            if (goals > 0) {
              console.log(`    ⚽ 골 이벤트: ${goals}개`)
            }
          }
        }

        // API 호출 간격 (Rate Limit 방지)
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`  ❌ 경기 ${fixture.id} 처리 실패:`, error)
      }
    }

    // 5. 결과 요약
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)

    console.log('\n' + '='.repeat(60))
    console.log('🎉 이벤트 임포트 완료!')
    console.log(`⏱️ 소요 시간: ${duration}초`)
    console.log(`📊 총 임포트된 이벤트: ${totalEventsImported}개`)

    // 전체 이벤트 수 확인
    const { count: totalEvents } = await supa
      .from('events')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 데이터베이스 총 이벤트: ${totalEvents}개`)

    // 골 이벤트 수 확인
    const { count: goalEvents } = await supa
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Goal')

    console.log(`⚽ 총 골 이벤트: ${goalEvents}개`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ 전체 프로세스 실패:', error)
  }
}

async function main() {
  await fixEventImport()
}

main().catch(console.error)

export { fixEventImport }