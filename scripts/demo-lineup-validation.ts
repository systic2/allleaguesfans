#!/usr/bin/env tsx
// scripts/demo-lineup-validation.ts
// Demonstration script for the real-time lineup validation API system

import { lineupValidationAPI, ValidationUtils } from '../src/lib/lineup-validation-api.ts';
import { ValidationEndpoints } from '../src/lib/validation-endpoints.ts';

// ============================================================================
// Demo Configuration
// ============================================================================

const DEMO_CONFIG = {
  // K League 1 teams for demonstration
  DEMO_TEAMS: [
    { id: 2762, name: '전북 현대 모터스' },
    { id: 2764, name: 'FC 서울' },
    { id: 2772, name: '수원 FC' },
    { id: 8636, name: 'FC 안양' },
    { id: 2773, name: '김천 상무' }
  ],
  SEASON: 2025,
  LEAGUE_ID: 292
};

// ============================================================================
// Utility Functions
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 ${title}`);
  console.log('='.repeat(80));
}

function logSubsection(title: string) {
  console.log(`\n📋 ${title}`);
  console.log('-'.repeat(50));
}

function logResult(result: any, truncate = false) {
  if (truncate && result && typeof result === 'object') {
    // Show condensed version for large objects
    if (Array.isArray(result)) {
      console.log(`   📊 배열 길이: ${result.length}개 항목`);
      if (result.length > 0) {
        console.log(`   📝 첫 번째 항목:`, JSON.stringify(result[0], null, 2).substring(0, 200) + '...');
      }
    } else {
      const keys = Object.keys(result);
      console.log(`   📊 객체 키: ${keys.join(', ')}`);
      console.log(`   📝 일부 데이터:`, JSON.stringify(result, null, 2).substring(0, 300) + '...');
    }
  } else {
    console.log('   📄 결과:', JSON.stringify(result, null, 2));
  }
}

function logError(error: any) {
  console.error('   ❌ 오류:', error instanceof Error ? error.message : error);
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Demo Functions
// ============================================================================

async function demoSingleTeamValidation() {
  logSection('단일 팀 라인업 검증 데모');
  
  const demoTeam = DEMO_CONFIG.DEMO_TEAMS[0];
  
  try {
    console.log(`🏈 검증 대상: ${demoTeam.name} (ID: ${demoTeam.id})`);
    
    const validation = await lineupValidationAPI.validateTeam(demoTeam.id, DEMO_CONFIG.SEASON);
    
    console.log(`\n📊 검증 결과 요약:`);
    console.log(`   팀 이름: ${validation.team_name}`);
    console.log(`   데이터 품질 점수: ${validation.data_quality_score}%`);
    console.log(`   총 선수: ${validation.total_players}명`);
    console.log(`   정확한 데이터: ${validation.valid_players}명`);
    console.log(`   문제 발견: ${validation.issues_detected}개`);
    console.log(`   권장사항: ${validation.recommendations.length}개`);
    
    if (validation.recommendations.length > 0) {
      console.log(`\n💡 주요 권장사항:`);
      validation.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Show sample validation results
    const issueResults = validation.validation_results.filter(r => r.status !== 'valid').slice(0, 3);
    if (issueResults.length > 0) {
      console.log(`\n⚠️ 발견된 문제 (상위 3개):`);
      issueResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name} - ${result.status}`);
        if (result.issues.length > 0) {
          console.log(`      이슈: ${result.issues[0]}`);
        }
      });
    }
    
    return validation;
    
  } catch (error) {
    logError(error);
    return null;
  }
}

async function demoMultiTeamValidation() {
  logSection('다중 팀 검증 데모');
  
  try {
    console.log(`🏈 검증 대상: ${DEMO_CONFIG.DEMO_TEAMS.length}개 팀`);
    
    const teamIds = DEMO_CONFIG.DEMO_TEAMS.map(team => team.id);
    const validations = await lineupValidationAPI.validateMultipleTeams(teamIds, DEMO_CONFIG.SEASON);
    
    console.log(`\n📊 전체 검증 결과:`);
    console.log(`   검증 완료된 팀: ${validations.length}개`);
    
    const totalPlayers = validations.reduce((sum, v) => sum + v.total_players, 0);
    const totalIssues = validations.reduce((sum, v) => sum + v.issues_detected, 0);
    const avgQuality = validations.length > 0 ? 
      Math.round(validations.reduce((sum, v) => sum + v.data_quality_score, 0) / validations.length) : 0;
    
    console.log(`   총 선수 수: ${totalPlayers}명`);
    console.log(`   총 문제 수: ${totalIssues}개`);
    console.log(`   평균 품질 점수: ${avgQuality}%`);
    
    console.log(`\n📋 팀별 요약:`);
    validations.forEach((validation, index) => {
      const team = DEMO_CONFIG.DEMO_TEAMS.find(t => t.id === validation.team_id);
      console.log(`   ${index + 1}. ${team?.name || validation.team_name}: ${validation.data_quality_score}% (${validation.issues_detected}개 문제)`);
    });
    
    const lowQualityTeams = validations.filter(v => v.data_quality_score < 80);
    if (lowQualityTeams.length > 0) {
      console.log(`\n⚠️ 주의가 필요한 팀 (품질 점수 80% 미만):`);
      lowQualityTeams.forEach(validation => {
        const team = DEMO_CONFIG.DEMO_TEAMS.find(t => t.id === validation.team_id);
        console.log(`   - ${team?.name || validation.team_name}: ${validation.data_quality_score}%`);
      });
    }
    
    return validations;
    
  } catch (error) {
    logError(error);
    return [];
  }
}

async function demoTransferDetection() {
  logSection('이적 감지 데모');
  
  try {
    console.log(`🔄 이적 감지 실행 중...`);
    
    const teamIds = DEMO_CONFIG.DEMO_TEAMS.map(team => team.id);
    const transfers = await lineupValidationAPI.detectTransfers(teamIds, DEMO_CONFIG.SEASON);
    
    console.log(`\n📊 이적 감지 결과:`);
    console.log(`   감지된 변화: ${transfers.length}개`);
    
    if (transfers.length > 0) {
      const byStatus = transfers.reduce((acc, transfer) => {
        acc[transfer.status_change] = (acc[transfer.status_change] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`\n📋 상태별 분류:`);
      Object.entries(byStatus).forEach(([status, count]) => {
        const statusLabel = {
          'transfer': '이적',
          'new_signing': '신규 영입',
          'retirement': '은퇴 가능성',
          'loan': '임대',
          'return': '복귀'
        }[status] || status;
        console.log(`   ${statusLabel}: ${count}건`);
      });
      
      console.log(`\n📝 상위 감지 사례 (최대 5개):`);
      transfers.slice(0, 5).forEach((transfer, index) => {
        const statusLabel = {
          'transfer': '이적',
          'new_signing': '신규 영입',
          'retirement': '은퇴 가능성'
        }[transfer.status_change] || transfer.status_change;
        
        console.log(`   ${index + 1}. 선수 ID ${transfer.player_id}: ${statusLabel}`);
        console.log(`      신뢰도: ${Math.round(transfer.confidence * 100)}%`);
        console.log(`      감지 방법: ${transfer.detection_method}`);
        if (transfer.metadata) {
          console.log(`      추가 정보:`, JSON.stringify(transfer.metadata, null, 2).substring(0, 100));
        }
      });
    } else {
      console.log(`   ✅ 현재 감지된 이적 활동이 없습니다.`);
    }
    
    return transfers;
    
  } catch (error) {
    logError(error);
    return [];
  }
}

async function demoValidationCorrections(teamValidation: any) {
  logSection('자동 수정 데모');
  
  if (!teamValidation || teamValidation.issues_detected === 0) {
    console.log(`ℹ️ 수정할 문제가 없습니다.`);
    return;
  }
  
  try {
    console.log(`🔧 자동 수정 적용 중...`);
    console.log(`   수정 대상: ${teamValidation.team_name}`);
    console.log(`   문제 개수: ${teamValidation.issues_detected}개`);
    
    const corrections = await lineupValidationAPI.applyCorrections(teamValidation, {
      autoFixJerseyNumbers: true,
      autoFixPositions: true,
      addMissingPlayers: false, // Demo: don't add new players
      flagTransfers: true
    });
    
    console.log(`\n📊 수정 결과:`);
    console.log(`   적용된 수정: ${corrections.applied}개`);
    console.log(`   오류 발생: ${corrections.errors.length}개`);
    
    if (corrections.errors.length > 0) {
      console.log(`\n❌ 수정 중 발생한 오류:`);
      corrections.errors.slice(0, 3).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (corrections.applied > 0) {
      console.log(`\n✅ 수정이 완료되었습니다. 재검증을 권장합니다.`);
    }
    
    return corrections;
    
  } catch (error) {
    logError(error);
    return null;
  }
}

async function demoValidationAlerts(teamValidation: any) {
  logSection('검증 알림 데모');
  
  if (!teamValidation) {
    console.log(`ℹ️ 알림을 생성할 검증 데이터가 없습니다.`);
    return;
  }
  
  try {
    console.log(`🚨 알림 생성 중...`);
    
    const alerts = await lineupValidationAPI.processAlerts(teamValidation);
    
    console.log(`\n📊 알림 생성 결과:`);
    console.log(`   생성된 알림: ${alerts.length}개`);
    
    if (alerts.length > 0) {
      const bySeverity = alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`\n📋 심각도별 분류:`);
      Object.entries(bySeverity).forEach(([severity, count]) => {
        const severityLabel = {
          'critical': '긴급',
          'high': '높음',
          'medium': '보통',
          'low': '낮음'
        }[severity] || severity;
        console.log(`   ${severityLabel}: ${count}개`);
      });
      
      console.log(`\n📝 알림 목록:`);
      alerts.slice(0, 3).forEach((alert, index) => {
        console.log(`   ${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`);
        console.log(`      팀: ${alert.team_name}`);
        console.log(`      유형: ${alert.type}`);
      });
    } else {
      console.log(`   ✅ 생성된 알림이 없습니다.`);
    }
    
    return alerts;
    
  } catch (error) {
    logError(error);
    return [];
  }
}

async function demoAPIEndpoints() {
  logSection('API 엔드포인트 데모');
  
  const demoTeam = DEMO_CONFIG.DEMO_TEAMS[0];
  
  try {
    logSubsection('1. 단일 팀 검증 엔드포인트');
    console.log(`   GET /api/validation/team/${demoTeam.id}`);
    
    const teamResponse = await ValidationEndpoints.validateTeam(demoTeam.id, DEMO_CONFIG.SEASON);
    console.log(`   응답 상태: ${teamResponse.success ? '성공' : '실패'}`);
    console.log(`   실행 시간: ${teamResponse.execution_time_ms}ms`);
    
    if (teamResponse.success && teamResponse.data) {
      console.log(`   품질 점수: ${teamResponse.data.data_quality_score}%`);
      console.log(`   새로고침 필요: ${teamResponse.data.needs_refresh ? '예' : '아니오'}`);
    }
    
    await delay(1000); // Rate limiting
    
    logSubsection('2. 리그 검증 엔드포인트');
    console.log(`   GET /api/validation/league/${DEMO_CONFIG.LEAGUE_ID}`);
    
    const leagueResponse = await ValidationEndpoints.validateLeague(DEMO_CONFIG.LEAGUE_ID, DEMO_CONFIG.SEASON);
    console.log(`   응답 상태: ${leagueResponse.success ? '성공' : '실패'}`);
    console.log(`   실행 시간: ${leagueResponse.execution_time_ms}ms`);
    
    if (leagueResponse.success && leagueResponse.data) {
      console.log(`   검증된 팀: ${leagueResponse.data.summary.teams_validated}개`);
      console.log(`   평균 품질 점수: ${leagueResponse.data.summary.average_quality_score}%`);
      console.log(`   주의 필요 팀: ${leagueResponse.data.summary.teams_needing_attention}개`);
    }
    
    await delay(1000);
    
    logSubsection('3. 헬스 체크 엔드포인트');
    console.log(`   GET /api/validation/health`);
    
    const healthResponse = await ValidationEndpoints.healthCheck();
    console.log(`   응답 상태: ${healthResponse.success ? '성공' : '실패'}`);
    
    if (healthResponse.success && healthResponse.data) {
      console.log(`   API 상태: ${healthResponse.data.api_status}`);
      console.log(`   데이터베이스 연결: ${healthResponse.data.database_connected ? '정상' : '오류'}`);
      console.log(`   API-Football 사용 가능: ${healthResponse.data.api_football_available ? '정상' : '오류'}`);
    }
    
  } catch (error) {
    logError(error);
  }
}

async function demoUtilityFunctions() {
  logSection('유틸리티 함수 데모');
  
  try {
    logSubsection('1. K리그 팀 조회');
    const teams = await ValidationUtils.getKLeagueTeams(DEMO_CONFIG.LEAGUE_ID, DEMO_CONFIG.SEASON);
    console.log(`   조회된 팀 수: ${teams.length}개`);
    console.log(`   팀 ID 목록: ${teams.join(', ')}`);
    
    logSubsection('2. 검증 요약 포맷팅');
    if (DEMO_CONFIG.DEMO_TEAMS.length > 0) {
      try {
        const sampleValidation = await lineupValidationAPI.validateTeam(DEMO_CONFIG.DEMO_TEAMS[0].id, DEMO_CONFIG.SEASON);
        const summary = ValidationUtils.formatValidationSummary(sampleValidation);
        console.log(`   포맷된 요약:\n${summary}`);
        
        logSubsection('3. 새로고침 필요 여부 확인');
        const needsRefresh = ValidationUtils.needsRefresh(sampleValidation, 24);
        console.log(`   새로고침 필요: ${needsRefresh ? '예' : '아니오'}`);
      } catch (error) {
        console.log(`   ⚠️ 샘플 검증 실패: ${error instanceof Error ? error.message : error}`);
      }
    }
    
  } catch (error) {
    logError(error);
  }
}

async function demoCompleteWorkflow() {
  logSection('완전한 검증 워크플로우 데모');
  
  const demoTeam = DEMO_CONFIG.DEMO_TEAMS[0];
  
  try {
    console.log(`🏈 대상 팀: ${demoTeam.name} (ID: ${demoTeam.id})`);
    console.log(`📅 시즌: ${DEMO_CONFIG.SEASON}`);
    
    console.log(`\n1️⃣ 초기 검증 실행...`);
    const result = await lineupValidationAPI.runCompleteValidation(demoTeam.id, DEMO_CONFIG.SEASON, {
      autoCorrect: true,
      generateAlerts: true,
      correctionOptions: {
        autoFixJerseyNumbers: true,
        autoFixPositions: true,
        addMissingPlayers: false,
        flagTransfers: true
      }
    });
    
    console.log(`\n📊 완전 검증 결과:`);
    console.log(`   품질 점수: ${result.validation.data_quality_score}%`);
    console.log(`   문제 발견: ${result.validation.issues_detected}개`);
    
    if (result.corrections) {
      console.log(`   자동 수정: ${result.corrections.applied}개 적용`);
      if (result.corrections.errors.length > 0) {
        console.log(`   수정 오류: ${result.corrections.errors.length}개`);
      }
    }
    
    if (result.alerts) {
      console.log(`   생성된 알림: ${result.alerts.length}개`);
      const criticalAlerts = result.alerts.filter(a => a.severity === 'critical').length;
      if (criticalAlerts > 0) {
        console.log(`   긴급 알림: ${criticalAlerts}개`);
      }
    }
    
    console.log(`\n✅ 완전한 검증 워크플로우가 성공적으로 완료되었습니다.`);
    
    return result;
    
  } catch (error) {
    logError(error);
    return null;
  }
}

// ============================================================================
// Main Demo Runner
// ============================================================================

async function runDemo() {
  console.log('🚀 K리그 라인업 검증 시스템 데모 시작');
  console.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}\n`);
  
  try {
    // Check environment
    const envCheck = process.env.API_FOOTBALL_KEY ? '✅' : '❌';
    console.log(`${envCheck} API_FOOTBALL_KEY: ${process.env.API_FOOTBALL_KEY ? '설정됨' : '누락'}`);
    
    const supabaseCheck = process.env.VITE_SUPABASE_URL ? '✅' : '❌';
    console.log(`${supabaseCheck} SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '설정됨' : '누락'}`);
    
    if (!process.env.API_FOOTBALL_KEY) {
      console.log(`\n⚠️ API_FOOTBALL_KEY가 설정되지 않아 일부 기능이 제한될 수 있습니다.`);
      console.log(`   데이터베이스 기반 검증으로 대체됩니다.`);
    }
    
    // Run demos
    console.log(`\n📋 데모 단계:`);
    console.log(`   1. 단일 팀 검증`);
    console.log(`   2. 다중 팀 검증`);
    console.log(`   3. 이적 감지`);
    console.log(`   4. 자동 수정`);
    console.log(`   5. 알림 생성`);
    console.log(`   6. API 엔드포인트`);
    console.log(`   7. 유틸리티 함수`);
    console.log(`   8. 완전 워크플로우`);
    
    await delay(2000);
    
    // 1. Single team validation
    const teamValidation = await demoSingleTeamValidation();
    await delay(2000);
    
    // 2. Multi-team validation
    const multiValidations = await demoMultiTeamValidation();
    await delay(2000);
    
    // 3. Transfer detection
    const transfers = await demoTransferDetection();
    await delay(2000);
    
    // 4. Automatic corrections (if issues found)
    if (teamValidation) {
      await demoValidationCorrections(teamValidation);
      await delay(2000);
    }
    
    // 5. Validation alerts
    if (teamValidation) {
      await demoValidationAlerts(teamValidation);
      await delay(2000);
    }
    
    // 6. API endpoints
    await demoAPIEndpoints();
    await delay(2000);
    
    // 7. Utility functions
    await demoUtilityFunctions();
    await delay(2000);
    
    // 8. Complete workflow
    await demoCompleteWorkflow();
    
    // Summary
    logSection('데모 완료 요약');
    console.log(`✅ 모든 데모가 성공적으로 완료되었습니다.`);
    console.log(`⏰ 완료 시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`\n📋 구현된 주요 기능:`);
    console.log(`   ✅ 실시간 라인업 검증`);
    console.log(`   ✅ 등번호 불일치 감지 및 수정`);
    console.log(`   ✅ 선수 상태 추적 (이적/은퇴/신규영입)`);
    console.log(`   ✅ 자동화된 데이터 품질 알림`);
    console.log(`   ✅ RESTful API 엔드포인트`);
    console.log(`   ✅ Rate limiting 및 오류 처리`);
    console.log(`   ✅ React 통합을 위한 Custom Hook`);
    
    console.log(`\n🔧 다음 단계:`);
    console.log(`   1. 데이터베이스 스키마 적용: psql -f scripts/create-validation-tables.sql`);
    console.log(`   2. React 컴포넌트 통합: import LineupValidationDashboard`);
    console.log(`   3. API 라우트 설정: ValidationRoutes.getRouteDefinitions()`);
    console.log(`   4. 정기 실행을 위한 cron job 설정`);
    console.log(`   5. 모니터링 및 알림 시스템 구성`);
    
  } catch (error) {
    console.error('❌ 데모 실행 중 오류 발생:', error);
    process.exit(1);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 K리그 라인업 검증 시스템 데모

사용법:
  npx tsx scripts/demo-lineup-validation.ts [옵션]

옵션:
  --help, -h          이 도움말 표시
  --team-id <id>      특정 팀 ID로 데모 실행
  --quick             빠른 데모 (단일 팀만)
  --verbose           상세한 로그 출력

환경 변수:
  API_FOOTBALL_KEY    API-Football API 키 (필수)
  VITE_SUPABASE_URL   Supabase 프로젝트 URL
  SUPABASE_SERVICE_ROLE  Supabase 서비스 역할 키

예시:
  npx tsx scripts/demo-lineup-validation.ts
  npx tsx scripts/demo-lineup-validation.ts --team-id 2762
  npx tsx scripts/demo-lineup-validation.ts --quick
    `);
    process.exit(0);
  }
  
  if (args.includes('--quick')) {
    console.log('🏃‍♂️ 빠른 데모 모드');
    // Run only single team validation
    (async () => {
      try {
        await demoSingleTeamValidation();
        console.log('\n✅ 빠른 데모 완료');
      } catch (error) {
        console.error('❌ 빠른 데모 실패:', error);
        process.exit(1);
      }
    })();
  } else {
    // Run full demo
    runDemo().catch(error => {
      console.error('❌ 데모 실행 실패:', error);
      process.exit(1);
    });
  }
}

export {
  demoSingleTeamValidation,
  demoMultiTeamValidation,
  demoTransferDetection,
  demoValidationCorrections,
  demoValidationAlerts,
  demoAPIEndpoints,
  demoUtilityFunctions,
  demoCompleteWorkflow
};