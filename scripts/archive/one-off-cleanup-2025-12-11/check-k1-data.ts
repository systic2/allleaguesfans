import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkK1Data() {
  // K League 1 득점 상위 10명
  const { data: scorers } = await supabase
    .from('player_statistics')
    .select('strPlayer, strTeam, goals')
    .eq('idLeague', '4328')
    .eq('strSeason', '2025')
    .order('goals', { ascending: false })
    .limit(10);

  console.log('⚽ K League 1 득점왕 TOP 10:\n');
  scorers?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.strPlayer} (${p.strTeam}) - ${p.goals}골`);
  });

  // K League 1 도움 상위 10명
  const { data: assisters } = await supabase
    .from('player_statistics')
    .select('strPlayer, strTeam, assists')
    .eq('idLeague', '4328')
    .eq('strSeason', '2025')
    .order('assists', { ascending: false })
    .limit(10);

  console.log('\n\n🎯 K League 1 도움왕 TOP 10:\n');
  assisters?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.strPlayer} (${p.strTeam}) - ${p.assists}도움`);
  });
}

checkK1Data().catch(console.error);
