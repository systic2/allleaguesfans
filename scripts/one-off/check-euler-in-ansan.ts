import { config } from 'dotenv';
config();

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;
const matchId = '1138260089'; // Ansan vs Suwon 첫 경기

async function checkMatch() {
  console.log(`🔍 Match ${matchId} 확인\n`);
  
  const url = `https://sports.highlightly.net/football/events/${matchId}`;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });
  
  if (!response.ok) {
    console.error('API Error:', response.status);
    return;
  }
  
  const events = await response.json();
  console.log(`Total events: ${events.length}\n`);
  
  // Ansan Greeners 선수 모두 출력
  console.log('Ansan Greeners 선수:');
  const ansanPlayers = new Set<string>();
  events.forEach((e: any) => {
    if (e.team?.name === 'Ansan Greeners') {
      ansanPlayers.add(e.player);
    }
    // 도움도 확인
    if (e.assist && e.assist !== 'null') {
      ansanPlayers.add(`${e.assist} (assist)`);
    }
  });
  
  [...ansanPlayers].sort().forEach(p => console.log(`  - ${p}`));
  
  // Euler 검색
  console.log('\n\nEuler/Euller 검색:');
  const eulerEvents = events.filter((e: any) => 
    e.player?.toLowerCase().includes('eul') || 
    e.assist?.toLowerCase().includes('eul')
  );
  
  if (eulerEvents.length > 0) {
    console.log('✅ 찾음!');
    eulerEvents.forEach((e: any) => {
      console.log(`  ${e.time}' ${e.type}: ${e.player} ${e.assist ? `← ${e.assist}` : ''}`);
    });
  } else {
    console.log('❌ 못 찾음');
  }
}

checkMatch();
