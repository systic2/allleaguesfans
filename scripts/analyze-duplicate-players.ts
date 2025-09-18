import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function analyzeDuplicatePlayers() {
  console.log('🔍 중복 선수 분석 시작...');

  // Check data_source column if exists
  const { data: sourceData, error: sourceError } = await supabase
    .from('top_scorers')
    .select('data_source, count(*)', { count: 'exact' })
    .eq('league_id', 292)
    .eq('season_year', 2025);

  if (!sourceError && sourceData) {
    console.log('\n📊 데이터 소스별 분포:');
    const sourceCounts: any = {};
    for (const row of sourceData) {
      sourceCounts[row.data_source || 'null'] = (sourceCounts[row.data_source || 'null'] || 0) + 1;
    }
    console.log(sourceCounts);
  }

  // Analyze potential duplicates by team and similar goals
  const { data: scorers } = await supabase
    .from('top_scorers')
    .select('player_id, player_name, team_name, goals, rank_position, data_source')
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .order('goals', { ascending: false });

  console.log('\n🏆 현재 득점왕 데이터 (골수별 정렬):');
  scorers?.forEach((scorer, i) => {
    console.log(`${i + 1}. ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골 [ID:${scorer.player_id}] [Source: ${scorer.data_source || 'none'}]`);
  });

  // Find potential duplicates (same team + similar goals)
  console.log('\n🔍 잠재적 중복 선수 분석:');
  const teams: any = {};
  
  scorers?.forEach(scorer => {
    const key = `${scorer.team_name}_${scorer.goals}`;
    if (!teams[key]) teams[key] = [];
    teams[key].push(scorer);
  });

  let duplicatesFound = 0;
  Object.entries(teams).forEach(([key, players]: [string, any]) => {
    if (players.length > 1) {
      duplicatesFound++;
      const [teamName, goals] = key.split('_');
      console.log(`⚠️  ${teamName}에서 ${goals}골로 중복:`);
      players.forEach((p: any) => {
        console.log(`   - ${p.player_name} (ID: ${p.player_id}) [Source: ${p.data_source || 'none'}]`);
      });
    }
  });

  if (duplicatesFound === 0) {
    console.log('✅ 명백한 중복 없음 (팀별 골수 기준)');
  } else {
    console.log(`❌ ${duplicatesFound}개 중복 그룹 발견`);
  }

  // Similar analysis for assists
  console.log('\n🎯 도움왕 데이터 분석...');
  const { data: assists } = await supabase
    .from('top_assists')
    .select('player_id, player_name, team_name, assists, rank_position, data_source')
    .eq('league_id', 292)
    .eq('season_year', 2025)
    .order('assists', { ascending: false });

  console.log('\n🎯 현재 도움왕 데이터 (도움수별 정렬):');
  assists?.forEach((assist, i) => {
    console.log(`${i + 1}. ${assist.player_name} (${assist.team_name}) - ${assist.assists}도움 [ID:${assist.player_id}] [Source: ${assist.data_source || 'none'}]`);
  });
}

analyzeDuplicatePlayers();