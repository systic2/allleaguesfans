import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

interface APIFootballPlayerStats {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      rating: string | null;
    };
    goals: {
      total: number | null;
      assists: number | null;
    };
    passes: {
      key: number | null;
    };
    cards: {
      yellow: number;
      red: number;
    };
    penalty: {
      scored: number | null;
      missed: number | null;
    };
  }>;
}

async function clearExistingData(leagueId: number, seasonYear: number) {
  console.log(`🧹 기존 데이터 정리... (리그: ${leagueId}, 시즌: ${seasonYear})`);

  // Delete existing data for this league and season
  const { error: deleteScorersError, count: deletedScorers } = await supabase
    .from('top_scorers')
    .delete({ count: 'exact' })
    .eq('league_id', leagueId)
    .eq('season_year', seasonYear);

  if (deleteScorersError) {
    console.error('❌ 기존 득점왕 데이터 삭제 실패:', deleteScorersError);
  } else {
    console.log(`✅ ${deletedScorers}개 기존 득점왕 데이터 삭제됨`);
  }

  const { error: deleteAssistsError, count: deletedAssists } = await supabase
    .from('top_assists')
    .delete({ count: 'exact' })
    .eq('league_id', leagueId)
    .eq('season_year', seasonYear);

  if (deleteAssistsError) {
    console.error('❌ 기존 도움왕 데이터 삭제 실패:', deleteAssistsError);
  } else {
    console.log(`✅ ${deletedAssists}개 기존 도움왕 데이터 삭제됨`);
  }
}

async function importTopScorersFromAPIFootball(leagueId: number, seasonYear: number) {
  console.log(`🏆 API-Football에서 득점왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/players/topscorers?season=${seasonYear}&league=${leagueId}`,
      {
        headers: {
          'x-rapidapi-key': apiKey!,
        },
      }
    );

    const data = await response.json();
    
    if (!data.response || data.response.length === 0) {
      console.log('  ⚠️ API-Football 득점왕 데이터 없음');
      return;
    }

    console.log(`  📊 API-Football에서 ${data.response.length}명의 득점왕 데이터 조회됨`);

    const scorersData = data.response.map((item: APIFootballPlayerStats, index: number) => {
      const stats = item.statistics[0]; // First team/league stats
      return {
        league_id: leagueId,
        season_year: seasonYear,
        player_id: item.player.id,
        player_name: item.player.name,
        player_photo: item.player.photo,
        team_id: stats.team.id,
        team_name: stats.team.name,
        team_logo: stats.team.logo,
        rank_position: index + 1,
        goals: stats.goals.total || 0,
        assists: stats.goals.assists || 0,
        appearances: stats.games.appearences || 0,
        minutes: stats.games.minutes || 0,
        penalties_scored: stats.penalty.scored || 0,
        penalties_missed: stats.penalty.missed || 0,
        yellow_cards: stats.cards.yellow || 0,
        red_cards: stats.cards.red || 0,
        player_rating: stats.games.rating ? parseFloat(stats.games.rating) : null
      };
    });

    const { error } = await supabase
      .from('top_scorers')
      .insert(scorersData);

    if (error) {
      console.error('  ❌ API-Football 득점왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${scorersData.length}명 API-Football 득점왕 순위 임포트 완료`);
      
      // Show top 10 for verification
      console.log('  📊 TOP 10 득점왕:');
      scorersData.slice(0, 10).forEach((scorer, i) => {
        console.log(`    ${i + 1}. ${scorer.player_name} (${scorer.team_name}) - ${scorer.goals}골`);
      });
    }
  } catch (error) {
    console.error('  ❌ API-Football 득점왕 API 호출 에러:', error);
  }
}

async function importTopAssistsFromAPIFootball(leagueId: number, seasonYear: number) {
  console.log(`🎯 API-Football에서 도움왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/players/topassists?season=${seasonYear}&league=${leagueId}`,
      {
        headers: {
          'x-rapidapi-key': apiKey!,
        },
      }
    );

    const data = await response.json();
    
    if (!data.response || data.response.length === 0) {
      console.log('  ⚠️ API-Football 도움왕 데이터 없음');
      return;
    }

    console.log(`  📊 API-Football에서 ${data.response.length}명의 도움왕 데이터 조회됨`);

    const assistsData = data.response.map((item: APIFootballPlayerStats, index: number) => {
      const stats = item.statistics[0]; // First team/league stats
      return {
        league_id: leagueId,
        season_year: seasonYear,
        player_id: item.player.id,
        player_name: item.player.name,
        player_photo: item.player.photo,
        team_id: stats.team.id,
        team_name: stats.team.name,
        team_logo: stats.team.logo,
        rank_position: index + 1,
        assists: stats.goals.assists || 0,
        goals: stats.goals.total || 0,
        appearances: stats.games.appearences || 0,
        minutes: stats.games.minutes || 0,
        key_passes: stats.passes.key || 0,
        yellow_cards: stats.cards.yellow || 0,
        red_cards: stats.cards.red || 0,
        player_rating: stats.games.rating ? parseFloat(stats.games.rating) : null
      };
    });

    const { error } = await supabase
      .from('top_assists')
      .insert(assistsData);

    if (error) {
      console.error('  ❌ API-Football 도움왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${assistsData.length}명 API-Football 도움왕 순위 임포트 완료`);
      
      // Show top 10 for verification
      console.log('  📊 TOP 10 도움왕:');
      assistsData.slice(0, 10).forEach((assist, i) => {
        console.log(`    ${i + 1}. ${assist.player_name} (${assist.team_name}) - ${assist.assists}도움`);
      });
    }
  } catch (error) {
    console.error('  ❌ API-Football 도움왕 API 호출 에러:', error);
  }
}

async function main() {
  console.log('🔥 API-Football 전용 득점왕 및 도움왕 데이터 임포트 시작');
  console.log('📝 중복 데이터 제거 후 API-Football 데이터만 사용');
  console.log('======================================================================');

  const seasonYear = parseInt(process.env.SEASON_YEAR || '2025');
  const leagues = [
    { id: 292, name: 'K League 1' },
    { id: 293, name: 'K League 2' }
  ];

  console.log(`📅 시즌: ${seasonYear}`);
  console.log(`🏆 리그: ${leagues.map(l => l.name).join(', ')}`);
  console.log(`📊 데이터 소스: API-Football 전용\n`);

  for (const league of leagues) {
    console.log(`\n${league.name} (${league.id}) 처리 중...`);
    
    // 1. Clear existing data first
    await clearExistingData(league.id, seasonYear);
    
    // 2. Import fresh data from API-Football only
    await importTopScorersFromAPIFootball(league.id, seasonYear);
    await importTopAssistsFromAPIFootball(league.id, seasonYear);
  }

  console.log('\n======================================================================');
  console.log('🎉 API-Football 전용 득점왕 및 도움왕 임포트 완료!');
  console.log('✅ 모든 중복이 제거되고 API-Football 데이터만 남았습니다');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ 임포트 실패:', error);
    process.exit(1);
  });
}