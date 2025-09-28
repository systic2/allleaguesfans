// sync-kleague-final.ts
// 실제 현재 스키마 구조에 맞춘 최종 K League 데이터 동기화

import { supa } from './lib/supabase.js'
import { KLeagueAPI } from './lib/kleague-api.ts'

async function syncKLeagueFinal() {
  console.log('🚀 K League 최종 데이터 동기화 시작...')
  console.log('📅 시작 시간:', new Date().toLocaleString('ko-KR'))
  
  const kLeagueAPI = new KLeagueAPI()
  let totalSynced = 0
  let totalErrors = 0
  
  try {
    // 1. K League API 연결 테스트
    console.log('\n🧪 K League API 연결 테스트...')
    const isConnected = await kLeagueAPI.testConnection()
    if (!isConnected) {
      throw new Error('K League API 연결 실패')
    }
    
    // 2. 리그 정보 동기화 (새 ID 시스템)
    console.log('\n🏆 K League 리그 정보 동기화...')
    const leagues = [
      { id: 4001, name: 'K리그1', kleague_id: 1 },
      { id: 4002, name: 'K리그2', kleague_id: 2 }
    ]
    
    for (const league of leagues) {
      try {
        const { error } = await supa.from('leagues').upsert({
          id: league.id,
          name: league.name,
          type: 'League',
          season_year: 2025  // NOT NULL 제약 조건 만족
        }, { onConflict: 'id' })
        
        if (error) {
          console.log(`⚠️ ${league.name}: ${error.message}`)
          totalErrors++
        } else {
          console.log(`✅ ${league.name} 리그 동기화 완료`)
          totalSynced++
        }
      } catch (err) {
        console.log(`❌ ${league.name}: ${err}`)
        totalErrors++
      }
    }
    
    // 3. K League 순위 데이터 동기화
    console.log('\n📊 K League 순위 데이터 동기화...')
    try {
      const rankings = await kLeagueAPI.getTeamRankings()
      
      // K리그1 순위
      if (rankings.league1?.length > 0) {
        console.log(`   K리그1 순위: ${rankings.league1.length}개 팀`)
        for (const [index, team] of rankings.league1.entries()) {
          try {
            // 팀 정보 먼저 동기화 (새 ID 시스템)
            const { error: teamError } = await supa.from('teams').upsert({
              id: parseInt(team.teamId) || (10000 + index),
              name: team.teamName,
              league_id: 4001,  // 새 K리그1 ID
              season_year: 2025
            }, { onConflict: 'id' })
            
            if (teamError) {
              console.log(`   ⚠️ 팀 ${team.teamName}: ${teamError.message}`)
              totalErrors++
            } else {
              console.log(`   ✅ 팀 ${team.teamName} 동기화`)
              totalSynced++
            }
            
            // 순위 정보 동기화
            const { error: standingError } = await supa.from('standings').upsert({
              league_id: 4001,  // 새 K리그1 ID
              team_id: parseInt(team.teamId) || (10000 + index),
              season_year: 2025,
              position: team.rank,
              played: team.winCnt + team.tieCnt + team.lossCnt,
              won: team.winCnt,
              drawn: team.tieCnt,
              lost: team.lossCnt,
              goals_for: team.goalCnt,
              goals_against: team.loseGoalCnt,
              goal_difference: team.goalCnt - team.loseGoalCnt,
              points: team.gainPoint
            }, { onConflict: 'league_id,team_id,season_year' })
            
            if (standingError) {
              console.log(`   ⚠️ 순위 ${team.teamName}: ${standingError.message}`)
              totalErrors++
            } else {
              console.log(`   ✅ 순위 ${team.teamName} 동기화`)
              totalSynced++
            }
          } catch (err) {
            console.log(`   ❌ ${team.teamName}: ${err}`)
            totalErrors++
          }
        }
      }
      
      // K리그2 순위
      if (rankings.league2?.length > 0) {
        console.log(`   K리그2 순위: ${rankings.league2.length}개 팀`)
        for (const [index, team] of rankings.league2.entries()) {
          try {
            const { error: teamError } = await supa.from('teams').upsert({
              id: parseInt(team.teamId) || (20000 + index),
              name: team.teamName,
              league_id: 4002,  // 새 K리그2 ID
              season_year: 2025
            }, { onConflict: 'id' })
            
            const { error: standingError } = await supa.from('standings').upsert({
              league_id: 4002,  // 새 K리그2 ID
              team_id: parseInt(team.teamId) || (20000 + index),
              season_year: 2025,
              position: team.rank,
              played: team.winCnt + team.tieCnt + team.lossCnt,
              won: team.winCnt,
              drawn: team.tieCnt,
              lost: team.lossCnt,
              goals_for: team.goalCnt,
              goals_against: team.loseGoalCnt,
              goal_difference: team.goalCnt - team.loseGoalCnt,
              points: team.gainPoint
            }, { onConflict: 'league_id,team_id,season_year' })
            
            if (!teamError && !standingError) {
              totalSynced += 2
              console.log(`   ✅ ${team.teamName} 완료`)
            } else {
              totalErrors++
            }
          } catch (err) {
            totalErrors++
          }
        }
      }
      
    } catch (err) {
      console.log(`❌ 순위 데이터 동기화 실패: ${err}`)
      totalErrors++
    }
    
    // 4. 최근 경기 결과 동기화 (away_goals 컬럼 없이)
    console.log('\n⚽ K League 최근 경기 결과 동기화...')
    try {
      const matches = await kLeagueAPI.getRecentMatches()
      
      if (matches.all?.length > 0) {
        console.log(`   최근 경기: ${matches.all.length}개`)
        
        for (const [index, match] of matches.all.slice(0, 10).entries()) {
          try {
            // K League API IDs (1, 2) → Database IDs (4001, 4002) 매핑
            const mappedLeagueId = match.leagueId === 1 ? 4001 : 
                                  match.leagueId === 2 ? 4002 : null
            
            if (!mappedLeagueId) {
              console.log(`   ⚠️ 경기 ${index + 1}: Unknown league ID ${match.leagueId}`)
              totalErrors++
              continue
            }
            
            const { error } = await supa.from('fixtures').insert({
              league_id: mappedLeagueId,
              season_year: match.year,
              round: match.roundId,
              match_date: new Date(`${match.gameDate} ${match.gameTime}`),
              status: match.endYn === 'Y' ? 'FT' : 'NS',
              home_score: match.homeGoal,
              away_score: match.awayGoal,
              venue_name: match.fieldName
            })
            
            if (error && !error.message.includes('duplicate')) {
              console.log(`   ⚠️ 경기 ${index + 1}: ${error.message}`)
              totalErrors++
            } else {
              console.log(`   ✅ 경기 ${index + 1} 동기화`)
              totalSynced++
            }
          } catch (err) {
            console.log(`   ❌ 경기 ${index + 1}: ${err}`)
            totalErrors++
          }
        }
      }
    } catch (err) {
      console.log(`❌ 경기 데이터 동기화 실패: ${err}`)
      totalErrors++
    }
    
    // 5. 동기화 결과 요약
    console.log('\n' + '='.repeat(60))
    console.log('📊 K League 최종 데이터 동기화 완료!')
    console.log('='.repeat(60))
    console.log(`📅 완료 시간: ${new Date().toLocaleString('ko-KR')}`)
    console.log(`✅ 성공: ${totalSynced}개`)
    console.log(`❌ 오류: ${totalErrors}개`)
    console.log(`📈 성공률: ${totalSynced > 0 ? Math.round((totalSynced / (totalSynced + totalErrors)) * 100) : 0}%`)
    
    // 6. 동기화된 데이터 확인
    console.log('\n🔍 동기화된 데이터 확인...')
    
    try {
      const [leagueResult, teamResult, standingResult, fixtureResult] = await Promise.all([
        supa.from('leagues').select('*'),
        supa.from('teams').select('*'),
        supa.from('standings').select('*'),
        supa.from('fixtures').select('*')
      ])
      
      console.log(`📋 리그: ${leagueResult.data?.length || 0}개`)
      console.log(`⚽ 팀: ${teamResult.data?.length || 0}개`)
      console.log(`📊 순위: ${standingResult.data?.length || 0}개`)
      console.log(`🏟️ 경기: ${fixtureResult.data?.length || 0}개`)
      
      // 샘플 데이터 표시
      if (standingResult.data && standingResult.data.length > 0) {
        console.log('\n🏆 K리그1 상위 5팀:')
        const k1standings = standingResult.data
          .filter(s => s.league_id === 4001)
          .sort((a, b) => a.position - b.position)
          .slice(0, 5)
          
        k1standings.forEach((standing) => {
          const teamData = teamResult.data?.find(t => t.id === standing.team_id)
          console.log(`   ${standing.position}. ${teamData?.name || '팀명 없음'} - ${standing.points}점 (${standing.won}승 ${standing.drawn}무 ${standing.lost}패)`)
        })
      }
      
      if (leagueResult.data && leagueResult.data.length > 0) {
        console.log('\n🏆 동기화된 리그:')
        leagueResult.data.forEach(league => {
          console.log(`   ${league.id}: ${league.name} (${league.season_year}시즌)`)
        })
      }
      
    } catch (err) {
      console.log('⚠️ 데이터 확인 중 오류:', err)
    }
    
    if (totalSynced > totalErrors) {
      console.log('\n🎉 K League 데이터 동기화가 성공적으로 완료되었습니다!')
      console.log('✨ 이제 K League 공식 데이터를 사용합니다!')
      console.log('📊 데이터 품질이 크게 향상되었습니다!')
    } else if (totalSynced > 0) {
      console.log('\n⚠️ 부분적으로 성공했습니다. 일부 데이터가 동기화되었습니다.')
    } else {
      console.log('\n❌ 동기화에 실패했습니다. 스키마 구조를 다시 확인해주세요.')
    }
    
  } catch (error) {
    console.error('\n💥 K League 데이터 동기화 실패:', error)
    process.exit(1)
  }
}

syncKLeagueFinal().catch(console.error)