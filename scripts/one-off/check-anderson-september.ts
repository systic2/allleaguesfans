import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function checkAndersonSeptember() {
  console.log('🔍 Anderson 9월 경기 확인\n');

  // Suwon FC 9월 경기 조회
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Suwon FC,strAwayTeam.eq.Suwon FC')
    .gte('dateEvent', '2025-09-01')
    .lte('dateEvent', '2025-09-30')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true });

  console.log(`📋 Suwon FC 9월 경기: ${events?.length}개\n`);

  for (const event of events || []) {
    const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) continue;

      const highlightlyEvents: any[] = await response.json();

      // Anderson의 도움 찾기
      const andersonAssists = highlightlyEvents.filter(ev =>
        (ev.type === 'Goal' || ev.type === 'Penalty') &&
        ev.assist &&
        (ev.assist?.toLowerCase().includes('anderson') ||
         ev.assist === 'Anderson Oliveira')
      );

      if (andersonAssists.length > 0) {
        console.log(`📅 ${event.dateEvent} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`   점수: ${event.intHomeScore}-${event.intAwayScore}`);
        console.log(`   Match ID: ${event.highlightly_match_id}`);
        andersonAssists.forEach((a, i) => {
          console.log(`   ${i + 1}. 도움 → ${a.player} (${a.type}) at ${a.time}'`);
        });
        console.log();
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      // Skip on error
    }
  }
}

checkAndersonSeptember().catch(console.error);
