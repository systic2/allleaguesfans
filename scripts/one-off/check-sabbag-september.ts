import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkSeptemberMatches() {
  console.log('🔍 9월 Sabbag 경기 상세 분석\n');

  // 9월 14일과 9월 28일 경기 찾기
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Suwon FC,strAwayTeam.eq.Suwon FC')
    .gte('dateEvent', '2025-09-01')
    .lte('dateEvent', '2025-09-30')
    .order('dateEvent', { ascending: true });

  console.log(`📋 9월 Suwon FC 경기: ${events?.length}개\n`);

  for (const event of events || []) {
    const isSuwonHome = event.strHomeTeam === 'Suwon FC';
    const vs = isSuwonHome ? event.strAwayTeam : event.strHomeTeam;
    const score = `${event.intHomeScore}-${event.intAwayScore}`;

    console.log(`\n📅 ${event.dateEvent} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
    console.log(`   점수: ${score}`);
    console.log(`   Match ID: ${event.highlightly_match_id}`);

    if (!event.highlightly_match_id) {
      console.log('   ❌ Highlightly 매핑 없음');
      continue;
    }

    // Highlightly API에서 이벤트 가져오기
    const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   ❌ API 호출 실패: ${response.status}`);
        continue;
      }

      const highlightlyEvents: any[] = await response.json();
      console.log(`   ✅ 총 ${highlightlyEvents.length}개 이벤트`);

      // Sabbag 관련 이벤트만 필터링
      const sabbagEvents = highlightlyEvents.filter(ev =>
        ev.player && (
          ev.player.toLowerCase().includes('sabbag') ||
          ev.playerId === 6674409
        )
      );

      if (sabbagEvents.length > 0) {
        console.log(`\n   ⚽ Sabbag 이벤트 ${sabbagEvents.length}개:`);
        sabbagEvents.forEach((ev, i) => {
          console.log(`      ${i + 1}. ${ev.type} - ${ev.player} (ID: ${ev.playerId}) at ${ev.time}'`);
          if (ev.assist) {
            console.log(`         어시스트: ${ev.assist}`);
          }
        });
      } else {
        console.log(`\n   ⚠️  Sabbag 이벤트 없음`);
      }

      // 모든 골 이벤트 출력
      const goalEvents = highlightlyEvents.filter(ev => ev.type === 'Goal');
      if (goalEvents.length > 0) {
        console.log(`\n   📊 전체 골 이벤트 ${goalEvents.length}개:`);
        goalEvents.forEach((ev, i) => {
          console.log(`      ${i + 1}. ${ev.player} (${ev.team.name}) - ${ev.time}'`);
        });
      }

    } catch (error) {
      console.log(`   ❌ 에러:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

checkSeptemberMatches().catch(console.error);
