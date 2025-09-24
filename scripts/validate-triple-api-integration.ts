#!/usr/bin/env tsx

/**
 * 3-API Integration Validation Script
 * 3-API 통합 시스템 검증 스크립트
 * 
 * Purpose: K League + TheSportsDB + Highlightly API 통합 상태를 검증
 * Usage: npx tsx scripts/validate-triple-api-integration.ts
 */

import { KLeagueAPI } from './lib/k-league-api.ts';
import { TheSportsDBPremiumAPI } from './lib/thesportsdb-premium-api.ts';
import { HighlightlyAPI } from './lib/highlightly-api.ts';
import { supa } from './lib/supabase.ts';

interface ValidationResult {
  api: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface IntegrationHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  results: ValidationResult[];
  dataQuality: {
    teams: number;
    fixtures: number;
    players: number;
    coverage: number; // 백분율
  };
}

async function validateKLeagueAPI(): Promise<ValidationResult> {
  try {
    const kLeagueAPI = new KLeagueAPI();
    console.log('🇰🇷 K League Official API 검증 중...');
    
    const teams = await kLeagueAPI.getTeams(2025);
    
    if (teams.length >= 12) { // K리그1 (12팀) + K리그2 (10팀) 기대
      return {
        api: 'K League Official',
        status: 'success',
        message: `K League API 정상 작동 (${teams.length}팀 확인)`,
        details: { teamCount: teams.length }
      };
    } else {
      return {
        api: 'K League Official',
        status: 'warning',
        message: `K League API 부분 작동 (${teams.length}팀만 확인)`,
        details: { teamCount: teams.length }
      };
    }
  } catch (error) {
    return {
      api: 'K League Official',
      status: 'error',
      message: `K League API 연결 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

async function validateTheSportsDBAPI(): Promise<ValidationResult> {
  try {
    const theSportsDBAPI = new TheSportsDBPremiumAPI();
    console.log('🏟️ TheSportsDB Premium API 검증 중...');
    
    // K League 정보 확인
    const leagues = await theSportsDBAPI.searchLeagues('K League');
    
    if (leagues.length > 0) {
      const leagueTeams = await theSportsDBAPI.getLeagueTeams(leagues[0].idLeague);
      
      return {
        api: 'TheSportsDB Premium',
        status: 'success',
        message: `TheSportsDB API 정상 작동 (리그 ${leagues.length}개, 팀 ${leagueTeams.length}개 확인)`,
        details: { leagueCount: leagues.length, teamCount: leagueTeams.length }
      };
    } else {
      return {
        api: 'TheSportsDB Premium',
        status: 'warning',
        message: 'TheSportsDB API 작동하나 K League 데이터 부족',
        details: { leagueCount: 0 }
      };
    }
  } catch (error) {
    return {
      api: 'TheSportsDB Premium',
      status: 'error',
      message: `TheSportsDB API 연결 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

async function validateHighlightlyAPI(): Promise<ValidationResult> {
  try {
    const highlightlyAPI = new HighlightlyAPI();
    console.log('⚡ Highlightly API 검증 중...');
    
    // 최근 매치 데이터 확인
    const recentMatches = await highlightlyAPI.getRecentMatches(5);
    
    if (recentMatches.length > 0) {
      return {
        api: 'Highlightly',
        status: 'success',
        message: `Highlightly API 정상 작동 (최근 매치 ${recentMatches.length}개 확인)`,
        details: { matchCount: recentMatches.length }
      };
    } else {
      return {
        api: 'Highlightly',
        status: 'warning',
        message: 'Highlightly API 작동하나 최근 매치 데이터 없음',
        details: { matchCount: 0 }
      };
    }
  } catch (error) {
    return {
      api: 'Highlightly',
      status: 'error',
      message: `Highlightly API 연결 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

async function validateDatabaseIntegration(): Promise<ValidationResult> {
  try {
    console.log('🗄️ 데이터베이스 통합 상태 검증 중...');
    
    // 각 API에서 온 데이터 확인
    const [
      { count: teamCount },
      { count: fixtureCount },
      { count: playerCount }
    ] = await Promise.all([
      supa.from('teams').select('*', { count: 'exact', head: true }),
      supa.from('fixtures').select('*', { count: 'exact', head: true }),
      supa.from('players').select('*', { count: 'exact', head: true })
    ]);

    const expectedTeams = 22; // K리그1 (12) + K리그2 (10)
    const expectedFixtures = 400; // 시즌당 대략적 경기 수
    const expectedPlayers = 600; // 팀당 약 25-30명

    const coverage = Math.min(100, 
      ((teamCount || 0) / expectedTeams * 100 + 
       (Math.min(fixtureCount || 0, expectedFixtures) / expectedFixtures * 100) + 
       (Math.min(playerCount || 0, expectedPlayers) / expectedPlayers * 100)) / 3
    );

    return {
      api: 'Database Integration',
      status: coverage >= 70 ? 'success' : coverage >= 40 ? 'warning' : 'error',
      message: `데이터베이스 통합 ${coverage.toFixed(1)}% 완료`,
      details: { 
        teams: teamCount || 0, 
        fixtures: fixtureCount || 0, 
        players: playerCount || 0,
        coverage: Math.round(coverage)
      }
    };
  } catch (error) {
    return {
      api: 'Database Integration',
      status: 'error',
      message: `데이터베이스 검증 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

async function validateApiSynchronization(): Promise<ValidationResult> {
  try {
    console.log('🔄 API 간 데이터 동기화 상태 검증 중...');
    
    // 데이터 일관성 검사
    const { data: teamsWithLogos } = await supa
      .from('teams')
      .select('id, name, logo_url, thesportsdb_id, k_league_id')
      .not('logo_url', 'is', null);
    
    const { data: fixturesWithHighlightly } = await supa
      .from('fixtures')
      .select('id, highlightly_match_id')
      .not('highlightly_match_id', 'is', null);
    
    const logosCoverage = (teamsWithLogos?.length || 0);
    const highlightlyCoverage = (fixturesWithHighlightly?.length || 0);
    
    const syncQuality = (logosCoverage * 2 + highlightlyCoverage) / 3; // 가중 평균
    
    return {
      api: 'API Synchronization',
      status: syncQuality >= 10 ? 'success' : syncQuality >= 5 ? 'warning' : 'error',
      message: `API 간 동기화 품질: 로고 ${logosCoverage}개, 실시간 ${highlightlyCoverage}개`,
      details: { 
        teamsWithLogos: logosCoverage,
        fixturesWithHighlightly: highlightlyCoverage,
        syncQuality: Math.round(syncQuality)
      }
    };
  } catch (error) {
    return {
      api: 'API Synchronization',
      status: 'error',
      message: `동기화 검증 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
}

async function validateTripleApiIntegration(): Promise<IntegrationHealth> {
  console.log('🚀 3-API 통합 시스템 종합 검증 시작\n');
  
  const results: ValidationResult[] = await Promise.all([
    validateKLeagueAPI(),
    validateTheSportsDBAPI(),
    validateHighlightlyAPI(),
    validateDatabaseIntegration(),
    validateApiSynchronization()
  ]);
  
  // 전체 상태 평가
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const successCount = results.filter(r => r.status === 'success').length;
  
  let overall: 'healthy' | 'degraded' | 'critical';
  if (errorCount === 0 && warningCount <= 1) {
    overall = 'healthy';
  } else if (errorCount <= 1 || warningCount <= 3) {
    overall = 'degraded';
  } else {
    overall = 'critical';
  }
  
  // 데이터 품질 정보 추출
  const dbResult = results.find(r => r.api === 'Database Integration');
  const dataQuality = dbResult?.details || { teams: 0, fixtures: 0, players: 0, coverage: 0 };
  
  return {
    overall,
    results,
    dataQuality
  };
}

function printResults(health: IntegrationHealth) {
  console.log('\n📊 3-API 통합 시스템 검증 결과');
  console.log('=====================================');
  
  // 전체 상태
  const statusEmoji = {
    healthy: '🟢',
    degraded: '🟡',
    critical: '🔴'
  };
  
  console.log(`\n${statusEmoji[health.overall]} 전체 시스템 상태: ${health.overall.toUpperCase()}`);
  
  // 각 API 상태
  console.log('\n📋 API별 상태:');
  health.results.forEach(result => {
    const emoji = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${emoji} ${result.api}: ${result.message}`);
  });
  
  // 데이터 품질
  console.log('\n📈 데이터 품질 현황:');
  console.log(`  Teams: ${health.dataQuality.teams} | Fixtures: ${health.dataQuality.fixtures} | Players: ${health.dataQuality.players}`);
  console.log(`  Overall Coverage: ${health.dataQuality.coverage}%`);
  
  // 권장사항
  console.log('\n💡 권장사항:');
  const errors = health.results.filter(r => r.status === 'error');
  const warnings = health.results.filter(r => r.status === 'warning');
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('  🎉 모든 시스템이 정상 작동 중입니다!');
  } else {
    if (errors.length > 0) {
      console.log('  🔥 긴급 조치 필요:');
      errors.forEach(error => console.log(`    - ${error.api} 오류 해결 필요`));
    }
    if (warnings.length > 0) {
      console.log('  ⚠️ 개선 권장사항:');
      warnings.forEach(warning => console.log(`    - ${warning.api} 최적화 검토`));
    }
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    const health = await validateTripleApiIntegration();
    const duration = Date.now() - startTime;
    
    printResults(health);
    
    console.log(`\n⏱️ 검증 완료 시간: ${(duration / 1000).toFixed(2)}초`);
    console.log(`🕒 검증 시각: ${new Date().toLocaleString('ko-KR')}`);
    
    // GitHub Actions에서 실행 시 결과 요약
    if (process.env.NODE_ENV === 'production') {
      console.log(`\n🎯 CI/CD Summary:`);
      console.log(`Status: ${health.overall}, Coverage: ${health.dataQuality.coverage}%, Duration: ${(duration / 1000).toFixed(2)}s`);
    }
    
    // 시스템이 critical 상태면 exit 1
    if (health.overall === 'critical') {
      console.log('\n💥 시스템이 critical 상태입니다. 즉시 점검이 필요합니다.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 3-API 통합 검증 실패:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}