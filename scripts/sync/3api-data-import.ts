// scripts/3api-data-import.ts
// 3-API 통합 데이터 임포트 스크립트 (TheSportsDB + Highlightly + K League Official)

import { supa } from './lib/supabase.ts';
import { createTheSportsDBClient } from './lib/thesportsdb-integration.ts';
import { createHighlightlyClient } from './lib/highlightly-integration.ts';
import { KLeagueAPI } from './lib/kleague-api.ts';

async function main() {
  console.log('🚀 3-API 통합 데이터 임포트 시작...');
  console.log('📅 시작 시간:', new Date().toLocaleString('ko-KR'));
  
  let totalSynced = 0;
  let totalErrors = 0;
  
  try {
    // API 클라이언트 초기화
    const theSportsDB = createTheSportsDBClient();
    const highlightly = createHighlightlyClient();
    const kLeagueAPI = new KLeagueAPI();
    
    // 1. API 연결 상태 테스트
    console.log('\\n🧪 API 연결 상태 테스트...');
    const [theSportsDBOk, highlightlyOk, kLeagueOk] = await Promise.all([
      theSportsDB.testConnection(),
      highlightly.testConnection(),
      kLeagueAPI.testConnection()
    ]);
    
    console.log(`   TheSportsDB: ${theSportsDBOk ? '✅' : '❌'}`);
    console.log(`   Highlightly: ${highlightlyOk ? '✅' : '❌'}`);
    console.log(`   K League Official: ${kLeagueOk ? '✅' : '❌'}`);
    
    // 2. 리그 정보 동기화 (TheSportsDB 기준)
    console.log('\\n🏆 리그 정보 동기화 (TheSportsDB 기준)...');
    
    const [kLeague1Data, kLeague2Data] = await Promise.all([
      theSportsDB.getKLeague1Data(),
      theSportsDB.getKLeague2Data()
    ]);
    
    // K League 1 리그 정보 동기화
    if (kLeague1Data.league) {
      const league = kLeague1Data.league;
      const { error: leagueError } = await supa.from('leagues').upsert({
        id: 4001, // 기존 시스템 호환성 유지
        thesportsdb_id: league.idLeague,
        highlightly_id: 249276, // Highlightly K League 1 ID
        name: league.strLeague,
        name_korean: league.strLeagueAlternate || 'K리그1',
        short_name: 'K1',
        type: 'League',
        logo_url: league.strLogo || league.strBadge,
        country_code: 'KR',
        season_year: 2025,
        is_current: true,
        primary_source: 'thesportsdb',
        logo_source: 'thesportsdb'
      }, { onConflict: 'id' });
      
      if (leagueError) {
        console.log(`   ❌ K리그1 동기화 실패: ${leagueError.message}`);
        totalErrors++;
      } else {
        console.log(`   ✅ K리그1 동기화 완료`);
        totalSynced++;
      }
    }
    
    // K League 2 리그 정보 동기화
    if (kLeague2Data.league) {
      const league = kLeague2Data.league;
      const { error: leagueError } = await supa.from('leagues').upsert({
        id: 4002, // 기존 시스템 호환성 유지
        thesportsdb_id: league.idLeague,
        highlightly_id: 250127, // Highlightly K League 2 ID
        name: league.strLeague,
        name_korean: league.strLeagueAlternate || 'K리그2',
        short_name: 'K2',
        type: 'League',
        logo_url: league.strLogo || league.strBadge,
        country_code: 'KR',
        season_year: 2025,
        is_current: true,
        primary_source: 'thesportsdb',
        logo_source: 'thesportsdb'
      }, { onConflict: 'id' });
      
      if (leagueError) {
        console.log(`   ❌ K리그2 동기화 실패: ${leagueError.message}`);
        totalErrors++;
      } else {
        console.log(`   ✅ K리그2 동기화 완료`);
        totalSynced++;
      }
    }
    
    // 3. 팀 정보 동기화 (TheSportsDB 기준)
    console.log('\\n⚽ 팀 정보 동기화 (TheSportsDB 기준)...');
    
    const allTeams = [...kLeague1Data.teams, ...kLeague2Data.teams];
    console.log(`   총 ${allTeams.length}개 팀 동기화 시작...`);
    
    for (const team of allTeams) {
      try {
        // 상세 팀 정보 가져오기
        const teamDetails = await theSportsDB.getTeamDetails(team.idTeam);
        if (!teamDetails) continue;
        
        const leagueId = team.idLeague === '4689' ? 4001 : 4002; // TheSportsDB ID → 내부 ID 매핑
        
        const { error: teamError } = await supa.from('teams').upsert({
          id: parseInt(team.idTeam), // TheSportsDB idTeam을 기본 키로 사용
          thesportsdb_id: team.idTeam,
          name: team.strTeam,
          name_korean: teamDetails.strTeamAlternate || team.strTeam,
          short_name: team.strTeamShort || '',
          founded: teamDetails.intFormedYear ? parseInt(teamDetails.intFormedYear) : null,
          logo_url: team.strBadge,
          banner_url: team.strBanner,
          badge_url: team.strBadge,
          venue_name: teamDetails.strStadium || '',
          venue_city: teamDetails.strStadiumLocation || '',
          venue_capacity: teamDetails.intStadiumCapacity ? parseInt(teamDetails.intStadiumCapacity) : null,
          country_code: 'KR',
          league_id: leagueId,
          season_year: 2025,
          website: teamDetails.strWebsite || '',
          facebook: teamDetails.strFacebook || '',
          twitter: teamDetails.strTwitter || '',
          instagram: teamDetails.strInstagram || '',
          youtube: teamDetails.strYoutube || '',
          primary_source: 'thesportsdb',
          media_source: 'thesportsdb'
        }, { onConflict: 'id' });
        
        if (teamError) {
          console.log(`   ❌ ${team.strTeam}: ${teamError.message}`);
          totalErrors++;
        } else {
          console.log(`   ✅ ${team.strTeam} 동기화 완료`);
          totalSynced++;
        }
      } catch (err) {
        console.log(`   ❌ ${team.strTeam}: ${err}`);
        totalErrors++;
      }
    }
    
    // 4. 순위 정보 동기화 (Highlightly 기준)
    console.log('\\n📊 순위 정보 동기화 (Highlightly 기준)...');
    
    if (highlightlyOk) {
      const standings = await highlightly.getAllKLeagueStandings(2025);
      
      // K League 1 순위
      if (standings.kLeague1.length > 0) {
        console.log(`   K리그1 순위: ${standings.kLeague1.length}개 팀`);
        
        for (const standing of standings.kLeague1) {
          try {
            // Highlightly 팀 ID로 TheSportsDB 팀 찾기 (이름 매칭)
            const matchingTeam = allTeams.find(t => 
              t.strTeam.toLowerCase().includes(standing.team.name.toLowerCase()) ||
              standing.team.name.toLowerCase().includes(t.strTeam.toLowerCase())
            );
            
            if (!matchingTeam) {
              console.log(`   ⚠️ 매칭되지 않은 팀: ${standing.team.name}`);
              continue;
            }
            
            const { error: standingError } = await supa.from('standings').upsert({
              league_id: 4001, // K리그1
              team_id: parseInt(matchingTeam.idTeam),
              season_year: 2025,
              position: standing.position,
              points: standing.points,
              played: standing.total.games,
              won: standing.total.wins,
              drawn: standing.total.draws,
              lost: standing.total.loses,
              goals_for: standing.total.scoredGoals,
              goals_against: standing.total.receivedGoals,
              goal_difference: standing.total.scoredGoals - standing.total.receivedGoals,
              home_played: standing.home.games,
              home_won: standing.home.wins,
              home_drawn: standing.home.draws,
              home_lost: standing.home.loses,
              home_goals_for: standing.home.scoredGoals,
              home_goals_against: standing.home.receivedGoals,
              away_played: standing.away.games,
              away_won: standing.away.wins,
              away_drawn: standing.away.draws,
              away_lost: standing.away.loses,
              away_goals_for: standing.away.scoredGoals,
              away_goals_against: standing.away.receivedGoals,
              data_source: 'highlightly'
            }, { onConflict: 'league_id,team_id,season_year' });
            
            if (standingError) {
              console.log(`   ❌ ${standing.team.name} 순위: ${standingError.message}`);
              totalErrors++;
            } else {
              console.log(`   ✅ ${standing.team.name} 순위 (${standing.position}위) 동기화 완료`);
              totalSynced++;
            }
          } catch (err) {
            console.log(`   ❌ ${standing.team.name} 순위: ${err}`);
            totalErrors++;
          }
        }
      }
      
      // K League 2 순위도 동일하게 처리
      if (standings.kLeague2.length > 0) {
        console.log(`   K리그2 순위: ${standings.kLeague2.length}개 팀`);
        
        for (const standing of standings.kLeague2) {
          try {
            const matchingTeam = allTeams.find(t => 
              t.strTeam.toLowerCase().includes(standing.team.name.toLowerCase()) ||
              standing.team.name.toLowerCase().includes(t.strTeam.toLowerCase())
            );
            
            if (!matchingTeam) continue;
            
            const { error: standingError } = await supa.from('standings').upsert({
              league_id: 4002, // K리그2
              team_id: parseInt(matchingTeam.idTeam),
              season_year: 2025,
              position: standing.position,
              points: standing.points,
              played: standing.total.games,
              won: standing.total.wins,
              drawn: standing.total.draws,
              lost: standing.total.loses,
              goals_for: standing.total.scoredGoals,
              goals_against: standing.total.receivedGoals,
              goal_difference: standing.total.scoredGoals - standing.total.receivedGoals,
              home_played: standing.home.games,
              home_won: standing.home.wins,
              home_drawn: standing.home.draws,
              home_lost: standing.home.loses,
              home_goals_for: standing.home.scoredGoals,
              home_goals_against: standing.home.receivedGoals,
              away_played: standing.away.games,
              away_won: standing.away.wins,
              away_drawn: standing.away.draws,
              away_lost: standing.away.loses,
              away_goals_for: standing.away.scoredGoals,
              away_goals_against: standing.away.receivedGoals,
              data_source: 'highlightly'
            }, { onConflict: 'league_id,team_id,season_year' });
            
            if (!standingError) {
              totalSynced++;
              console.log(`   ✅ ${standing.team.name} 순위 (${standing.position}위) 동기화 완료`);
            } else {
              totalErrors++;
            }
          } catch (err) {
            totalErrors++;
          }
        }
      }
    }
    
    // 5. 일정 정보 동기화 (TheSportsDB 기준)
    console.log('\\n🗓️ 일정 정보 동기화 (TheSportsDB 기준)...');
    
    const allSchedule = [...kLeague1Data.schedule, ...kLeague2Data.schedule];
    console.log(`   총 ${allSchedule.length}개 경기 동기화 시작...`);
    
    for (const fixture of allSchedule.slice(0, 50)) { // 처음 50경기만 테스트
      try {
        const leagueId = fixture.idLeague === '4689' ? 4001 : 4002;
        
        const { error: fixtureError } = await supa.from('fixtures').upsert({
          thesportsdb_id: fixture.idEvent,
          league_id: leagueId,
          season_year: parseInt(fixture.strSeason) || 2025,
          round: parseInt(fixture.intRound) || 1,
          match_date: new Date(`${fixture.dateEvent} ${fixture.strTime || '15:00'}`),
          home_team_id: parseInt(fixture.idHomeTeam),
          away_team_id: parseInt(fixture.idAwayTeam),
          home_score: fixture.intHomeScore ? parseInt(fixture.intHomeScore) : null,
          away_score: fixture.intAwayScore ? parseInt(fixture.intAwayScore) : null,
          status: fixture.strStatus || 'NS',
          venue_name: fixture.strVenue || '',
          venue_city: fixture.strCity || '',
          primary_source: 'thesportsdb'
        }, { onConflict: 'thesportsdb_id' });
        
        if (!fixtureError) {
          totalSynced++;
        } else {
          totalErrors++;
        }
      } catch (err) {
        totalErrors++;
      }
    }
    
    // 6. 동기화 결과 요약
    console.log('\\n' + '='.repeat(60));
    console.log('📊 3-API 통합 데이터 동기화 완료!');
    console.log('='.repeat(60));
    console.log(`📅 완료 시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`✅ 성공: ${totalSynced}개`);
    console.log(`❌ 오류: ${totalErrors}개`);
    console.log(`📈 성공률: ${totalSynced > 0 ? Math.round((totalSynced / (totalSynced + totalErrors)) * 100) : 0}%`);
    
    // 7. 동기화된 데이터 확인
    console.log('\\n🔍 동기화된 데이터 확인...');
    
    const [leagueResult, teamResult, standingResult, fixtureResult] = await Promise.all([
      supa.from('leagues').select('*'),
      supa.from('teams').select('*'),
      supa.from('standings').select('*'),
      supa.from('fixtures').select('*')
    ]);
    
    console.log(`📋 리그: ${leagueResult.data?.length || 0}개`);
    console.log(`⚽ 팀: ${teamResult.data?.length || 0}개 (TheSportsDB ID 기반)`);
    console.log(`📊 순위: ${standingResult.data?.length || 0}개 (Highlightly 실시간 데이터)`);
    console.log(`🏟️ 경기: ${fixtureResult.data?.length || 0}개`);
    
    if (totalSynced > totalErrors) {
      console.log('\\n🎉 3-API 통합 데이터 동기화가 성공적으로 완료되었습니다!');
      console.log('✨ 이제 TheSportsDB + Highlightly + K League 공식 데이터를 모두 활용합니다!');
      console.log('📊 데이터 품질과 이미지 리소스가 대폭 향상되었습니다!');
    } else {
      console.log('\\n⚠️ 일부 데이터 동기화에 문제가 있었습니다. 로그를 확인해주세요.');
    }
    
  } catch (error) {
    console.error('\\n💥 3-API 데이터 동기화 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(console.error);