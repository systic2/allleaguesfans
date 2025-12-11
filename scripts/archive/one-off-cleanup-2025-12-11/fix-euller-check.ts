import { config } from 'dotenv';
config();

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkMatch() {
  const matchId = '1138261791';
  
  const url = 'https://sports.highlightly.net/football/events/' + matchId;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });
  
  const events = await response.json();
  
  console.log('전체 이벤트 수:', events.length);
  console.log('\n모든 골 이벤트와 도움:');
  
  events.filter((e: any) => e.type === 'Goal' || e.type === 'Penalty').forEach((e: any) => {
    console.log('  ' + e.time + "' " + e.type + ': ' + e.player + 
                (e.assist ? ' ← ' + e.assist : ' (도움 없음)'));
  });
  
  console.log('\nEuller 도움 이벤트:');
  const eullerAssists = events.filter((e: any) => 
    e.assist && e.assist === 'Euller'
  );
  
  console.log('찾은 개수:', eullerAssists.length);
  eullerAssists.forEach((e: any) => {
    console.log('  ' + e.time + "' " + e.player + ' ← Euller');
  });
}

checkMatch();
