// debug-data-fixed.js - 데이터베이스 상세 분석
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whoszwxxwgmpdfckmcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indob3N6d3h4d2dtcGRmY2ttY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MzM5NjAsImV4cCI6MjA3MjEwOTk2MH0.qfKqdCqQFhUMLTatH6F2u6ncnHTOMFoO1BvzaHA_Wto'
);

async function findAllPlayers() {
  console.log('🔍 전체 선수 데이터 분석');
  
  // 먼저 팀들 확인
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', [2762, 2767, 2764, 2750]); // Jeonbuk, Ulsan, Pohang, Daejeon
    
  console.log('주요 팀들:', teams);
  
  // Jeonbuk 선수들 찾기
  if (teams) {
    const jeonbuk = teams.find(t => t.name.includes('Jeonbuk'));
    if (jeonbuk) {
      const { data: jeonbukPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', jeonbuk.id)
        .limit(20);
        
      console.log('\nJeonbuk 선수들 (처음 20명):', jeonbukPlayers?.map(p => p.name));
      
      // 진우 찾기
      const jinwooPlayer = jeonbukPlayers?.find(p => 
        p.name.toLowerCase().includes('jin') && p.name.toLowerCase().includes('woo')
      );
      console.log('진우 선수:', jinwooPlayer);
    }
  }
}

async function checkMissingK2Players() {
  console.log('\n🔍 K리그2 누락 선수들 확인');
  
  // K리그2 팀들 확인
  const { data: k2teams } = await supabase
    .from('team_seasons')
    .select(`
      teams!inner(id, name)
    `)
    .eq('league_id', 293)
    .eq('season_year', 2025);
    
  console.log('K리그2 팀 수:', k2teams?.length);
  
  if (k2teams && k2teams.length > 0) {
    // Incheon 팀에서 Mugosa 찾기
    const incheon = k2teams.find(t => t.teams.name.includes('Incheon'));
    if (incheon) {
      console.log('Incheon 팀:', incheon.teams);
      
      const { data: incheonPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', incheon.teams.id);
        
      console.log('Incheon 선수들:', incheonPlayers?.map(p => p.name));
      
      const mugosa = incheonPlayers?.find(p => 
        p.name.toLowerCase().includes('mugosa') || p.name.toLowerCase().includes('stefan')
      );
      console.log('Mugosa 선수:', mugosa);
    }
    
    // Seongnam 팀에서 Leonardo 찾기
    const seongnam = k2teams.find(t => t.teams.name.includes('Seongnam'));
    if (seongnam) {
      console.log('Seongnam 팀:', seongnam.teams);
      
      const { data: seongnamPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', seongnam.teams.id);
        
      console.log('Seongnam 선수들:', seongnamPlayers?.map(p => p.name));
      
      const leonardo = seongnamPlayers?.find(p => 
        p.name.toLowerCase().includes('leonardo') || p.name.toLowerCase().includes('acevedo')
      );
      console.log('Leonardo 선수:', leonardo);
    }
  }
}

async function checkRecentEvents() {
  console.log('\n🔍 최근 라운드 이벤트 분석');
  
  // 최근 완료된 경기들 확인
  const { data: recentMatches } = await supabase
    .from('fixtures')
    .select(`
      id, round, kickoff_utc, status_short, league_id,
      home_team_id, away_team_id
    `)
    .eq('season_year', 2025)
    .eq('status_short', 'FT')
    .in('league_id', [292, 293])
    .order('kickoff_utc', { ascending: false })
    .limit(20);
    
  console.log('최근 완료된 20경기:');
  for (const match of recentMatches || []) {
    // 각 경기의 이벤트 수 확인
    const { data: events, count } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('fixture_id', match.id);
      
    console.log(`League ${match.league_id}, Round ${match.round}: ${count || 0} events`);
    
    if (count === 0 && match.league_id === 292) {
      console.log(`  ⚠️  이벤트 없는 K1 경기: ${match.id}`);
    }
  }
}

async function main() {
  await findAllPlayers();
  await checkMissingK2Players();
  await checkRecentEvents();
}

main().catch(console.error);