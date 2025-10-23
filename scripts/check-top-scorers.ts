import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkTopScorers() {
  console.log('🔍 Top 10 Scorers (K League 1 - 2025):\n');

  const { data: scorers, error } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .order('goals', { ascending: false })
    .order('assists', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  scorers?.forEach((player, idx) => {
    console.log(`${idx + 1}. ${player.strPlayer} (${player.strTeam})`);
    console.log(`   Goals: ${player.goals} | Assists: ${player.assists} | Cards: ${player.yellow_cards}Y ${player.red_cards}R`);
    console.log(`   Player ID: ${player.idPlayer} | Team ID: ${player.idTeam}\n`);
  });

  console.log('\n🎯 Top 10 Assisters (K League 1 - 2025):\n');

  const { data: assisters } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .order('assists', { ascending: false })
    .order('goals', { ascending: false })
    .limit(10);

  assisters?.forEach((player, idx) => {
    console.log(`${idx + 1}. ${player.strPlayer} (${player.strTeam})`);
    console.log(`   Assists: ${player.assists} | Goals: ${player.goals} | Cards: ${player.yellow_cards}Y ${player.red_cards}R\n`);
  });

  console.log('\n📊 Total Statistics:');
  const { count } = await supabase
    .from('player_statistics')
    .select('*', { count: 'exact', head: true })
    .eq('strSeason', '2025');

  console.log(`Total players: ${count}`);

  const { data: totalGoals } = await supabase
    .from('player_statistics')
    .select('goals')
    .eq('strSeason', '2025');

  const total = totalGoals?.reduce((sum, p) => sum + (p.goals || 0), 0) || 0;
  console.log(`Total goals recorded: ${total}`);
}

checkTopScorers();
