import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;
const apiKey = process.env.API_FOOTBALL_KEY;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface JerseyMismatch {
  player_id: number;
  player_name: string;
  team_id: number;
  team_name: string;
  db_jersey: number | null;
  api_jersey: number | null;
  confidence: number;
  position: string;
  action: 'update' | 'flag' | 'skip';
  reason: string;
}

interface AutoFixConfig {
  minConfidence: number;
  dryRun: boolean;
  maxUpdatesPerTeam: number;
  enablePositionFix: boolean;
  enableNewPlayerAddition: boolean;
}

async function fetchAPIFootballData(endpoint: string) {
  try {
    console.log(`🌐 API 호출: ${endpoint}`);
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

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/[^\w\s가-힣]/g, '') // 한글 포함
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateNameConfidence(apiName: string, dbName: string): number {
  const normalizedApi = normalizePlayerName(apiName);
  const normalizedDb = normalizePlayerName(dbName);
  
  // 완전 일치
  if (normalizedApi === normalizedDb) return 1.0;
  
  // 포함 관계 확인
  const apiParts = normalizedApi.split(' ');
  const dbParts = normalizedDb.split(' ');
  
  let matchCount = 0;
  const totalParts = Math.max(apiParts.length, dbParts.length);
  
  for (const apiPart of apiParts) {
    for (const dbPart of dbParts) {
      if (apiPart.length > 2 && dbPart.includes(apiPart)) {
        matchCount++;
        break;
      }
      if (dbPart.length > 2 && apiPart.includes(dbPart)) {
        matchCount++;
        break;
      }
    }
  }
  
  const confidence = matchCount / totalParts;
  
  // 한글 이름 특별 처리
  if (normalizedApi.match(/[가-힣]/) && normalizedDb.match(/[가-힣]/)) {
    const koreanMatch = normalizedApi.includes(normalizedDb) || normalizedDb.includes(normalizedApi);
    if (koreanMatch) return Math.max(confidence, 0.8);
  }
  
  return confidence;
}

async function findJerseyMismatches(teamId: number, _season: number): Promise<JerseyMismatch[]> {
  console.log(`\n🔍 팀 ${teamId} 등번호 불일치 분석...`);
  
  // 1. 데이터베이스에서 팀 선수 조회
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, name, team_id, jersey_number, position, api_player_id')
    .eq('team_id', teamId);

  if (!dbPlayers || dbPlayers.length === 0) {
    console.log(`  ⚠️ 팀 ${teamId}의 데이터베이스 선수 없음`);
    return [];
  }

  // 2. API-Football에서 현재 스쿼드 조회
  const squadData = await fetchAPIFootballData(`players/squads?team=${teamId}`);
  
  if (!squadData?.response?.[0]) {
    console.log(`  ⚠️ 팀 ${teamId}의 API 스쿼드 데이터 없음`);
    return [];
  }

  const apiPlayers = squadData.response[0].players || [];
  console.log(`  📊 DB: ${dbPlayers.length}명, API: ${apiPlayers.length}명`);

  // 3. 팀 이름 조회
  const teamData = await fetchAPIFootballData(`teams?id=${teamId}`);
  const teamName = teamData?.response?.[0]?.team?.name || `Team ${teamId}`;

  // 4. 매칭 및 불일치 분석
  const mismatches: JerseyMismatch[] = [];

  for (const dbPlayer of dbPlayers) {
    // API에서 매칭되는 선수 찾기
    let bestMatch = null;
    let bestConfidence = 0;

    for (const apiPlayer of apiPlayers) {
      const nameConfidence = calculateNameConfidence(apiPlayer.name, dbPlayer.name);
      
      if (nameConfidence > bestConfidence && nameConfidence >= 0.6) {
        bestMatch = apiPlayer;
        bestConfidence = nameConfidence;
      }
    }

    if (bestMatch) {
      const dbJersey = dbPlayer.jersey_number;
      const apiJersey = bestMatch.number;
      
      // 등번호 불일치 체크
      if (dbJersey !== apiJersey) {
        let action: 'update' | 'flag' | 'skip' = 'skip';
        let reason = '';

        if (bestConfidence >= 0.9 && apiJersey !== null) {
          action = 'update';
          reason = `높은 신뢰도 매칭 (${(bestConfidence * 100).toFixed(1)}%)`;
        } else if (bestConfidence >= 0.7 && apiJersey !== null) {
          action = 'flag';
          reason = `중간 신뢰도 매칭 (${(bestConfidence * 100).toFixed(1)}%) - 수동 확인 필요`;
        } else {
          reason = `낮은 신뢰도 (${(bestConfidence * 100).toFixed(1)}%) - 건너뜀`;
        }

        mismatches.push({
          player_id: dbPlayer.id,
          player_name: dbPlayer.name,
          team_id: teamId,
          team_name: teamName,
          db_jersey: dbJersey,
          api_jersey: apiJersey,
          confidence: bestConfidence,
          position: dbPlayer.position || 'Unknown',
          action,
          reason
        });
      }
    }
  }

  console.log(`  🎯 발견된 불일치: ${mismatches.length}건`);
  return mismatches;
}

async function applyJerseyFixes(mismatches: JerseyMismatch[], config: AutoFixConfig): Promise<void> {
  console.log(`\n🔧 등번호 수정 적용 (DRY RUN: ${config.dryRun})...`);
  
  const updates = mismatches.filter(m => 
    m.action === 'update' && 
    m.confidence >= config.minConfidence
  ).slice(0, config.maxUpdatesPerTeam);

  console.log(`📊 수정 대상: ${updates.length}건`);

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    console.log(`\n  🎯 처리 중: ${update.player_name}`);
    console.log(`    DB #${update.db_jersey || 'NULL'} → API #${update.api_jersey}`);
    console.log(`    신뢰도: ${(update.confidence * 100).toFixed(1)}%`);
    console.log(`    사유: ${update.reason}`);

    if (!config.dryRun) {
      try {
        const { error } = await supabase
          .from('players')
          .update({ 
            jersey_number: update.api_jersey,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.player_id);

        if (error) {
          console.log(`    ❌ 수정 실패: ${error.message}`);
          errorCount++;
        } else {
          console.log(`    ✅ 수정 완료`);
          successCount++;

          // 수정 로그 기록
          await supabase
            .from('jersey_correction_log')
            .insert({
              player_id: update.player_id,
              old_jersey: update.db_jersey,
              new_jersey: update.api_jersey,
              confidence: update.confidence,
              reason: update.reason,
              corrected_at: new Date().toISOString()
            });
        }
      } catch (err) {
        console.log(`    ❌ 예외 발생: ${err}`);
        errorCount++;
      }
    } else {
      console.log(`    🔍 DRY RUN - 실제 수정하지 않음`);
      successCount++;
    }

    // API 호출 제한
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📈 수정 결과:`);
  console.log(`  ✅ 성공: ${successCount}건`);
  console.log(`  ❌ 실패: ${errorCount}건`);
  
  // 플래그가 필요한 항목들
  const flaggedItems = mismatches.filter(m => m.action === 'flag');
  if (flaggedItems.length > 0) {
    console.log(`\n⚠️ 수동 확인 필요 (${flaggedItems.length}건):`);
    flaggedItems.forEach(item => {
      console.log(`  📝 ${item.player_name}: DB #${item.db_jersey} vs API #${item.api_jersey} (신뢰도: ${(item.confidence * 100).toFixed(1)}%)`);
    });
  }
}

async function createCorrectionLogTable() {
  console.log('📋 등번호 수정 로그 테이블 생성...');
  
  const { error } = await supabase.rpc('create_jersey_correction_log_table', {});
  
  if (error && !error.message.includes('already exists')) {
    console.error('❌ 테이블 생성 실패:', error.message);
  } else {
    console.log('✅ 로그 테이블 준비 완료');
  }
}

async function generateFixReport(allMismatches: JerseyMismatch[]): Promise<void> {
  console.log('\n📊 수정 리포트 생성...');
  
  const totalMismatches = allMismatches.length;
  const updateCount = allMismatches.filter(m => m.action === 'update').length;
  const flagCount = allMismatches.filter(m => m.action === 'flag').length;
  const skipCount = allMismatches.filter(m => m.action === 'skip').length;
  
  const avgConfidence = allMismatches.reduce((sum, m) => sum + m.confidence, 0) / totalMismatches;
  
  console.log('================================================================');
  console.log('🎯 등번호 불일치 자동 수정 리포트');
  console.log('================================================================');
  console.log(`📊 전체 불일치: ${totalMismatches}건`);
  console.log(`🔧 자동 수정: ${updateCount}건`);
  console.log(`⚠️ 수동 확인: ${flagCount}건`);
  console.log(`⏭️ 건너뜀: ${skipCount}건`);
  console.log(`📈 평균 신뢰도: ${(avgConfidence * 100).toFixed(1)}%`);
  
  // 팀별 요약
  const teamSummary = allMismatches.reduce((acc, m) => {
    if (!acc[m.team_id]) {
      acc[m.team_id] = { name: m.team_name, total: 0, updates: 0, flags: 0 };
    }
    acc[m.team_id].total++;
    if (m.action === 'update') acc[m.team_id].updates++;
    if (m.action === 'flag') acc[m.team_id].flags++;
    return acc;
  }, {} as Record<number, { name: string; total: number; updates: number; flags: number }>);

  console.log('\n🏈 팀별 상세:');
  Object.entries(teamSummary).forEach(([_teamId, summary]) => {
    console.log(`  ${summary.name}: ${summary.total}건 (수정: ${summary.updates}, 확인: ${summary.flags})`);
  });
  
  console.log('\n💡 권장사항:');
  if (flagCount > 0) {
    console.log(`  1. ${flagCount}건의 수동 확인 필요 항목 검토`);
  }
  if (updateCount > 0) {
    console.log(`  2. ${updateCount}건의 자동 수정 결과 검증`);
  }
  console.log('  3. 정기적인 등번호 동기화 스케줄 설정');
  console.log('  4. 이적시장 기간 중 주간 모니터링 강화');
  
  console.log('================================================================');
}

async function autoFixJerseyMismatches() {
  console.log('🚀 등번호 불일치 자동 수정 시스템 시작\n');

  // 설정
  const config: AutoFixConfig = {
    minConfidence: 0.8,
    dryRun: process.argv.includes('--dry-run'),
    maxUpdatesPerTeam: 10,
    enablePositionFix: true,
    enableNewPlayerAddition: false
  };

  console.log('⚙️ 설정:');
  console.log(`  최소 신뢰도: ${config.minConfidence * 100}%`);
  console.log(`  DRY RUN: ${config.dryRun}`);
  console.log(`  팀당 최대 수정: ${config.maxUpdatesPerTeam}건`);

  // 로그 테이블 생성
  await createCorrectionLogTable();

  // K League 1 팀들 조회
  const teamsData = await fetchAPIFootballData('teams?league=292&season=2025');
  
  if (!teamsData?.response) {
    console.error('❌ 팀 데이터를 가져올 수 없습니다.');
    return;
  }

  console.log(`\n📊 처리 대상: ${teamsData.response.length}개 팀`);

  const allMismatches: JerseyMismatch[] = [];

  // 각 팀별 불일치 분석 및 수정
  for (const teamData of teamsData.response.slice(0, 3)) { // 처음 3개 팀만 처리 (테스트)
    const teamId = teamData.team.id;
    
    try {
      const mismatches = await findJerseyMismatches(teamId, 2025);
      allMismatches.push(...mismatches);
      
      if (mismatches.length > 0) {
        await applyJerseyFixes(mismatches, config);
      } else {
        console.log(`  ✅ ${teamData.team.name}: 불일치 없음`);
      }
    } catch (error) {
      console.error(`❌ 팀 ${teamId} 처리 실패:`, error);
    }

    // API 호출 제한
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 최종 리포트
  if (allMismatches.length > 0) {
    await generateFixReport(allMismatches);
  } else {
    console.log('\n🎉 모든 팀의 등번호가 정확합니다!');
  }

  console.log('\n✅ 등번호 불일치 자동 수정 완료');
}

// 스크립트 실행 감지
if (import.meta.url === `file://${process.argv[1]}`) {
  autoFixJerseyMismatches().catch((error) => {
    console.error('❌ 자동 수정 실패:', error);
    process.exit(1);
  });
}

export { autoFixJerseyMismatches, findJerseyMismatches };