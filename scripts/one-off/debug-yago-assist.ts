import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function debugYagoAssist() {
  console.log('🔍 Yago 8월 8일 도움 디버깅\n');

  // 8월 8일 경기 찾기 (Anyang vs Jeonbuk)
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('dateEvent', '2025-08-08')
    .or('strHomeTeam.eq.Anyang,strAwayTeam.eq.Anyang')
    .single();

  if (!event) {
    console.log('❌ 경기를 찾을 수 없습니다.');
    return;
  }

  console.log(`📋 경기: ${event.strHomeTeam} vs ${event.strAwayTeam}`);
  console.log(`   날짜: ${event.dateEvent}`);
  console.log(`   Match ID: ${event.highlightly_match_id}\n`);

  const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
      'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
    },
  });

  const events: any[] = await response.json();

  console.log(`총 이벤트: ${events.length}개\n`);

  // 골 이벤트만 필터링
  const goalEvents = events.filter(ev => ev.type === 'Goal' || ev.type === 'Penalty');

  console.log('⚽ 골 이벤트:\n');
  goalEvents.forEach((ev, i) => {
    console.log(`${i + 1}. [${ev.type}] ${ev.player} (playerId: ${ev.playerId})`);
    console.log(`   시간: ${ev.time}'`);
    console.log(`   팀: ${ev.team.name}`);
    console.log(`   어시스트: "${ev.assist}" (assistingPlayerId: ${ev.assistingPlayerId})`);
    console.log(`   어시스트 값 타입: ${typeof ev.assist}`);
    console.log(`   어시스트 truthy: ${!!ev.assist}`);
    console.log();
  });

  // Yago의 assistingPlayerId로 필터링
  const yagoAssists = goalEvents.filter(ev => ev.assistingPlayerId === 5767335);
  console.log(`🎯 Yago Cesar의 도움: ${yagoAssists.length}개`);
}

debugYagoAssist().catch(console.error);
