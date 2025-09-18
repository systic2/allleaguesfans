import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function cleanDuplicateTopStats() {
  console.log('🧹 중복 득점왕/도움왕 데이터 정리 시작...');

  try {
    // Clean top_scorers - remove records with empty player names when better records exist
    console.log('\n🥅 득점왕 테이블 정리 중...');
    
    // Delete records with empty player names
    const { error: cleanScorersError, count: deletedScorers } = await supabase
      .from('top_scorers')
      .delete({ count: 'exact' })
      .eq('player_name', '');

    if (cleanScorersError) {
      console.error('❌ 득점왕 정리 오류:', cleanScorersError);
    } else {
      console.log(`✅ ${deletedScorers}개 빈 이름 득점왕 레코드 삭제됨`);
    }

    // Clean top_assists - remove records with empty player names when better records exist
    console.log('\n🎯 도움왕 테이블 정리 중...');
    
    // Delete records with empty player names
    const { error: cleanAssistsError, count: deletedAssists } = await supabase
      .from('top_assists')
      .delete({ count: 'exact' })
      .eq('player_name', '');

    if (cleanAssistsError) {
      console.error('❌ 도움왕 정리 오류:', cleanAssistsError);
    } else {
      console.log(`✅ ${deletedAssists}개 빈 이름 도움왕 레코드 삭제됨`);
    }

    // Check final counts
    const { count: finalScorersCount } = await supabase
      .from('top_scorers')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', 292)
      .eq('season_year', 2025);

    const { count: finalAssistsCount } = await supabase
      .from('top_assists')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', 292)
      .eq('season_year', 2025);

    console.log(`\n📊 K League 1 (2025) 최종 데이터:`);
    console.log(`   득점왕: ${finalScorersCount || 0}개 레코드`);
    console.log(`   도움왕: ${finalAssistsCount || 0}개 레코드`);

    // Show top 5 to verify names are correct
    const { data: topScorers } = await supabase
      .from('top_scorers')
      .select('player_name, team_name, goals, rank_position')
      .eq('league_id', 292)
      .eq('season_year', 2025)
      .order('rank_position', { ascending: true })
      .limit(5);

    const { data: topAssists } = await supabase
      .from('top_assists')
      .select('player_name, team_name, assists, rank_position')
      .eq('league_id', 292)
      .eq('season_year', 2025)
      .order('rank_position', { ascending: true })
      .limit(5);

    console.log(`\n🏆 K League 1 (2025) TOP 5 득점왕:`);
    topScorers?.forEach((scorer, i) => {
      console.log(`${i + 1}. ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골`);
    });

    console.log(`\n🎯 K League 1 (2025) TOP 5 도움왕:`);
    topAssists?.forEach((assist, i) => {
      console.log(`${i + 1}. ${assist.player_name} (${assist.team_name}) - ${assist.assists}도움`);
    });

  } catch (error) {
    console.error('❌ 정리 과정에서 오류 발생:', error);
  }
}

cleanDuplicateTopStats();