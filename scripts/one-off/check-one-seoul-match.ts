import { config } from 'dotenv';
config();

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkMatch() {
  // 2025-02-23 Seoul E-Land vs Chungnam Asan
  const matchId = '1138261791';

  console.log('Match ' + matchId + ' 확인\n');

  const url = 'https://sports.highlightly.net/football/events/' + matchId;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  const events = await response.json();
  console.log('Total events: ' + events.length + '\n');

  // 모든 골 이벤트와 도움 출력
  console.log('모든 골 이벤트:');
  events.filter((e: any) => e.type === 'goal').forEach((e: any) => {
    const assistText = e.assist && e.assist !== 'null' ? ' ← ' + e.assist : ' (도움 없음)';
    console.log('  ' + e.time + "' " + e.player + ' (' + e.team.name + ')' + assistText);
  });

  // Euller 검색
  console.log('\n\nEuller 관련 이벤트:');
  const eullerEvents = events.filter((e: any) =>
    e.player?.toLowerCase().includes('eul') ||
    e.assist?.toLowerCase().includes('eul')
  );

  if (eullerEvents.length > 0) {
    eullerEvents.forEach((e: any) => {
      const assistText = e.assist ? ' ← ' + e.assist : '';
      console.log('  ' + e.time + "' " + e.type + ': ' + e.player + assistText);
    });
  } else {
    console.log('  없음');
  }

  // Seoul E-Land 선수 목록
  console.log('\n\nSeoul E-Land 선수:');
  const seoulPlayers = new Set<string>();
  events.forEach((e: any) => {
    if (e.team?.name?.includes('Seoul')) {
      seoulPlayers.add(e.player);
    }
  });
  [...seoulPlayers].sort().forEach(p => console.log('  - ' + p));
}

checkMatch();
