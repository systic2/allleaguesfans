import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

// 에울레르 도움 날짜
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

async function checkEullerMatches() {
  console.log('🔍 서울 E-Land 경기에서 Euller 도움 확인\n');

  let totalAssists = 0;

  for (const { date, assists: expectedAssists } of eullerDates) {
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('idLeague', '4822')
      .eq('dateEvent', date)
      .or('strHomeTeam.eq.Seoul E-Land,strAwayTeam.eq.Seoul E-Land')
      .not('highlightly_match_id', 'is', null);

    if (!events || events.length === 0) {
      console.log(`❌ ${date}: 경기 없음`);
      continue;
    }

    const match = events[0];
    console.log(`\n📅 ${date}: ${match.strHomeTeam} vs ${match.strAwayTeam}`);
    console.log(`   Match ID: ${match.highlightly_match_id}`);
    console.log(`   공식 도움: ${expectedAssists}개`);

    try {
      const url = `https://sports.highlightly.net/football/events/${match.highlightly_match_id}`;
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

      // Euller 도움 찾기
      const eullerAssists = matchEvents.filter((e: any) =>
        e.type === 'goal' &&
        e.assist &&
        e.assist.toLowerCase().includes('euller')
      );

      if (eullerAssists.length > 0) {
        console.log(`   ✅ Highlightly 도움: ${eullerAssists.length}개`);
        eullerAssists.forEach((e: any) => {
          console.log(`      ${e.time}' ${e.player} ← ${e.assist}`);
        });
        totalAssists += eullerAssists.length;
      } else {
        console.log(`   ❌ Highlightly 도움: 0개`);

        // 모든 도움 출력
        const allAssists = matchEvents.filter((e: any) =>
          e.type === 'goal' && e.assist && e.assist !== 'null'
        );
        if (allAssists.length > 0) {
          console.log(`   📊 이 경기 모든 도움:`);
          allAssists.forEach((e: any) => {
            console.log(`      ${e.time}' ${e.player} ← ${e.assist}`);
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.error(`   ❌ Error:`, err);
    }
  }

  console.log(`\n\n📊 결과:`);
  console.log(`   Highlightly API에서 찾은 Euller 도움: ${totalAssists}개`);
  console.log(`   공식 기록 Euller 도움: 10개`);
  console.log(`   차이: ${10 - totalAssists}개 부족`);
}

checkEullerMatches();
