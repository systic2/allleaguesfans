import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function checkYagoAllMatches() {
  console.log('🔍 Yago Cesar 전체 시즌 도움 기록 분석\n');

  // Yago의 player ID 찾기
  const { data: yagoData } = await supabase
    .from('player_statistics')
    .select('*')
    .eq('strPlayer', 'Yago Cesar')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .single();

  if (!yagoData) {
    console.log('❌ Yago Cesar를 찾을 수 없습니다.');
    return;
  }

  console.log(`📊 Yago Cesar 정보:`);
  console.log(`  선수 ID: ${yagoData.idPlayer}`);
  console.log(`  팀: ${yagoData.strTeam}`);
  console.log(`  골: ${yagoData.goals}개`);
  console.log(`  도움: ${yagoData.assists}개 (공식 6개 - ${6 - yagoData.assists}개 부족)`);
  console.log(`  출장: ${yagoData.appearances}경기\n`);

  // FC Anyang 전체 경기 조회
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Anyang,strAwayTeam.eq.Anyang')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true });

  console.log(`📋 FC Anyang 매핑된 경기: ${events?.length}개\n`);

  let totalAssists = 0;
  const assistsByMatch: any[] = [];

  for (const event of events || []) {
    const url = `https://sports.highlightly.net/football/events/${event.highlightly_match_id}`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) continue;

      const highlightlyEvents: any[] = await response.json();

      // Yago의 도움 찾기 - assistingPlayerId로 정확하게 찾기
      const yagoAssists = highlightlyEvents.filter(ev =>
        (ev.type === 'Goal' || ev.type === 'Penalty') &&
        ev.assistingPlayerId?.toString() === yagoData.idPlayer
      );

      if (yagoAssists.length > 0) {
        totalAssists += yagoAssists.length;
        assistsByMatch.push({
          date: event.dateEvent,
          vs: event.strHomeTeam === 'Anyang' ? event.strAwayTeam : event.strHomeTeam,
          assists: yagoAssists.length,
          details: yagoAssists.map(a => ({
            scorer: a.player,
            time: a.time,
            type: a.type
          }))
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error for match ${event.highlightly_match_id}:`, error);
    }
  }

  console.log('⚽ Yago Cesar 도움 기록:\n');
  assistsByMatch.forEach((match, i) => {
    console.log(`${i + 1}. ${match.date} | vs ${match.vs} - ${match.assists}도움`);
    match.details.forEach((d: any) => {
      console.log(`   → ${d.scorer} (${d.type}) at ${d.time}'`);
    });
  });

  console.log(`\n총 ${totalAssists}도움 (공식 6도움 - ${6 - totalAssists}도움 ${totalAssists < 6 ? '부족' : '초과'})`);
  console.log(`\n💡 분석:`);
  console.log(`  - assistingPlayerId = ${yagoData.idPlayer} 기준으로 정확하게 검색`);
  console.log(`  - Goal과 Penalty 이벤트만 카운트`);
  console.log(`  - Substitution 이벤트 제외`);
}

checkYagoAllMatches().catch(console.error);
