import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY || "test-anon";
const apiKey = process.env.API_FOOTBALL_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

interface APIFootballPlayerStats {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: {
      date: string;
      place: string | null;
      country: string;
    };
    nationality: string;
    height: string;
    weight: string;
    injured: boolean;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
    };
    games: {
      appearences: number;
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
    };
    goals: {
      total: number | null;
      conceded: number;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: number | null;
    };
    cards: {
      yellow: number;
      yellowred: number;
      red: number;
    };
    penalty: {
      won: number | null;
      commited: number | null;
      scored: number | null;
      missed: number | null;
      saved: number | null;
    };
  }>;
}

async function importTopScorers(leagueId: number, seasonYear: number) {
  console.log(`🏆 득점왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

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
      console.log('  ⚠️ 득점왕 데이터 없음');
      return;
    }

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
        player_rating: stats.games.rating ? parseFloat(stats.games.rating) : null,
      };
    });

    const { error } = await supabase
      .from('top_scorers')
      .upsert(scorersData, {
        onConflict: 'league_id,season_year,player_id',
      });

    if (error) {
      console.error('  ❌ 득점왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${scorersData.length}명 득점왕 순위 임포트 완료`);
    }
  } catch (error) {
    console.error('  ❌ 득점왕 API 호출 에러:', error);
  }
}

async function importTopAssists(leagueId: number, seasonYear: number) {
  console.log(`🎯 도움왕 임포트... (리그: ${leagueId}, 시즌: ${seasonYear})`);

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
      console.log('  ⚠️ 도움왕 데이터 없음');
      return;
    }

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
        player_rating: stats.games.rating ? parseFloat(stats.games.rating) : null,
      };
    });

    const { error } = await supabase
      .from('top_assists')
      .upsert(assistsData, {
        onConflict: 'league_id,season_year,player_id',
      });

    if (error) {
      console.error('  ❌ 도움왕 임포트 에러:', error);
    } else {
      console.log(`  ✅ ${assistsData.length}명 도움왕 순위 임포트 완료`);
    }
  } catch (error) {
    console.error('  ❌ 도움왕 API 호출 에러:', error);
  }
}

async function main() {
  console.log('🔥 득점왕 및 도움왕 데이터 임포트 시작');
  console.log('======================================================================');

  const seasonYear = parseInt(process.env.SEASON_YEAR || '2025');
  const leagues = [
    { id: 292, name: 'K League 1' },
    { id: 293, name: 'K League 2' }
  ];

  console.log(`📅 시즌: ${seasonYear}`);
  console.log(`🏆 리그: ${leagues.map(l => l.name).join(', ')}\n`);

  for (const league of leagues) {
    console.log(`\n${league.name} (${league.id}) 처리 중...`);
    await importTopScorers(league.id, seasonYear);
    await importTopAssists(league.id, seasonYear);
  }

  console.log('\n======================================================================');
  console.log('🎉 득점왕 및 도움왕 임포트 완료!');
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ 임포트 실패:', error);
    process.exit(1);
  });
}

export { importTopScorers, importTopAssists };