import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY || '';

async function checkAndersonAllMatches() {
  console.log('🔍 Anderson Oliveira 전체 시즌 도움 기록 분석\n');

  // Suwon FC 전체 경기 조회 (highlightly_match_id가 있는 것만)
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Suwon FC,strAwayTeam.eq.Suwon FC')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true });

  console.log(`📋 Suwon FC 매핑된 경기: ${events?.length}개\n`);

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

      // Anderson의 도움 찾기 - assistingPlayerId로 정확하게 찾기
      const andersonAssists = highlightlyEvents.filter(ev =>
        (ev.type === 'Goal' || ev.type === 'Penalty') &&
        ev.assistingPlayerId === 1496166  // Anderson's player ID
      );

      if (andersonAssists.length > 0) {
        totalAssists += andersonAssists.length;
        assistsByMatch.push({
          date: event.dateEvent,
          vs: event.strHomeTeam === 'Suwon FC' ? event.strAwayTeam : event.strHomeTeam,
          assists: andersonAssists.length,
          details: andersonAssists.map(a => ({
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

  console.log('⚽ Anderson Oliveira 도움 기록:\n');
  assistsByMatch.forEach((match, i) => {
    console.log(`${i + 1}. ${match.date} | vs ${match.vs} - ${match.assists}도움`);
    match.details.forEach((d: any) => {
      console.log(`   → ${d.scorer} (${d.type}) at ${d.time}'`);
    });
  });

  console.log(`\n총 ${totalAssists}도움 (공식 8도움 - ${8 - totalAssists}도움 ${totalAssists < 8 ? '부족' : '초과'})`);
  console.log(`\n💡 분석:`);
  console.log(`  - assistingPlayerId = 1496166 기준으로 정확하게 검색`);
  console.log(`  - Goal과 Penalty 이벤트만 카운트`);
  console.log(`  - Substitution 이벤트 제외`);
}

checkAndersonAllMatches().catch(console.error);
