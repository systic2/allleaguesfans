import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;
const apiKey = process.env.API_FOOTBALL_KEY;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAPIFootballData(endpoint: string) {
  try {
    const response = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
      headers: {
        'x-apisports-key': apiKey!,
        'x-apisports-host': 'v3.football.api-sports.io'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    return null;
  }
}

async function checkLivePlayerData() {
  console.log('🔍 실시간 선수 데이터 비교 분석...\n');

  try {
    // 1. 현재 시즌 확인
    console.log('📅 현재 시즌 정보 확인:');
    const seasonsData = await fetchAPIFootballData('leagues?id=292&season=2025');
    
    if (seasonsData?.response?.[0]) {
      const league = seasonsData.response[0];
      console.log(`  리그: ${league.league.name}`);
      console.log(`  시즌: ${league.seasons[0]?.year || '2025'}`);
      console.log(`  시즌 시작: ${league.seasons[0]?.start || 'N/A'}`);
      console.log(`  시즌 종료: ${league.seasons[0]?.end || 'N/A'}`);
      console.log(`  현재 상태: ${league.seasons[0]?.current ? '진행중' : '종료'}\n`);
    }

    // 2. 팀 정보 확인
    console.log('🏈 현재 리그 참가 팀 확인:');
    const teamsData = await fetchAPIFootballData('teams?league=292&season=2025');
    
    if (teamsData?.response) {
      console.log(`  API-Football 팀 수: ${teamsData.response.length}`);
      
      // 데이터베이스 팀과 비교
      const { data: dbTeams } = await supabase
        .from('teams')
        .select('id, name, league_id')
        .eq('league_id', 292);
      
      console.log(`  데이터베이스 팀 수: ${dbTeams?.length || 0}`);
      
      // 팀 이름 비교 (처음 5개)
      console.log('\n  팀 비교 (상위 5개):');
      const apiTeamNames = teamsData.response.slice(0, 5).map((t: any) => t.team.name);
      const dbTeamNames = dbTeams?.slice(0, 5).map(t => t.name) || [];
      
      apiTeamNames.forEach((name: string, index: number) => {
        const dbName = dbTeamNames[index] || 'N/A';
        const match = name === dbName ? '✅' : '❌';
        console.log(`    ${match} API: ${name} | DB: ${dbName}`);
      });
    }

    // 3. 샘플 팀의 선수 정보 확인
    console.log('\n👥 샘플 팀 선수 정보 비교:');
    const sampleTeamId = teamsData?.response?.[0]?.team?.id;
    
    if (sampleTeamId) {
      console.log(`  샘플 팀 ID: ${sampleTeamId}`);
      
      // API에서 현재 스쿼드 가져오기
      const squadData = await fetchAPIFootballData(`players/squads?team=${sampleTeamId}`);
      
      if (squadData?.response?.[0]) {
        const apiPlayers = squadData.response[0].players || [];
        console.log(`  API 현재 스쿼드: ${apiPlayers.length}명`);
        
        // 데이터베이스에서 해당 팀 선수 가져오기
        const { data: dbPlayers } = await supabase
          .from('players')
          .select('name, jersey_number, position')
          .eq('team_id', sampleTeamId);
        
        console.log(`  DB 저장된 선수: ${dbPlayers?.length || 0}명`);
        
        // 등번호 비교 (처음 5명)
        console.log('\n  등번호 비교 (상위 5명):');
        const apiSample = apiPlayers.slice(0, 5);
        const dbSample = dbPlayers?.slice(0, 5) || [];
        
        apiSample.forEach((player: any, index: number) => {
          const dbPlayer = dbSample[index];
          if (dbPlayer) {
            const numberMatch = player.number === dbPlayer.jersey_number ? '✅' : '❌';
            console.log(`    ${numberMatch} ${player.name}: API #${player.number || 'N/A'} | DB #${dbPlayer.jersey_number || 'N/A'}`);
          } else {
            console.log(`    ❓ ${player.name}: API #${player.number || 'N/A'} | DB: 없음`);
          }
        });
      }
    }

    // 4. 선수 상태 변화 확인 (이적, 부상 등)
    console.log('\n🔄 선수 상태 변화 감지:');
    
    // 최근 이적 정보 확인
    const transfersData = await fetchAPIFootballData('transfers?league=292');
    
    if (transfersData?.response) {
      const recentTransfers = transfersData.response.slice(0, 5);
      console.log(`  최근 이적 정보: ${recentTransfers.length}건`);
      
      recentTransfers.forEach((transfer: any) => {
        console.log(`    ${transfer.player.name}: ${transfer.teams.out.name} → ${transfer.teams.in.name}`);
        console.log(`      이적일: ${transfer.date}`);
        console.log(`      이적료: ${transfer.transfers[0]?.type || 'N/A'}`);
      });
    }

    // 5. 데이터 신선도 분석
    console.log('\n📊 데이터 신선도 분석:');
    
    const { data: recentlyUpdated } = await supabase
      .from('players')
      .select('name, updated_at')
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (recentlyUpdated && recentlyUpdated.length > 0) {
      console.log('  최근 업데이트된 선수들:');
      recentlyUpdated.forEach(player => {
        const daysSince = Math.floor((Date.now() - new Date(player.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`    ${player.name}: ${daysSince}일 전 업데이트`);
      });
    }

    // 6. 권장사항
    console.log('\n💡 데이터 정확성 개선 권장사항:');
    console.log('  1. 🔄 일일 선수 데이터 동기화 자동화');
    console.log('  2. 📊 실시간 등번호 변경 감지 및 반영');
    console.log('  3. 🏃‍♂️ 선수 이적/임대/은퇴 상태 추적');
    console.log('  4. ✅ 데이터 검증 및 품질 모니터링');
    console.log('  5. 📱 사용자 제보 시스템 구축');

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

checkLivePlayerData().catch(console.error);