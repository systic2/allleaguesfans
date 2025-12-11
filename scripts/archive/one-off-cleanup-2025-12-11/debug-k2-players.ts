import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function debugK2Players() {
  console.log('🔍 K League 2 선수 ID 확인\n');

  // Ilyuchenko
  const { data: ilyuchenko } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', '%Ilyuchenko%')
    .eq('idLeague', '4822');

  console.log('Ilyuchenko:');
  ilyuchenko?.forEach(p => {
    console.log(`  ${p.strPlayer} (ID: ${p.idPlayer}) | ${p.strTeam} | 골:${p.goals} 도움:${p.assists}`);
  });

  // Montano
  const { data: montano } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', '%Montano%')
    .eq('idLeague', '4822');

  console.log('\nMontano:');
  montano?.forEach(p => {
    console.log(`  ${p.strPlayer} (ID: ${p.idPlayer}) | ${p.strTeam} | 골:${p.goals} 도움:${p.assists}`);
  });

  // Euler
  const { data: euler } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', '%Euler%')
    .eq('idLeague', '4822');

  console.log('\nEuler:');
  if (euler && euler.length > 0) {
    euler.forEach(p => {
      console.log(`  ${p.strPlayer} (ID: ${p.idPlayer}) | ${p.strTeam} | 골:${p.goals} 도움:${p.assists}`);
    });
  } else {
    console.log('  ❌ Euler를 찾을 수 없습니다.');

    // 비슷한 이름 검색
    const { data: ansan } = await supabase
      .from('player_statistics')
      .select('*')
      .ilike('strTeam', '%Ansan%')
      .eq('idLeague', '4822')
      .gte('assists', 8);

    console.log('\n  Ansan Greeners 도움 많은 선수:');
    ansan?.forEach(p => {
      console.log(`    ${p.strPlayer} (ID: ${p.idPlayer}) | 골:${p.goals} 도움:${p.assists}`);
    });
  }
}

debugK2Players().catch(console.error);
