import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('events')
    .select('idEvent, strHomeTeam, strAwayTeam, dateEvent, highlightly_match_id')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .order('dateEvent', { ascending: true });

  if (error) {
    console.error('오류:', error);
    return;
  }

  console.log(`\n📊 K League 1 총 경기: ${data?.length}개\n`);

  const withMapping = data?.filter(e => e.highlightly_match_id) || [];
  const withoutMapping = data?.filter(e => !e.highlightly_match_id) || [];

  console.log(`✅ highlightly_match_id 매핑 완료: ${withMapping.length}개`);
  console.log(`❌ highlightly_match_id 미매핑: ${withoutMapping.length}개\n`);

  if (withMapping.length > 0) {
    console.log('매핑 완료된 경기 샘플 (처음 5개):');
    withMapping.slice(0, 5).forEach(e => {
      console.log(`  - ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam} → ${e.highlightly_match_id}`);
    });
  }

  if (withoutMapping.length > 0) {
    console.log(`\n미매핑 경기 샘플 (처음 5개):`);
    withoutMapping.slice(0, 5).forEach(e => {
      console.log(`  - ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
    });
  }
}

check().catch(console.error);
