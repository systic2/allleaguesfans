// verify-all-data.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function getTopScorers(leagueId, leagueName) {
  console.log(`\n=== ${leagueName} 득점왕 TOP 10 ===`);
  
  const { data: goalEvents, error } = await supabase
    .from("events")
    .select(`
      player_id,
      team_id,
      fixtures!inner(league_id, season_year)
    `)
    .eq("fixtures.league_id", leagueId)
    .eq("fixtures.season_year", 2025)
    .eq("type", "Goal")
    .not("player_id", "is", null);

  if (error || !goalEvents || goalEvents.length === 0) {
    console.log(`❌ ${leagueName} 골 데이터 없음`);
    return;
  }

  console.log(`총 골 이벤트: ${goalEvents.length}개`);

  // 선수별 골 집계
  const playerGoalCounts = goalEvents.reduce((acc, event) => {
    const playerId = event.player_id;
    if (!acc[playerId]) {
      acc[playerId] = { goals: 0, team_id: event.team_id };
    }
    acc[playerId].goals++;
    return acc;
  }, {});

  // 선수 정보 가져오기
  const playerIds = Object.keys(playerGoalCounts).map(Number);
  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  // 팀 정보 가져오기
  const teamIds = [...new Set(Object.values(playerGoalCounts).map(p => p.team_id))];
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  const playerMap = players?.reduce((acc, player) => {
    acc[player.id] = player;
    return acc;
  }, {}) || {};

  const teamMap = teams?.reduce((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {}) || {};

  // 최종 결과 구성
  const topScorers = Object.entries(playerGoalCounts)
    .map(([playerId, data]) => ({
      player_name: playerMap[Number(playerId)]?.name || "Unknown Player",
      team_name: teamMap[data.team_id]?.name || "Unknown Team",
      goals: data.goals,
    }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);

  topScorers.forEach((scorer, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    console.log(`${medal} ${rank}위: ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골`);
  });

  return topScorers;
}

async function getLeagueStats(leagueId, leagueName) {
  console.log(`\n=== ${leagueName} 전체 통계 ===`);
  
  // 경기 통계
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, status_short, goals_home, goals_away')
    .eq('league_id', leagueId)
    .eq('season_year', 2025);
    
  const totalFixtures = fixtures?.length || 0;
  const completedFixtures = fixtures?.filter(f => f.status_short === 'FT').length || 0;
  const totalGoals = fixtures?.reduce((sum, f) => 
    sum + (f.goals_home || 0) + (f.goals_away || 0), 0) || 0;
    
  // 팀 수
  const { data: standings } = await supabase
    .from('standings')
    .select('team_id')
    .eq('league_id', leagueId)
    .eq('season_year', 2025);
    
  const totalTeams = standings?.length || 0;
  
  // 이벤트 통계
  const { data: events } = await supabase
    .from('events')
    .select('type, fixtures!inner(league_id)')
    .eq('fixtures.league_id', leagueId);
    
  const totalEvents = events?.length || 0;
  const goalEvents = events?.filter(e => e.type === 'Goal').length || 0;
  
  console.log(`📊 팀 수: ${totalTeams}팀`);
  console.log(`⚽ 총 경기: ${totalFixtures}경기 (완료: ${completedFixtures}경기)`);
  console.log(`🥅 총 골: ${totalGoals}골`);
  console.log(`📝 총 이벤트: ${totalEvents}개`);
  console.log(`⚽ 골 이벤트: ${goalEvents}개`);
  console.log(`📈 경기당 평균 골: ${completedFixtures > 0 ? (totalGoals / completedFixtures).toFixed(2) : 0}골`);
  
  return {
    totalTeams,
    totalFixtures,
    completedFixtures, 
    totalGoals,
    totalEvents,
    goalEvents,
    avgGoalsPerMatch: completedFixtures > 0 ? +(totalGoals / completedFixtures).toFixed(2) : 0
  };
}

async function verifyAllData() {
  console.log('🔍 K리그 전체 데이터 검증 시작');
  console.log('=====================================');
  
  // K리그1 데이터 확인
  const k1Stats = await getLeagueStats(292, 'K리그1');
  const k1TopScorers = await getTopScorers(292, 'K리그1');
  
  // K리그2 데이터 확인
  const k2Stats = await getLeagueStats(293, 'K리그2');  
  const k2TopScorers = await getTopScorers(293, 'K리그2');
  
  console.log('\n🎯 검증 결과 요약');
  console.log('=====================================');
  
  console.log('\n📊 K리그1 vs K리그2 비교:');
  console.log(`K리그1: ${k1Stats.totalTeams}팀, ${k1Stats.completedFixtures}경기, ${k1Stats.goalEvents}골`);
  console.log(`K리그2: ${k2Stats.totalTeams}팀, ${k2Stats.completedFixtures}경기, ${k2Stats.goalEvents}골`);
  
  console.log('\n🏆 각 리그 득점왕:');
  if (k1TopScorers && k1TopScorers.length > 0) {
    console.log(`K리그1 득점왕: ${k1TopScorers[0].player_name} (${k1TopScorers[0].team_name}) - ${k1TopScorers[0].goals}골`);
  }
  if (k2TopScorers && k2TopScorers.length > 0) {
    console.log(`K리그2 득점왕: ${k2TopScorers[0].player_name} (${k2TopScorers[0].team_name}) - ${k2TopScorers[0].goals}골`);
  }
  
  console.log('\n✅ 검증 완료! 이제 K리그 공식 홈페이지와 비교해주세요.');
  console.log('🌐 K리그1: https://kleague.com/stats/kleague1');
  console.log('🌐 K리그2: https://kleague.com/stats/kleague2');
}

verifyAllData();