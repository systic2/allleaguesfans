import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function findEuler() {
  // Ansan Greeners 첫 경기 가져오기
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4822')
    .eq('strHomeTeam', 'Ansan Greeners')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent')
    .limit(1);
    
  if (!data || data.length === 0) {
    console.log('경기 못 찾음');
    return;
  }
  
  const match = data[0];
  console.log(`📅 ${match.dateEvent}: ${match.strHomeTeam} vs ${match.strAwayTeam}`);
  console.log(`Match ID: ${match.highlightly_match_id}\n`);
  
  const url = `https://sports.highlightly.net/football/events/${match.highlightly_match_id}`;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });
  
  const events = await response.json();
  
  // 모든 선수 이름 출력
  console.log('모든 선수:');
  const players = new Set<string>();
  events.forEach((e: any) => {
    if (e.player) players.add(`${e.player} (team: ${e.team.name})`);
    if (e.assist && e.assist !== 'null') players.add(`${e.assist} (도움)`);
  });
  
  [...players].sort().forEach(p => console.log(`  - ${p}`));
}

findEuler();
