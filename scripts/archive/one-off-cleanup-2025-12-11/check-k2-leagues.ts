import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkK2Leagues() {
  console.log('🔍 K League 리그 정보 확인\n');

  const { data } = await supabase
    .from('leagues')
    .select('*')
    .ilike('strLeague', '%K League%');

  if (data && data.length > 0) {
    data.forEach(l => {
      console.log(`  ${l.strLeague} (ID: ${l.idLeague})`);
      console.log(`    Country: ${l.strCountry}`);
      console.log(`    Sport: ${l.strSport}`);
      console.log();
    });
  } else {
    console.log('❌ K League 리그 정보가 없습니다.');
  }
}

checkK2Leagues().catch(console.error);
