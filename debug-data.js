// debug-data.js - 데이터베이스 직접 조회
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

// 진우 선수의 골 이벤트 상세 조회
async function analyzeJinwooGoals() {
  console.log('🔍 진우 선수 골 이벤트 분석');
  
  // 먼저 Jeonbuk 팀 ID 찾기
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .ilike('name', '%jeonbuk%');
    
  console.log('Jeonbuk 팀:', team);
  
  if (team && team.length > 0) {
    const teamId = team[0].id;
    
    // 진우 선수 ID 찾기 (여러 패턴으로 시도)
    const searchPatterns = ['%jinwoo%', '%jin-woo%', '%jin woo%', '%jeon%'];
    
    for (const pattern of searchPatterns) {
      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .ilike('name', pattern)
        .eq('team_id', teamId);
        
      if (players && players.length > 0) {
        console.log(`진우 선수들 (${pattern}):`, players);
        break;
      }
    }
  }
  
  if (players && players.length > 0) {
    const jinwooId = players[0].id;
    
    // 진우의 모든 골 이벤트 조회
    const { data: goals } = await supabase
      .from('events')
      .select(`
        *,
        fixtures!inner(round, kickoff_utc, league_id, season_year)
      `)
      .eq('player_id', jinwooId)
      .eq('type', 'Goal')
      .eq('fixtures.league_id', 292)
      .eq('fixtures.season_year', 2025);
      
    console.log(`진우 골 이벤트 (${goals?.length || 0}개):`);
    goals?.forEach(goal => {
      console.log(`- Round ${goal.fixtures.round}: ${goal.fixtures.kickoff_utc}`);
    });
  }
}

// Compagno 선수 분석  
async function analyzeCompagnoGoals() {
  console.log('\n🔍 Compagno 선수 골 이벤트 분석');
  
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .ilike('name', '%compagno%');
    
  console.log('Compagno 선수들:', players);
  
  if (players && players.length > 0) {
    const playerId = players[0].id;
    
    const { data: goals } = await supabase
      .from('events')
      .select(`
        *,
        fixtures!inner(round, kickoff_utc, league_id, season_year)
      `)
      .eq('player_id', playerId)
      .eq('type', 'Goal')
      .eq('fixtures.league_id', 292)
      .eq('fixtures.season_year', 2025);
      
    console.log(`Compagno 골 이벤트 (${goals?.length || 0}개):`);
    goals?.forEach(goal => {
      console.log(`- Round ${goal.fixtures.round}: ${goal.fixtures.kickoff_utc}`);
    });
  }
}

// K리그2 주요 선수들 분석
async function analyzeK2TopScorers() {
  console.log('\n🔍 K리그2 주요 득점자 분석');
  
  // Stefan Mugosa 찾기
  const { data: mugosa } = await supabase
    .from('players')
    .select('id, name, team_id')
    .ilike('name', '%mugosa%');
    
  console.log('Mugosa 선수:', mugosa);
  
  // Leonardo Acevedo 찾기  
  const { data: leonardo } = await supabase
    .from('players')
    .select('id, name, team_id')
    .ilike('name', '%leonardo%');
    
  console.log('Leonardo 선수:', leonardo);
  
  if (mugosa && mugosa.length > 0) {
    const { data: goals } = await supabase
      .from('events')
      .select(`
        *,
        fixtures!inner(league_id, season_year)
      `)
      .eq('player_id', mugosa[0].id)
      .eq('type', 'Goal')
      .eq('fixtures.league_id', 293)
      .eq('fixtures.season_year', 2025);
      
    console.log(`Mugosa 골 이벤트: ${goals?.length || 0}개`);
  }
}

// 최근 라운드 데이터 확인
async function checkRecentRounds() {
  console.log('\n🔍 최근 라운드 데이터 확인');
  
  // K리그1 최근 경기들의 이벤트 수
  const { data: recentK1 } = await supabase
    .from('fixtures')
    .select(`
      id, round, kickoff_utc,
      events(count)
    `)
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .eq('status_short', 'FT')
    .order('kickoff_utc', { ascending: false })
    .limit(10);
    
  console.log('K리그1 최근 10경기 이벤트 수:');
  recentK1?.forEach(match => {
    console.log(`Round ${match.round}: ${match.events[0]?.count || 0} events`);
  });
}

async function main() {
  await analyzeJinwooGoals();
  await analyzeCompagnoGoals();
  await analyzeK2TopScorers();
  await checkRecentRounds();
}

main().catch(console.error);