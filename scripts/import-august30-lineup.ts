import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY || "4970b271c2989a1bd26b32b7518692b7";

const supabase = createClient(supabaseUrl, supabaseKey);

async function importAugust30Lineup() {
  console.log("🎯 8월 30일 울산 vs 전북 경기 라인업 임포트...\n");

  const fixtureId = 1340863;

  try {
    // 1. API-Football에서 라인업 데이터 가져오기
    console.log("📡 API에서 라인업 데이터 가져오는 중...");
    
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!response.ok) {
      console.log(`❌ API 요청 실패: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ API 응답 성공: ${data.results}개 결과`);
    
    if (!data.response || data.response.length === 0) {
      console.log("❌ 라인업 데이터 없음");
      return;
    }

    console.log(`👥 ${data.response.length}팀 라인업 데이터 수신\n`);

    // 2. 각 팀의 라인업 처리
    for (const teamLineup of data.response) {
      console.log(`🏆 팀: ${teamLineup.team.name} (ID: ${teamLineup.team.id})`);
      console.log(`👔 코치: ${teamLineup.coach?.name || '정보 없음'}`);
      console.log(`📋 포메이션: ${teamLineup.formation}`);
      console.log(`⚽ 선발: ${teamLineup.startXI?.length || 0}명`);
      console.log(`🪑 후보: ${teamLineup.substitutes?.length || 0}명\n`);

      try {
        // 3. 코치 정보 처리
        let coachId = null;
        if (teamLineup.coach) {
          console.log(`   👔 코치 처리 중: ${teamLineup.coach.name} (ID: ${teamLineup.coach.id})`);
          
          // 기존 코치 확인
          const { data: existingCoach } = await supabase
            .from('coaches')
            .select('id')
            .eq('id', teamLineup.coach.id)
            .maybeSingle();

          if (!existingCoach) {
            const { error: coachError } = await supabase
              .from('coaches')
              .insert({
                id: teamLineup.coach.id,
                name: teamLineup.coach.name,
                photo: teamLineup.coach.photo
              });

            if (coachError) {
              console.log(`      ❌ 코치 삽입 실패: ${coachError.message}`);
            } else {
              console.log(`      ✅ 코치 추가 완료`);
            }
          } else {
            console.log(`      ✅ 코치 이미 존재`);
          }
          
          coachId = teamLineup.coach.id;
        }

        // 4. 라인업 메인 정보 삽입
        console.log(`   📋 라인업 정보 삽입 중...`);
        
        const { data: insertedLineup, error: lineupError } = await supabase
          .from('lineups')
          .upsert({
            fixture_id: fixtureId,
            team_id: teamLineup.team.id,
            formation: teamLineup.formation,
            coach_id: coachId
          }, {
            onConflict: 'fixture_id,team_id'
          })
          .select('id')
          .single();

        if (lineupError) {
          console.log(`      ❌ 라인업 삽입 실패: ${lineupError.message}`);
          continue;
        }

        console.log(`      ✅ 라인업 삽입 완료 (ID: ${insertedLineup.id})`);

        // 5. 선수 정보 처리 (lineup_players 테이블이 있다면)
        const allPlayers = [
          ...teamLineup.startXI.map((p: any) => ({ ...p, is_starter: true })),
          ...teamLineup.substitutes.map((p: any) => ({ ...p, is_starter: false }))
        ];

        console.log(`   👥 ${allPlayers.length}명 선수 정보 처리 중...`);

        // lineup_players 테이블 시도
        try {
          let successCount = 0;
          for (const playerData of allPlayers) {
            const { error: playerError } = await supabase
              .from('lineup_players')
              .upsert({
                lineup_id: insertedLineup.id,
                player_id: playerData.player.id,
                jersey_number: playerData.player.number,
                position: playerData.player.pos,
                grid_position: playerData.player.grid,
                is_starter: playerData.is_starter
              }, {
                onConflict: 'lineup_id,player_id'
              });

            if (!playerError) {
              successCount++;
            } else {
              console.log(`      ⚠️ 선수 ${playerData.player.name} 삽입 실패: ${playerError.message}`);
            }
          }
          
          console.log(`      ✅ 선수 ${successCount}/${allPlayers.length}명 처리 완료`);
          
        } catch (playerTableError) {
          console.log(`      ⚠️ lineup_players 테이블을 사용할 수 없음: ${playerTableError}`);
          console.log(`      ℹ️ 라인업 메인 정보만 저장됨`);
        }

        console.log(`\n`);

      } catch (teamError) {
        console.log(`   ❌ 팀 라인업 처리 오류: ${teamError}\n`);
      }
    }

    // 6. 결과 확인
    console.log("📊 임포트 결과 확인...");
    
    const { data: finalLineups } = await supabase
      .from('lineups')
      .select(`
        *,
        coaches(name),
        teams(name)
      `)
      .eq('fixture_id', fixtureId);

    if (finalLineups && finalLineups.length > 0) {
      console.log(`✅ 총 ${finalLineups.length}팀 라인업 임포트 완료:`);
      finalLineups.forEach((lineup, index) => {
        console.log(`   ${index + 1}. ${lineup.teams?.name || `Team ${lineup.team_id}`}: ${lineup.formation}`);
        console.log(`      코치: ${lineup.coaches?.name || '정보 없음'}`);
      });
    } else {
      console.log("❌ 라인업 임포트 실패");
    }

  } catch (error) {
    console.error("❌ 전체 오류:", error);
  }
}

importAugust30Lineup().catch(console.error);