import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkK2TopScorers() {
  console.log('🔍 Top 10 Scorers (K League 2 - 2025):\n');

  const { data: scorers } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .order('goals', { ascending: false })
    .order('assists', { ascending: false })
    .limit(10);

  if (scorers && scorers.length > 0) {
    scorers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.strPlayer} (${player.strTeam})`);
      console.log(`   Goals: ${player.goals} | Assists: ${player.assists} | Cards: ${player.yellow_cards}Y ${player.red_cards}R`);
      console.log(`   Player ID: ${player.idPlayer} | Team ID: ${player.idTeam}\n`);
    });
  } else {
    console.log('❌ 데이터가 없습니다.\n');
  }

  console.log('\n🎯 Top 10 Assisters (K League 2 - 2025):\n');

  const { data: assisters } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .order('assists', { ascending: false })
    .order('goals', { ascending: false })
    .limit(10);

  if (assisters && assisters.length > 0) {
    assisters.forEach((player, index) => {
      console.log(`${index + 1}. ${player.strPlayer} (${player.strTeam})`);
      console.log(`   Assists: ${player.assists} | Goals: ${player.goals} | Cards: ${player.yellow_cards}Y ${player.red_cards}R\n`);
    });
  } else {
    console.log('❌ 데이터가 없습니다.\n');
  }

  // 전체 통계
  const { data: allPlayers, count } = await supabase
    .from('player_statistics')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strSeason', '2025');

  const totalGoals = allPlayers?.reduce((sum, p) => sum + p.goals, 0) || 0;

  console.log('\n📊 Total Statistics:');
  console.log(`Total players: ${count}`);
  console.log(`Total goals recorded: ${totalGoals}`);
}

checkK2TopScorers().catch(console.error);
