import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function debugYagoApril26() {
  console.log('🔍 Yago 4월 26일 도움 디버깅\n');

  // 4월 26일 경기 찾기 (Anyang vs Jeju)
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('dateEvent', '2025-04-26')
    .or('strHomeTeam.eq.Anyang,strAwayTeam.eq.Anyang');

  if (!events || events.length === 0) {
    console.log('❌ 4월 26일 Anyang 경기를 찾을 수 없습니다.');
    return;
  }

  for (const event of events) {
    console.log(`📋 경기: ${event.strHomeTeam} vs ${event.strAwayTeam}`);
    console.log(`   날짜: ${event.dateEvent}`);
    console.log(`   Match ID: ${event.highlightly_match_id}\n`);

    if (!event.highlightly_match_id) {
      console.log('⚠️  highlightly_match_id가 없습니다.\n');
      continue;
    }

    const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
      },
    });

    if (!response.ok) {
      console.log(`❌ API 응답 실패: ${response.status}\n`);
      continue;
    }

    const highlightlyEvents: any[] = await response.json();

    console.log(`총 이벤트: ${highlightlyEvents.length}개\n`);

    // 골 이벤트만 필터링
    const goalEvents = highlightlyEvents.filter(ev => ev.type === 'Goal' || ev.type === 'Penalty');

    console.log('⚽ 골 이벤트:\n');
    goalEvents.forEach((ev, i) => {
      console.log(`${i + 1}. [${ev.type}] ${ev.player} (playerId: ${ev.playerId})`);
      console.log(`   시간: ${ev.time}'`);
      console.log(`   팀: ${ev.team.name}`);
      console.log(`   어시스트: "${ev.assist}" (assistingPlayerId: ${ev.assistingPlayerId})`);
      console.log(`   어시스트 값 타입: ${typeof ev.assist}`);
      console.log(`   어시스트 truthy: ${!!ev.assist}`);
      console.log(`   조건 통과: ${!!(ev.type === 'Goal' || ev.type === 'Penalty') && !!ev.assist && !!ev.assistingPlayerId}`);
      console.log();
    });

    // Yago의 assistingPlayerId로 필터링
    const yagoAssists = goalEvents.filter(ev => ev.assistingPlayerId === 5767335);
    console.log(`🎯 Yago Cesar의 도움: ${yagoAssists.length}개`);
  }
}

debugYagoApril26().catch(console.error);
