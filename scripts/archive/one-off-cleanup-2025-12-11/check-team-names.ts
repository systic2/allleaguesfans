import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  const { data } = await supabase
    .from('teams')
    .select('strTeam')
    .eq('idLeague', '4689')
    .order('strTeam');

  console.log('K League 1 팀 이름 (TheSportsDB):');
  data?.forEach(t => console.log('  -', t.strTeam));
}

main();
