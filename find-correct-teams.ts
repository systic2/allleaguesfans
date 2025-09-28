// find-correct-teams.ts - 실제 경기 일정에 맞는 팀 ID 찾기
import 'dotenv/config'
import { supa } from './scripts/lib/supabase.ts';

async function findCorrectTeams() {
  console.log('🔍 실제 경기 일정에 맞는 팀 ID 찾기...')
  
  try {
    // 모든 팀 정보를 가져와서 매칭
    const { data: allTeams, error: teamsError } = await supa
      .from('teams')
      .select('id, name, league_id')
      .order('name')

    if (teamsError) {
      console.error('팀 조회 오류:', teamsError)
      return
    }

    console.log('📊 전체 팀 목록:')
    allTeams?.forEach(team => {
      console.log(`   ID ${team.id}: ${team.name} (League ${team.league_id})`)
    })

    // 실제 경기 일정에 맞는 팀 ID 찾기
    const actualMatches = [
      { home: '수원 FC', away: '제주 SK FC' },
      { home: 'FC 안양', away: '광주 FC' },
      { home: '경남 FC', away: '안산' },
      { home: '화성 FC', away: '부산 아이파크' },
      { home: '김포', away: '성남' },
      { home: '서울이랜드', away: '인천유나이티드' }
    ]

    console.log('\n🎯 실제 경기 매칭을 위한 팀 ID 찾기:')
    const teamMappings: Array<{homeId: number, awayId: number, match: string}> = []

    for (const match of actualMatches) {
      // 홈팀 찾기
      const homeTeam = allTeams?.find(team => 
        team.name.includes('Suwon') || team.name.includes('수원') ||
        team.name.includes('Anyang') || team.name.includes('안양') ||
        team.name.includes('GYEONGNAM') || team.name.includes('경남') ||
        team.name.includes('Bucheon') || team.name.includes('화성') ||
        team.name.includes('GIMPO') || team.name.includes('김포') ||
        team.name.includes('Seoul E') || team.name.includes('서울')
      )

      // 원정팀 찾기 
      const awayTeam = allTeams?.find(team =>
        team.name.includes('Jeju') || team.name.includes('제주') ||
        team.name.includes('Gwangju') || team.name.includes('광주') ||
        team.name.includes('ANSAN') || team.name.includes('안산') ||
        team.name.includes('Busan') || team.name.includes('부산') ||
        team.name.includes('SEONGNAM') || team.name.includes('성남') ||
        team.name.includes('Incheon') || team.name.includes('인천')
      )

      console.log(`\n   "${match.home} vs ${match.away}":`)
      if (homeTeam) {
        console.log(`     홈팀: ID ${homeTeam.id} - ${homeTeam.name}`)
      } else {
        console.log(`     ❌ 홈팀 "${match.home}" 찾을 수 없음`)
      }

      if (awayTeam) {
        console.log(`     원정팀: ID ${awayTeam.id} - ${awayTeam.name}`)
      } else {
        console.log(`     ❌ 원정팀 "${match.away}" 찾을 수 없음`)
      }

      if (homeTeam && awayTeam) {
        teamMappings.push({
          homeId: homeTeam.id,
          awayId: awayTeam.id,
          match: `${match.home} vs ${match.away}`
        })
      }
    }

    console.log('\n✅ 찾은 팀 매핑:')
    teamMappings.forEach((mapping, index) => {
      console.log(`   ${index + 1}. ${mapping.match}: 홈팀 ${mapping.homeId} vs 원정팀 ${mapping.awayId}`)
    })

  } catch (error) {
    console.error('💥 실행 오류:', error)
  }
}

findCorrectTeams().catch(console.error)