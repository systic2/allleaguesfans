import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY || "4970b271c2989a1bd26b32b7518692b7";

const supabase = createClient(supabaseUrl, supabaseKey);

interface LineupPlayer {
  player: {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string;
  };
}

interface TeamLineup {
  team: {
    id: number;
    name: string;
    logo: string;
    colors: any;
  };
  coach: {
    id: number;
    name: string;
    photo: string;
  } | null;
  formation: string;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

async function importLineups() {
  console.log("🔄 라인업 데이터 임포트 시작...\n");

  try {
    // 1. 최근 완료된 경기들 가져오기 (Status: FT)
    const { data: recentFixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('id, home_team_id, away_team_id, date_utc, status_short')
      .eq('status_short', 'FT')
      .gte('date_utc', '2025-08-01')
      .order('date_utc', { ascending: false })
      .limit(10);

    if (fixturesError || !recentFixtures) {
      console.log(`❌ 경기 조회 오류: ${fixturesError?.message}`);
      return;
    }

    console.log(`📋 대상 경기: ${recentFixtures.length}개\n`);

    let totalLineups = 0;
    let totalPlayers = 0;

    for (const fixture of recentFixtures) {
      console.log(`🎯 경기 ${fixture.id} 처리 중... (${fixture.date_utc.split('T')[0]})`);

      // 이미 라인업이 있는지 확인
      const { data: existingLineups } = await supabase
        .from('lineups')
        .select('id')
        .eq('fixture_id', fixture.id);

      if (existingLineups && existingLineups.length > 0) {
        console.log(`   ⏭️ 라인업 이미 존재 (${existingLineups.length}팀)`);
        continue;
      }

      try {
        // API-Football에서 라인업 데이터 가져오기
        const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixture.id}`, {
          headers: {
            "x-rapidapi-key": apiKey
          }
        });

        if (!response.ok) {
          console.log(`   ❌ API 요청 실패: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const teamLineups: TeamLineup[] = data.response || [];

        if (teamLineups.length === 0) {
          console.log(`   ⚠️ 라인업 데이터 없음`);
          continue;
        }

        console.log(`   ✅ ${teamLineups.length}팀 라인업 데이터 수신`);

        // 각 팀의 라인업 처리
        for (const teamLineup of teamLineups) {
          try {
            // 1. 코치 정보 먼저 처리 (coaches 테이블에 삽입)
            let coachId = null;
            if (teamLineup.coach) {
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

                if (!coachError) {
                  console.log(`     👔 코치 추가: ${teamLineup.coach.name}`);
                }
              }
              coachId = teamLineup.coach.id;
            }

            // 2. 라인업 메인 정보 삽입
            const { data: insertedLineup, error: lineupError } = await supabase
              .from('lineups')
              .insert({
                fixture_id: fixture.id,
                team_id: teamLineup.team.id,
                formation: teamLineup.formation,
                coach_id: coachId
              })
              .select('id')
              .single();

            if (lineupError) {
              console.log(`     ❌ 라인업 삽입 실패: ${lineupError.message}`);
              continue;
            }

            const lineupId = insertedLineup.id;
            console.log(`     ✅ 라인업 생성: ${teamLineup.team.name} (${teamLineup.formation})`);

            // 3. 선발 라인업 선수들 삽입
            const allPlayers = [
              ...teamLineup.startXI.map(p => ({ ...p, is_starter: true })),
              ...teamLineup.substitutes.map(p => ({ ...p, is_starter: false }))
            ];

            for (const playerData of allPlayers) {
              try {
                const { error: playerError } = await supabase
                  .from('lineup_players')
                  .insert({
                    lineup_id: lineupId,
                    player_id: playerData.player.id,
                    jersey_number: playerData.player.number,
                    position: playerData.player.pos,
                    grid_position: playerData.player.grid,
                    is_starter: playerData.is_starter
                  });

                if (!playerError) {
                  totalPlayers++;
                }
              } catch (playerError) {
                // lineup_players 테이블이 없을 수 있음 - 무시하고 계속
              }
            }

            totalLineups++;
            console.log(`     👥 선수 ${allPlayers.length}명 처리 완료`);

          } catch (teamError) {
            console.log(`     ❌ 팀 라인업 처리 오류: ${teamError}`);
          }
        }

        // API 제한 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (apiError) {
        console.log(`   ❌ API 호출 오류: ${apiError}`);
      }
    }

    console.log(`\n📊 임포트 완료!`);
    console.log(`   라인업: ${totalLineups}개`);
    console.log(`   선수: ${totalPlayers}명`);

  } catch (error) {
    console.error("❌ 전체 오류:", error);
  }
}

// 단일 경기 라인업 임포트 함수
export async function importSingleFixtureLineup(fixtureId: number) {
  console.log(`🎯 경기 ${fixtureId} 라인업 임포트...`);

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, {
      headers: {
        "x-rapidapi-key": apiKey
      }
    });

    if (!response.ok) {
      console.log(`❌ API 요청 실패: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const teamLineups: TeamLineup[] = data.response || [];

    if (teamLineups.length === 0) {
      console.log(`⚠️ 라인업 데이터 없음`);
      return false;
    }

    console.log(`✅ ${teamLineups.length}팀 라인업 데이터 수신`);

    for (const teamLineup of teamLineups) {
      // 코치 처리
      let coachId = null;
      if (teamLineup.coach) {
        const { data: existingCoach } = await supabase
          .from('coaches')
          .select('id')
          .eq('id', teamLineup.coach.id)
          .maybeSingle();

        if (!existingCoach) {
          await supabase
            .from('coaches')
            .insert({
              id: teamLineup.coach.id,
              name: teamLineup.coach.name,
              photo: teamLineup.coach.photo
            });
        }
        coachId = teamLineup.coach.id;
      }

      // 라인업 삽입
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

      if (!lineupError) {
        console.log(`✅ ${teamLineup.team.name}: ${teamLineup.formation} (${teamLineup.startXI.length}명)`);
      }
    }

    return true;

  } catch (error) {
    console.error(`❌ 오류: ${error}`);
    return false;
  }
}

// 직접 실행
importLineups().catch(console.error);