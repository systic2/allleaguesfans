// analyze-team-mapping-issue.ts - 잘못된 팀 매칭 분석
import 'dotenv/config'
import { supa } from './scripts/lib/supabase.ts';

async function analyzeTeamMappingIssue() {
  console.log('🔍 잘못된 팀 매칭 분석...')
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 현재 잘못 매핑된 오늘 경기들 조회
    const { data: currentFixtures, error: currentError } = await supa
      .from('fixtures')
      .select(`
        id, venue_name, 
        home_team_id, away_team_id,
        home_team:teams!fixtures_home_team_id_fkey(name),
        away_team:teams!fixtures_away_team_id_fkey(name)
      `)
      .gte('match_date', today)
      .lt('match_date', `${today}T23:59:59`)
      .order('match_date')

    if (currentError) {
      console.error('현재 fixtures 조회 오류:', currentError)
      return
    }

    console.log('❌ 현재 잘못된 매칭:')
    currentFixtures?.forEach((fixture, index) => {
      const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
      const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
      console.log(`   ${index + 1}. ${fixture.venue_name}: ${homeTeam?.name} vs ${awayTeam?.name}`)
    })

    console.log('\n✅ 실제 경기 일정 (사용자 제공):')
    console.log('   1. 수원 FC vs 제주 SK FC')
    console.log('   2. FC 안양 vs 광주 FC')
    console.log('   3. 경남 FC vs 안산')
    console.log('   4. 화성 FC vs 부산 아이파크')
    console.log('   5. 김포 vs 성남')
    console.log('   6. 서울이랜드 vs 인천유나이티드')

    // 실제 팀 이름들이 teams 테이블에 어떻게 저장되어 있는지 확인
    console.log('\n🔍 teams 테이블에서 관련 팀들 검색:')
    const teamSearchTerms = ['수원', '제주', '안양', '광주', '경남', '안산', '화성', '부산', '김포', '성남', '서울', '인천']
    
    for (const term of teamSearchTerms) {
      const { data: teams, error: teamsError } = await supa
        .from('teams')
        .select('id, name, league_id')
        .ilike('name', `%${term}%`)

      if (!teamsError && teams && teams.length > 0) {
        console.log(`   "${term}" 관련 팀들:`)
        teams.forEach(team => {
          console.log(`     - ID ${team.id}: ${team.name} (League ${team.league_id})`)
        })
      }
    }

  } catch (error) {
    console.error('💥 분석 오류:', error)
  }
}

analyzeTeamMappingIssue().catch(console.error)