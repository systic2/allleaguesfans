import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function analyzeAssistTypes() {
  console.log('🔍 Highlightly API 이벤트 타입 분석\n');

  // 한 경기의 모든 이벤트 타입 확인
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('strHomeTeam', 'Suwon FC')
    .eq('strAwayTeam', 'Sangju Sangmu')
    .eq('dateEvent', '2025-04-12')
    .single();

  if (!event || !event.highlightly_match_id) {
    console.log('❌ 경기를 찾을 수 없습니다.');
    return;
  }

  console.log(`📋 경기: ${event.strHomeTeam} vs ${event.strAwayTeam} (${event.dateEvent})`);
  console.log(`   Match ID: ${event.highlightly_match_id}\n`);

  const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  if (!response.ok) {
    console.log(`❌ API 호출 실패: ${response.status}`);
    return;
  }

  const events: any[] = await response.json();

  console.log(`✅ 총 ${events.length}개 이벤트\n`);

  // 모든 이벤트 타입 수집
  const eventTypes = new Set<string>();
  events.forEach(ev => eventTypes.add(ev.type));

  console.log('📊 이벤트 타입 목록:');
  Array.from(eventTypes).sort().forEach(type => {
    const count = events.filter(ev => ev.type === type).length;
    console.log(`  - ${type}: ${count}개`);
  });

  // 어시스트가 있는 이벤트만 필터링
  console.log('\n⚽ 어시스트 정보가 있는 이벤트:\n');
  events
    .filter(ev => ev.assist || ev.assistingPlayerId)
    .forEach((ev, i) => {
      console.log(`${i + 1}. [${ev.type}] ${ev.player} (${ev.playerId})`);
      console.log(`   어시스트: ${ev.assist} (${ev.assistingPlayerId})`);
      console.log(`   시간: ${ev.time}'`);
      console.log();
    });
}

analyzeAssistTypes().catch(console.error);
