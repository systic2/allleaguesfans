import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePlayerDataAccuracy() {
  console.log('🔍 선수 데이터 정확성 및 실시간성 분석...\n');

  try {
    // 1. 데이터베이스 스키마 및 기본 통계
    console.log('📊 기본 데이터 현황:');
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('*');

    if (playersError) {
      console.error('❌ Error fetching players:', playersError.message);
      return;
    }

    if (!allPlayers || allPlayers.length === 0) {
      console.error('❌ No players found');
      return;
    }

    console.log(`  - 전체 선수 수: ${allPlayers.length}`);
    console.log(`  - 사용 가능한 필드: ${Object.keys(allPlayers[0]).join(', ')}\n`);

    // 2. 팀별 선수 분포
    const teamCounts = allPlayers.reduce((acc: any, player) => {
      acc[player.team_id] = (acc[player.team_id] || 0) + 1;
      return acc;
    }, {});

    console.log('🏈 팀별 선수 분포:');
    Object.entries(teamCounts).forEach(([teamId, count]) => {
      console.log(`  Team ${teamId}: ${count}명`);
    });

    // 3. 데이터 완성도 분석
    console.log('\n📈 데이터 완성도 분석:');
    const fields = ['jersey_number', 'position', 'photo', 'nationality', 'age', 'height', 'weight'];
    
    fields.forEach(field => {
      const nullCount = allPlayers.filter(p => p[field] === null || p[field] === undefined || p[field] === '').length;
      const percentage = ((nullCount / allPlayers.length) * 100).toFixed(1);
      console.log(`  ${field}: ${nullCount}개 누락 (${percentage}%)`);
    });

    // 4. 등번호 분석
    console.log('\n🔢 등번호 현황 분석:');
    const playersWithJersey = allPlayers.filter(p => p.jersey_number !== null);
    const playersWithoutJersey = allPlayers.filter(p => p.jersey_number === null);
    
    console.log(`  - 등번호 있는 선수: ${playersWithJersey.length}명`);
    console.log(`  - 등번호 없는 선수: ${playersWithoutJersey.length}명`);
    console.log(`  - 등번호 범위: ${Math.min(...playersWithJersey.map(p => p.jersey_number))} ~ ${Math.max(...playersWithJersey.map(p => p.jersey_number))}`);

    // 5. 포지션 분석
    console.log('\n⚽ 포지션 분포:');
    const positionCounts = allPlayers.reduce((acc: any, player) => {
      const pos = player.position || 'Unknown';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});

    Object.entries(positionCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .forEach(([position, count]) => {
        console.log(`  ${position}: ${count}명`);
      });

    // 6. 최신 업데이트 시간 확인 (created_at, updated_at 필드가 있다면)
    console.log('\n🕒 데이터 최신성 분석:');
    if (allPlayers[0].created_at) {
      const dates = allPlayers.map(p => new Date(p.created_at)).sort((a, b) => b.getTime() - a.getTime());
      console.log(`  - 가장 최근 생성: ${dates[0].toISOString().split('T')[0]}`);
      console.log(`  - 가장 오래된 생성: ${dates[dates.length - 1].toISOString().split('T')[0]}`);
    }

    if (allPlayers[0].updated_at) {
      const updateDates = allPlayers
        .filter(p => p.updated_at)
        .map(p => new Date(p.updated_at))
        .sort((a, b) => b.getTime() - a.getTime());
      
      if (updateDates.length > 0) {
        console.log(`  - 가장 최근 업데이트: ${updateDates[0].toISOString().split('T')[0]}`);
      }
    }

    // 7. API-Football과의 데이터 동기화 상태 추정
    console.log('\n🔄 데이터 동기화 이슈 추정:');
    console.log('  ⚠️ 실제 경기 등번호와 차이 가능성 있음');
    console.log('  ⚠️ 이적/임대/은퇴 상태 실시간 반영 필요');
    console.log('  ⚠️ 시즌별 소속팀 변경 추적 미흡');

    // 8. 샘플 데이터 확인
    console.log('\n📋 샘플 선수 데이터:');
    const samplePlayers = allPlayers.slice(0, 3);
    samplePlayers.forEach(player => {
      console.log(`  선수: ${player.name}`);
      console.log(`    팀 ID: ${player.team_id}`);
      console.log(`    등번호: ${player.jersey_number || 'N/A'}`);
      console.log(`    포지션: ${player.position || 'N/A'}`);
      console.log(`    국적: ${player.nationality || 'N/A'}`);
      console.log(`    나이: ${player.age || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

analyzePlayerDataAccuracy().catch(console.error);