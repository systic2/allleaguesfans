#!/usr/bin/env tsx

/**
 * 3-API 통합 완료 후 최종 데이터 품질 검증
 * K리그 공식 API + TheSportsDB + Highlightly 시스템 검증
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-anon";

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalDataQualityCheck() {
  console.log('🔍 3-API 통합 시스템 최종 데이터 품질 검증');
  console.log('=' + '='.repeat(60));
  console.log(`📅 검증 시간: ${new Date().toISOString()}`);
  console.log('');

  try {
    // 1. 기본 데이터 통계
    console.log('📊 기본 데이터 통계...');
    const [
      { count: teamsCount },
      { count: playersCount },
      { count: fixturesCount },
      { count: topScorersCount },
      { count: topAssistsCount }
    ] = await Promise.all([
      supabase.from('teams').select('*', { count: 'exact' }),
      supabase.from('players').select('*', { count: 'exact' }),
      supabase.from('fixtures').select('*', { count: 'exact' }),
      supabase.from('top_scorers').select('*', { count: 'exact' }).eq('season_year', 2025),
      supabase.from('top_assists').select('*', { count: 'exact' }).eq('season_year', 2025)
    ]);

    console.log(`   팀: ${teamsCount}개`);
    console.log(`   선수: ${playersCount}명`);
    console.log(`   경기: ${fixturesCount}개`);
    console.log(`   2025 득점왕: ${topScorersCount}개`);
    console.log(`   2025 도움왕: ${topAssistsCount}개`);

    // 2. K리그 핵심 데이터 품질 검증
    console.log('\n🏆 K리그 핵심 데이터 검증...');
    
    // K리그1, K리그2 득점왕 검증
    for (const leagueId of [292, 293]) {
      const leagueName = leagueId === 292 ? 'K리그1' : 'K리그2';
      
      const { data: scorers } = await supabase
        .from('top_scorers')
        .select('player_name, team_name, goals')
        .eq('league_id', leagueId)
        .eq('season_year', 2025)
        .order('goals', { ascending: false })
        .limit(5);

      const { data: assists } = await supabase
        .from('top_assists')
        .select('player_name, team_name, assists')
        .eq('league_id', leagueId)
        .eq('season_year', 2025)
        .order('assists', { ascending: false })
        .limit(5);

      console.log(`\n🏆 ${leagueName} Top 5 득점왕:`);
      scorers?.forEach((scorer, index) => {
        const playerName = scorer.player_name || '[이름 없음]';
        const isComplete = scorer.player_name && scorer.player_name.trim() !== '';
        const status = isComplete ? '✅' : '❌';
        console.log(`   ${status} ${index + 1}. ${playerName} (${scorer.team_name}) - ${scorer.goals}골`);
      });

      console.log(`\n🎯 ${leagueName} Top 5 도움왕:`);
      assists?.forEach((assist, index) => {
        const playerName = assist.player_name || '[이름 없음]';
        const isComplete = assist.player_name && assist.player_name.trim() !== '';
        const status = isComplete ? '✅' : '❌';
        console.log(`   ${status} ${index + 1}. ${playerName} (${assist.team_name}) - ${assist.assists}도움`);
      });
    }

    // 3. 데이터 품질 메트릭
    console.log('\n📈 데이터 품질 메트릭...');
    
    const [
      { count: teamsWithLogos },
      { count: playersWithPhotos },
      { count: scorersWithNames },
      { count: assistsWithNames }
    ] = await Promise.all([
      supabase.from('teams').select('*', { count: 'exact' }).not('logo_url', 'is', null),
      supabase.from('players').select('*', { count: 'exact' }).not('photo', 'is', null),
      supabase.from('top_scorers').select('*', { count: 'exact' })
        .eq('season_year', 2025).not('player_name', 'is', null).neq('player_name', ''),
      supabase.from('top_assists').select('*', { count: 'exact' })
        .eq('season_year', 2025).not('player_name', 'is', null).neq('player_name', '')
    ]);

    const logoPercentage = teamsCount ? (teamsWithLogos / teamsCount * 100).toFixed(1) : '0';
    const photoPercentage = playersCount ? (playersWithPhotos / playersCount * 100).toFixed(1) : '0';
    const scorerNamesPercentage = topScorersCount ? (scorersWithNames / topScorersCount * 100).toFixed(1) : '0';
    const assistNamesPercentage = topAssistsCount ? (assistsWithNames / topAssistsCount * 100).toFixed(1) : '0';

    console.log(`   팀 로고 완성도: ${teamsWithLogos}/${teamsCount} (${logoPercentage}%)`);
    console.log(`   선수 사진 완성도: ${playersWithPhotos}/${playersCount} (${photoPercentage}%)`);
    console.log(`   득점왕 이름 완성도: ${scorersWithNames}/${topScorersCount} (${scorerNamesPercentage}%)`);
    console.log(`   도움왕 이름 완성도: ${assistsWithNames}/${topAssistsCount} (${assistNamesPercentage}%)`);

    // 4. API 소스별 데이터 분포
    console.log('\n🔗 API 소스별 데이터 분포...');
    
    const { data: dataSources } = await supabase
      .from('teams')
      .select('data_source')
      .not('data_source', 'is', null);

    const sourceCount = dataSources?.reduce((acc, team) => {
      acc[team.data_source] = (acc[team.data_source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    Object.entries(sourceCount).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}팀`);
    });

    // 5. 최근 경기 데이터 확인
    console.log('\n📅 최근 경기 데이터...');
    
    const { data: recentFixtures } = await supabase
      .from('fixtures')
      .select('id, date_utc, status_short, home_goals, away_goals')
      .order('date_utc', { ascending: false })
      .limit(10);

    if (recentFixtures && recentFixtures.length > 0) {
      console.log(`   최근 ${recentFixtures.length}경기:`);
      recentFixtures.slice(0, 5).forEach((fixture, index) => {
        const date = new Date(fixture.date_utc).toLocaleDateString('ko-KR');
        const score = fixture.home_goals !== null && fixture.away_goals !== null 
          ? `${fixture.home_goals}-${fixture.away_goals}` 
          : fixture.status_short;
        console.log(`   ${index + 1}. ${date} - ${score} (${fixture.status_short})`);
      });
    }

    // 6. 데이터 신선도 확인
    console.log('\n⏰ 데이터 신선도...');
    
    const { data: lastSync } = await supabase
      .from('teams')
      .select('last_sync_highlightly, updated_at')
      .not('last_sync_highlightly', 'is', null)
      .order('last_sync_highlightly', { ascending: false })
      .limit(1);

    if (lastSync && lastSync.length > 0) {
      const lastSyncTime = new Date(lastSync[0].last_sync_highlightly);
      const now = new Date();
      const hoursSinceSync = Math.floor((now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60));
      
      console.log(`   마지막 동기화: ${lastSyncTime.toLocaleString('ko-KR')} (${hoursSinceSync}시간 전)`);
    }

    // 7. 종합 평가
    console.log('\n🎯 종합 평가...');
    
    const qualityScores = {
      basicData: teamsCount > 20 && playersCount > 100 ? 100 : 50,
      kLeagueStats: (parseFloat(scorerNamesPercentage) + parseFloat(assistNamesPercentage)) / 2,
      mediaContent: parseFloat(logoPercentage),
      dataFreshness: lastSync && lastSync.length > 0 ? 80 : 20
    };

    const overallScore = Object.values(qualityScores).reduce((sum, score) => sum + score, 0) / Object.keys(qualityScores).length;

    console.log(`   기본 데이터 품질: ${qualityScores.basicData.toFixed(1)}점`);
    console.log(`   K리그 통계 완성도: ${qualityScores.kLeagueStats.toFixed(1)}점`);
    console.log(`   미디어 콘텐츠: ${qualityScores.mediaContent.toFixed(1)}점`);
    console.log(`   데이터 신선도: ${qualityScores.dataFreshness.toFixed(1)}점`);
    console.log(`   🏆 종합 점수: ${overallScore.toFixed(1)}점`);

    // 8. 성공/개선 제안
    console.log('\n✅ 성공한 부분:');
    if (qualityScores.basicData >= 80) console.log('   • 기본 데이터 구조 완성');
    if (qualityScores.kLeagueStats >= 70) console.log('   • K리그 공식 통계 데이터 품질 우수');
    if (topScorersCount >= 10) console.log('   • 득점왕/도움왕 순위 데이터 완비');
    
    console.log('\n🔧 개선 가능 영역:');
    if (qualityScores.mediaContent < 50) console.log('   • 팀 로고 및 선수 사진 보강 필요');
    if (qualityScores.kLeagueStats < 90) console.log('   • 일부 선수 이름 데이터 보완 필요');
    if (qualityScores.dataFreshness < 60) console.log('   • 실시간 데이터 동기화 개선 필요');

    console.log('\n🎉 3-API 통합 시스템 최종 검증 완료!');
    console.log(`📊 전체적으로 ${overallScore >= 70 ? '우수한' : overallScore >= 50 ? '양호한' : '개선이 필요한'} 품질의 데이터 시스템 구축 완료`);
    
  } catch (error) {
    console.error('❌ 데이터 품질 검증 실패:', error);
    throw error;
  }
}

if (import.meta.main) {
  finalDataQualityCheck().catch((error) => {
    console.error('❌ 최종 품질 검증 실패:', error);
    process.exit(1);
  });
}