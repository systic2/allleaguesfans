import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

const eullerDates = [
  { date: '2025-02-23', assists: 1 },
  { date: '2025-03-01', assists: 1 },
  { date: '2025-03-30', assists: 1 },
  { date: '2025-04-13', assists: 1 },
  { date: '2025-06-14', assists: 1 },
  { date: '2025-06-21', assists: 2 },
  { date: '2025-07-05', assists: 1 },
  { date: '2025-07-13', assists: 1 },
  { date: '2025-09-06', assists: 1 },
  { date: '2025-10-26', assists: 1 },
];

async function verifyAll() {
  console.log('🔍 Euller 10개 경기 모두 확인\n');

  let totalFound = 0;
  let totalExpected = 0;

  for (const { date, assists: expected } of eullerDates) {
    totalExpected += expected;

    // Seoul E-Land 경기 찾기
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('idLeague', '4822')
      .eq('dateEvent', date)
      .not('highlightly_match_id', 'is', null);

    if (!events) {
      console.log(date + ': 경기 못 찾음');
      continue;
    }

    // Seoul E-Land 경기 찾기
    const seoulMatch = events.find(
      e =>
        e.strHomeTeam === 'Seoul E-Land' ||
        e.strAwayTeam === 'Seoul E-Land'
    );

    if (!seoulMatch) {
      console.log(date + ': Seoul E-Land 경기 없음');
      continue;
    }

    console.log('\n' + date + ': ' + seoulMatch.strHomeTeam + ' vs ' + seoulMatch.strAwayTeam);
    console.log('  공식 도움: ' + expected + '개');

    try {
      const url = 'https://sports.highlightly.net/football/events/' + seoulMatch.highlightly_match_id;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) {
        console.log('  API 오류: ' + response.status);
        continue;
      }

      const matchEvents = await response.json();

      // Euller 관련 이벤트
      const eullerEvents = matchEvents.filter((e: any) =>
        e.player?.toLowerCase().includes('euller') ||
        e.assist?.toLowerCase().includes('euller')
      );

      const eullerAssists = matchEvents.filter((e: any) =>
        e.type === 'goal' &&
        e.assist &&
        e.assist.toLowerCase().includes('euller')
      );

      if (eullerAssists.length > 0) {
        console.log('  ✅ Highlightly: ' + eullerAssists.length + '도움');
        eullerAssists.forEach((e: any) => {
          console.log('    ' + e.time + "' " + e.player + ' ← Euller');
        });
        totalFound += eullerAssists.length;
      } else {
        console.log('  ❌ Highlightly: 0도움');

        if (eullerEvents.length > 0) {
          console.log('  ℹ️  Euller 이벤트 (골 등):');
          eullerEvents.forEach((e: any) => {
            console.log('    ' + e.time + "' " + e.type + ': ' + e.player);
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error('  Error:', err);
    }
  }

  console.log('\n\n📊 최종 결과:');
  console.log('  공식 기록: ' + totalExpected + '도움');
  console.log('  Highlightly: ' + totalFound + '도움');
  console.log('  차이: ' + (totalExpected - totalFound) + '도움 부족');
}

verifyAll();
