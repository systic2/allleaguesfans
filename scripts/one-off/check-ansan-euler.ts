import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkAnsanEuler() {
  console.log('🔍 Ansan Greeners 경기에서 Euler/Euller 찾기\n');
  
  // Ansan Greeners 경기 찾기
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4822')
    .or('strHomeTeam.eq.Ansan Greeners,strAwayTeam.eq.Ansan Greeners')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true })
    .limit(5);
    
  if (error || !events) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Ansan Greeners 경기: ${events.length}개\n`);
  
  let eulerFound = false;
  
  for (const event of events) {
    const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });
      
      if (!response.ok) continue;
      
      const matchEvents = await response.json();
      
      // Euler 또는 Euller 찾기
      const eulerEvents = matchEvents.filter((e: any) => 
        e.player?.toLowerCase().includes('eul') || 
        e.assist?.toLowerCase().includes('eul')
      );
      
      if (eulerEvents.length > 0) {
        eulerFound = true;
        console.log(`\n📅 ${event.dateEvent} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
        console.log(`   Match ID: ${event.highlightly_match_id}`);
        eulerEvents.forEach((e: any) => {
          console.log(`   ⚽ ${e.time}' ${e.type}: ${e.player} ${e.assist ? `(assist: ${e.assist})` : ''}`);
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error(`Error:`, err);
    }
  }
  
  if (!eulerFound) {
    console.log('\n❌ 첫 5경기에서 Euler/Euller을 찾을 수 없습니다.');
    console.log('\n모든 선수 이름 확인 (첫 경기):');
    
    if (events[0]) {
      const url = `https://sports.highlightly.net/football/events/${events[0].highlightly_match_id}`;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });
      
      const matchEvents = await response.json();
      const players = new Set();
      matchEvents.forEach((e: any) => {
        if (e.player) players.add(e.player);
        if (e.assist && e.assist !== 'null') players.add(e.assist);
      });
      
      console.log([...players].sort().join(', '));
    }
  }
}

checkAnsanEuler();
