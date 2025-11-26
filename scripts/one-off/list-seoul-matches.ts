import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function listSeoulMatches() {
  console.log('🔍 Seoul E-Land 경기 목록\n');

  const { data: events, error } = await supabase
    .from('events')
    .select('dateEvent, strHomeTeam, strAwayTeam, highlightly_match_id')
    .eq('idLeague', '4822')
    .or('strHomeTeam.ilike.%Seoul%,strAwayTeam.ilike.%Seoul%')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`총 ${events?.length}개 경기\n`);

  const dates = ['2025-02-23', '2025-03-01', '2025-03-30', '2025-04-13', '2025-06-14', '2025-06-21', '2025-07-05', '2025-07-13', '2025-09-06', '2025-10-26'];

  events?.forEach(e => {
    const isEullerDate = dates.includes(e.dateEvent);
    const marker = isEullerDate ? '⭐' : '  ';
    console.log(`${marker} ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
  });
}

listSeoulMatches();
