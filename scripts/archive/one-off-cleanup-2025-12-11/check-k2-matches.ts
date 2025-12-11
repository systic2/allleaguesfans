import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function checkK2Matches() {
  console.log('🔍 K League 2 경기 확인\n');

  // K League 2 경기 조회 (idLeague: 4690)
  const { data: events, count } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('idLeague', '4690')
    .eq('strSeason', '2025')
    .order('dateEvent', { ascending: true });

  console.log(`📊 K League 2 경기 현황:`);
  console.log(`  총 경기: ${count}개`);

  if (events && events.length > 0) {
    const withMatchId = events.filter(e => e.highlightly_match_id);
    const withoutMatchId = events.filter(e => !e.highlightly_match_id);

    console.log(`  Highlightly 매핑됨: ${withMatchId.length}개`);
    console.log(`  Highlightly 매핑안됨: ${withoutMatchId.length}개\n`);

    if (withoutMatchId.length > 0) {
      console.log('📋 매핑되지 않은 경기 샘플 (최대 5개):');
      withoutMatchId.slice(0, 5).forEach(e => {
        console.log(`  - ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
      });
      console.log();
    }
  }

  // Highlightly API에서 K League 2 경기 확인
  console.log('🌐 Highlightly API에서 K League 2 경기 검색...\n');

  const url = new URL('https://sports.highlightly.net/football/matches');
  url.searchParams.append('countryCode', 'KR');
  url.searchParams.append('season', '2025');
  url.searchParams.append('leagueName', 'K League 2');
  url.searchParams.append('offset', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  const data = await response.json();
  const matches = data.data || [];

  console.log(`📡 Highlightly API K League 2 경기: ${matches.length}개`);

  if (matches.length > 0) {
    console.log('\n샘플 경기 (최대 5개):');
    matches.slice(0, 5).forEach((m: any) => {
      console.log(`  - ${m.date} | ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    });
  } else {
    console.log('⚠️  Highlightly API에 K League 2 경기가 없습니다.');
  }
}

checkK2Matches().catch(console.error);
