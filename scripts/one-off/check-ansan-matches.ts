import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkAnsanMatches() {
  console.log('🔍 Ansan Greeners 경기 확인\n');
  
  // Ansan Greeners 경기 찾기
  const { data: events, error } = await supabase
    .from('events')
    .select('idEvent, strEvent, strHomeTeam, strAwayTeam, dateEvent, highlightly_match_id')
    .eq('idLeague', '4822')
    .or('strHomeTeam.ilike.%Ansan%,strAwayTeam.ilike.%Ansan%')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true })
    .limit(3);
    
  if (error || !events) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`찾은 경기: ${events.length}개\n`);
  
  // 첫 3경기의 이벤트 확인
  for (const event of events) {
    console.log(`\n📅 ${event.dateEvent} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
    console.log(`   Match ID: ${event.highlightly_match_id}`);
    
    try {
      const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });
      
      if (!response.ok) {
        console.log(`   ❌ API 오류: ${response.status}`);
        continue;
      }
      
      const matchEvents = await response.json();
      
      // 도움 이벤트만 필터링
      const assists = matchEvents.filter((e: any) => 
        e.type === 'goal' && e.assist && e.assist !== 'null'
      );
      
      console.log(`   ✅ 총 이벤트: ${matchEvents.length}개, 도움: ${assists.length}개`);
      
      if (assists.length > 0) {
        console.log(`   📊 도움 기록:`);
        assists.forEach((a: any) => {
          console.log(`      ${a.time}' ${a.player} (골) ← ${a.assist} (도움)`);
        });
      }
      
    } catch (err) {
      console.error(`   ❌ Error:`, err);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

checkAnsanMatches();
