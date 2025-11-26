import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function debug() {
  // 먼저 Seoul E-Land 경기가 있는지 확인
  const { data: all, count } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strHomeTeam', 'Seoul E-Land');

  console.log('Seoul E-Land (홈): ', count, '개');

  const { data: away, count: awayCount } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strAwayTeam', 'Seoul E-Land');

  console.log('Seoul E-Land (원정): ', awayCount, '개');

  // highlightly_match_id가 있는 경기
  const { data: withId, count: withIdCount } = await supabase
    .from('events')
    .select('dateEvent, strHomeTeam, strAwayTeam, highlightly_match_id', { count: 'exact' })
    .eq('idLeague', '4822')
    .eq('strHomeTeam', 'Seoul E-Land')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent');

  console.log('Seoul E-Land (홈, match_id 있음): ', withIdCount, '개\n');

  withId?.slice(0, 5).forEach(e => {
    console.log(`  ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam} (${e.highlightly_match_id})`);
  });
}

debug();
