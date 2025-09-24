/**
 * 🚨 긴급 K리그 공식 API 마이그레이션
 * 10월 2일 API-Football 구독 만료 대응
 * K리그 공식 웹사이트 API를 활용한 무료 데이터 솔루션
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createKLeagueAPI } from './lib/kleague-api.js'
import KLeagueMapper from './lib/kleague-mappers.js'

// Environment validation
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
}

console.log('🔍 환경 변수 확인:')
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ ${key}가 설정되지 않았습니다`)
    process.exit(1)
  }
  console.log(`✅ ${key}: ${value.substring(0, 20)}...`)
}

const supabase = createClient(
  requiredEnvVars.SUPABASE_URL!,
  requiredEnvVars.SUPABASE_SERVICE_ROLE!
)

const kLeagueAPI = createKLeagueAPI({
  rateLimit: { requests: 20, window: 60000 } // 안전한 속도 제한
})

interface ImportStats {
  leagues: { imported: number, errors: number }
  teams: { imported: number, errors: number }
  fixtures: { imported: number, errors: number }
  standings: { imported: number, errors: number }
  players: { imported: number, errors: number }
}

const stats: ImportStats = {
  leagues: { imported: 0, errors: 0 },
  teams: { imported: 0, errors: 0 },
  fixtures: { imported: 0, errors: 0 },
  standings: { imported: 0, errors: 0 },
  players: { imported: 0, errors: 0 }
}

/**
 * 리그 정보 가져오기 및 저장
 */
async function importLeagues(leagues: any[]): Promise<void> {
  console.log(`🏟️ ${leagues.length}개 리그 정보 저장 중...`)
  
  for (const league of leagues) {
    try {
      const { error } = await supabase
        .from('leagues')
        .upsert({
          id: league.id,
          name: league.name,
          country_name: league.country_name,
          logo_url: league.logo_url,
          season_year: league.season_year,
          created_at: league.created_at,
          updated_at: league.updated_at
        })

      if (error) {
        console.error(`❌ 리그 저장 실패 ${league.name}:`, error.message)
        stats.leagues.errors++
      } else {
        console.log(`✅ 리그 저장 완료: ${league.name}`)
        stats.leagues.imported++
      }
    } catch (error) {
      console.error(`❌ 리그 처리 중 오류:`, error)
      stats.leagues.errors++
    }
  }
}

/**
 * 팀 정보 저장
 */
async function importTeams(teams: any[]): Promise<void> {
  console.log(`👥 ${teams.length}개 팀 정보 저장 중...`)
  
  for (const team of teams) {
    try {
      const { error } = await supabase
        .from('teams')
        .upsert({
          id: team.id,
          name: team.name,
          code: team.code,
          logo_url: team.logo_url,
          league_id: team.league_id,
          season_year: team.season_year,
          country_name: team.country_name,
          data_source: team.data_source,
          created_at: team.created_at,
          updated_at: team.updated_at
        })

      if (error) {
        console.error(`❌ 팀 저장 실패 ${team.name}:`, error.message)
        stats.teams.errors++
      } else {
        console.log(`✅ 팀 저장 완료: ${team.name} (${team.id})`)
        stats.teams.imported++
      }
    } catch (error) {
      console.error(`❌ 팀 처리 중 오류:`, error)
      stats.teams.errors++
    }
  }
}

/**
 * 경기 일정/결과 저장
 */
async function importFixtures(fixtures: any[]): Promise<void> {
  console.log(`⚽ ${fixtures.length}개 경기 정보 저장 중...`)
  
  for (const fixture of fixtures) {
    try {
      const { error } = await supabase
        .from('fixtures')
        .upsert({
          id: fixture.id,
          home_team_id: fixture.home_team_id,
          away_team_id: fixture.away_team_id,
          league_id: fixture.league_id,
          season_year: fixture.season_year,
          match_date: fixture.match_date,
          status: fixture.status,
          home_score: fixture.home_score,
          away_score: fixture.away_score,
          venue: fixture.venue,
          round: fixture.round,
          created_at: fixture.created_at,
          updated_at: fixture.updated_at
        })

      if (error) {
        console.error(`❌ 경기 저장 실패 ${fixture.id}:`, error.message)
        stats.fixtures.errors++
      } else {
        const homeTeamName = await getTeamNameFromId(fixture.home_team_id)
        const awayTeamName = await getTeamNameFromId(fixture.away_team_id)
        console.log(`✅ 경기 저장 완료: ${homeTeamName} vs ${awayTeamName}`)
        stats.fixtures.imported++
      }
    } catch (error) {
      console.error(`❌ 경기 처리 중 오류:`, error)
      stats.fixtures.errors++
    }
  }
}

/**
 * 순위표 저장
 */
async function importStandings(standings: any[]): Promise<void> {
  console.log(`📊 ${standings.length}개 순위 정보 저장 중...`)
  
  for (const standing of standings) {
    try {
      const { error } = await supabase
        .from('standings')
        .upsert({
          team_id: standing.team_id,
          league_id: standing.league_id,
          season_year: standing.season_year,
          position: standing.position,
          played: standing.played,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          goals_for: standing.goals_for,
          goals_against: standing.goals_against,
          goal_difference: standing.goal_difference,
          points: standing.points,
          form: standing.form,
          created_at: standing.created_at,
          updated_at: standing.updated_at
        })

      if (error) {
        console.error(`❌ 순위 저장 실패 ${standing.team_id}:`, error.message)
        stats.standings.errors++
      } else {
        const teamName = await getTeamNameFromId(standing.team_id)
        console.log(`✅ 순위 저장 완료: ${teamName} (${standing.position}위)`)
        stats.standings.imported++
      }
    } catch (error) {
      console.error(`❌ 순위 처리 중 오류:`, error)
      stats.standings.errors++
    }
  }
}

/**
 * 선수 기록 저장
 */
async function importPlayers(players: any[]): Promise<void> {
  console.log(`👨‍⚽ ${players.length}명 선수 기록 저장 중...`)
  
  for (const player of players) {
    try {
      // 선수가 이미 있는지 확인하고 업데이트 또는 삽입
      const { data: existingPlayer, error: selectError } = await supabase
        .from('players')
        .select('*')
        .eq('name', player.name)
        .eq('team_id', player.team_id)
        .eq('season_year', player.season_year)
        .single()

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw selectError
      }

      const playerData = {
        name: player.name,
        team_id: player.team_id,
        league_id: player.league_id,
        season_year: player.season_year,
        back_number: player.back_number,
        goals: player.goals,
        assists: player.assists,
        clean_sheets: player.clean_sheets,
        position: player.position,
        updated_at: player.updated_at
      }

      let error
      if (existingPlayer) {
        // 기존 선수 정보 업데이트
        ({ error } = await supabase
          .from('players')
          .update({
            ...playerData,
            // 기존 기록과 새 기록 병합
            goals: player.goals || existingPlayer.goals,
            assists: player.assists || existingPlayer.assists,
            clean_sheets: player.clean_sheets || existingPlayer.clean_sheets,
          })
          .eq('id', existingPlayer.id))
      } else {
        // 새 선수 정보 삽입
        ({ error } = await supabase
          .from('players')
          .insert({
            ...playerData,
            created_at: player.created_at
          }))
      }

      if (error) {
        console.error(`❌ 선수 저장 실패 ${player.name}:`, error.message)
        stats.players.errors++
      } else {
        const teamName = await getTeamNameFromId(player.team_id)
        console.log(`✅ 선수 저장 완료: ${player.name} (${teamName})`)
        stats.players.imported++
      }
    } catch (error) {
      console.error(`❌ 선수 처리 중 오류:`, error)
      stats.players.errors++
    }
  }
}

/**
 * 팀 ID로부터 팀명 조회 (캐시된 데이터 활용)
 */
const teamNameCache: Record<string, string> = {}
async function getTeamNameFromId(teamId: string): Promise<string> {
  if (teamNameCache[teamId]) {
    return teamNameCache[teamId]
  }
  
  try {
    const teamName = await kLeagueAPI.getTeamNameById(teamId)
    if (teamName) {
      teamNameCache[teamId] = teamName
      return teamName
    }
  } catch (error) {
    // API 호출 실패시 데이터베이스에서 조회
  }
  
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()
    
    if (!error && data) {
      teamNameCache[teamId] = data.name
      return data.name
    }
  } catch (dbError) {
    console.warn(`팀 ID ${teamId}의 이름을 찾을 수 없습니다`)
  }
  
  return teamId
}

/**
 * K리그 API 연결 테스트
 */
async function testKLeagueConnection(): Promise<boolean> {
  console.log('🧪 K리그 API 연결 테스트...')
  
  try {
    const connected = await kLeagueAPI.testConnection()
    if (connected) {
      console.log('✅ K리그 공식 API 연결 성공!')
      return true
    } else {
      console.error('❌ K리그 API 연결됨, 하지만 데이터 없음')
      return false
    }
  } catch (error) {
    console.error('❌ K리그 API 연결 실패:', error)
    return false
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function main() {
  console.log('🚨 긴급 K리그 공식 API 마이그레이션 시작')
  console.log('⏰ API-Football 구독 만료: 2024년 10월 2일')
  console.log('🆓 무료 솔루션: K리그 공식 웹사이트 API')
  console.log('🇰🇷 데이터 소스: www.kleague.com\n')

  const startTime = Date.now()

  try {
    // 1. K리그 API 연결 테스트
    const apiConnected = await testKLeagueConnection()
    if (!apiConnected) {
      throw new Error('K리그 API 연결 테스트 실패')
    }

    // 2. K리그 종합 데이터 수집
    console.log('\n🚀 K리그 종합 데이터 수집 시작...')
    const rawData = await kLeagueAPI.getComprehensiveData()
    
    // 3. 데이터 변환 및 검증
    console.log('\n🔄 데이터 변환 및 표준화...')
    const standardData = KLeagueMapper.transformComprehensiveData(rawData)
    
    // 4. 데이터베이스 저장 (순서 중요 - 외래키 관계 유지)
    console.log('\n📥 데이터베이스 저장 시작...')
    
    await importLeagues(standardData.leagues)
    await importTeams(standardData.teams)
    await importFixtures(standardData.fixtures)
    await importStandings(standardData.standings)
    await importPlayers(standardData.players)

    // 5. 최종 검증
    console.log('\n🔍 최종 데이터 검증...')
    const { data: leagueCount } = await supabase
      .from('leagues')
      .select('id', { count: 'exact' })
      .eq('season_year', 2025)
    
    const { data: teamCount } = await supabase
      .from('teams')
      .select('id', { count: 'exact' })
      .eq('season_year', 2025)
      .eq('data_source', 'kleague')

    const { data: fixtureCount } = await supabase
      .from('fixtures')
      .select('id', { count: 'exact' })
      .eq('season_year', 2025)

    // 6. 리그별 통계 생성
    const leagueStats = KLeagueMapper.generateLeagueStats({
      teams: standardData.teams,
      fixtures: standardData.fixtures,
      standings: standardData.standings
    })

    console.log(`\n📊 마이그레이션 요약:`)
    console.log(`🏟️  리그: ${stats.leagues.imported}개 저장, ${stats.leagues.errors}개 오류`)
    console.log(`👥 팀: ${stats.teams.imported}개 저장, ${stats.teams.errors}개 오류`)
    console.log(`⚽ 경기: ${stats.fixtures.imported}개 저장, ${stats.fixtures.errors}개 오류`)
    console.log(`📊 순위: ${stats.standings.imported}개 저장, ${stats.standings.errors}개 오류`)
    console.log(`👨‍⚽ 선수: ${stats.players.imported}명 저장, ${stats.players.errors}개 오류`)

    console.log(`\n🔍 데이터베이스 검증:`)
    console.log(`   전체 리그: ${leagueCount?.length || 0}개`)
    console.log(`   K리그 팀: ${teamCount?.length || 0}개`)
    console.log(`   경기 수: ${fixtureCount?.length || 0}경기`)

    console.log(`\n📈 리그별 통계:`)
    console.log(`   K리그1: ${leagueStats.league1.teams}팀, ${leagueStats.league1.completed_matches}/${leagueStats.league1.fixtures} 경기 완료`)
    console.log(`   K리그2: ${leagueStats.league2.teams}팀, ${leagueStats.league2.completed_matches}/${leagueStats.league2.fixtures} 경기 완료`)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n⏱️  마이그레이션 완료 시간: ${duration}초`)
    
    const totalErrors = stats.leagues.errors + stats.teams.errors + stats.fixtures.errors + stats.standings.errors + stats.players.errors
    
    if (totalErrors === 0) {
      console.log('🎉 긴급 K리그 마이그레이션 성공!')
      console.log('✅ API-Football 대체 완료 - 10월 2일 준비 완료')
      console.log('🆓 무료 K리그 공식 데이터 파이프라인 구축 완료')
    } else {
      console.log(`⚠️  마이그레이션 완료 (오류 ${totalErrors}개) - 수동 검토 권장`)
    }

    // 성공 시 API 사용법 가이드 출력
    console.log('\n📋 K리그 API 사용 가이드:')
    console.log('   - 최신 경기 결과: kLeagueAPI.getRecentMatches()')
    console.log('   - 팀 순위: kLeagueAPI.getTeamRankings()')
    console.log('   - 선수 기록: kLeagueAPI.getPlayerRecords()')
    console.log('   - 종합 데이터: kLeagueAPI.getComprehensiveData()')
    console.log('\n🔗 데이터 소스: https://www.kleague.com')

  } catch (error) {
    console.error('💥 긴급 K리그 마이그레이션 실패:', error)
    console.error('\n🚨 조치 필요:')
    console.error('1. K리그 웹사이트 접근 가능 여부 확인')
    console.error('2. 네트워크 연결 상태 점검')
    console.error('3. Supabase 연결 및 권한 확인')
    console.error('4. 필요시 API-Football 구독 연장 고려')
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}