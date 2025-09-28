// fix-correct-teams.ts - 실제 경기 일정으로 정확히 수정
import 'dotenv/config'
import { supa } from './scripts/lib/supabase.ts';

async function fixCorrectTeams() {
  console.log('🔧 실제 경기 일정으로 정확한 팀 매칭 수정...')
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 정확한 팀 매핑 (팀 목록 기반)
    const correctMatches = [
      { home: 11, away: 8, description: '수원 FC vs 제주 SK FC' },      // Suwon FC vs Jeju SK
      { home: 10, away: 3, description: 'FC 안양 vs 광주 FC' },         // Anyang vs Gwangju FC
      { home: 16, away: 20013, description: '경남 FC vs 안산' },        // Gyeongnam FC vs ANSAN
      { home: 25, away: 12, description: '화성 FC vs 부산 아이파크' },    // Hwaseong FC vs Busan IPark
      { home: 22, away: 14, description: '김포 vs 성남' },             // Gimpo FC vs Seongnam FC
      { home: 21, away: 13, description: '서울이랜드 vs 인천유나이티드' }  // Seoul E-Land vs Incheon United
    ]

    // 오늘 경기들 조회 (순서대로)
    const { data: todaysFixtures, error: todaysError } = await supa
      .from('fixtures')
      .select('id, venue_name')
      .gte('match_date', today)
      .lt('match_date', `${today}T23:59:59`)
      .order('match_date')

    if (todaysError) {
      console.error('오늘 fixtures 조회 오류:', todaysError)
      return
    }

    console.log(`📊 수정할 오늘 경기: ${todaysFixtures?.length || 0}개`)

    // 각 fixture를 정확한 팀으로 업데이트
    for (let i = 0; i < Math.min(todaysFixtures?.length || 0, correctMatches.length); i++) {
      const fixture = todaysFixtures![i]
      const correctMatch = correctMatches[i]

      const { error: updateError } = await supa
        .from('fixtures')
        .update({
          home_team_id: correctMatch.home,
          away_team_id: correctMatch.away
        })
        .eq('id', fixture.id)

      if (updateError) {
        console.error(`Fixture ${fixture.id} 업데이트 오류:`, updateError)
      } else {
        console.log(`✅ Fixture ${fixture.id} (${fixture.venue_name}): ${correctMatch.description}`)
        console.log(`   홈팀 ID: ${correctMatch.home}, 원정팀 ID: ${correctMatch.away}`)
      }
    }

    // 결과 확인
    const { data: verifyResult, error: verifyError } = await supa
      .from('fixtures')
      .select(`
        id, venue_name,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name)
      `)
      .gte('match_date', today)
      .lt('match_date', `${today}T23:59:59`)
      .order('match_date')

    if (verifyError) {
      console.error('결과 확인 오류:', verifyError)
    } else {
      console.log('\n🎉 수정 완료! 현재 오늘 경기:')
      verifyResult?.forEach((fixture, index) => {
        const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
        const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
        console.log(`   ${index + 1}. ${fixture.venue_name}: ${homeTeam?.name} vs ${awayTeam?.name}`)
      })
    }

  } catch (error) {
    console.error('💥 실행 오류:', error)
  }
}

fixCorrectTeams().catch(console.error)