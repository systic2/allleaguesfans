import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function debugAllAssists() {
  console.log('🔍 모든 도움 이벤트 분석\n');

  // 샘플 경기 몇 개만 확인
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .not('highlightly_match_id', 'is', null)
    .limit(5);

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

      // 골/페널티 이벤트만 확인
      const goalEvents = highlightlyEvents.filter(ev => ev.type === 'Goal' || ev.type === 'Penalty');

      console.log(`\n📋 ${event.dateEvent} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
      console.log(`   Total goal events: ${goalEvents.length}`);

      goalEvents.forEach(ev => {
        console.log(`\n   ⚽ ${ev.type}: ${ev.player}`);
        console.log(`      assist: "${ev.assist}" (type: ${typeof ev.assist}, truthy: ${!!ev.assist})`);
        console.log(`      assistingPlayerId: ${ev.assistingPlayerId} (type: ${typeof ev.assistingPlayerId})`);
        console.log(`      조건 통과: ${!!(ev.type === 'Goal' || ev.type === 'Penalty') && !!ev.assist && !!ev.assistingPlayerId}`);
      });

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
  }
}

debugAllAssists().catch(console.error);
