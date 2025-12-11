import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function checkAndersonAssists() {
  console.log('🔍 Anderson Oliveira 어시스트 기록 분석\n');

  // Anderson 찾기
  const { data: anderson } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', '%Anderson Oliveira%')
    .single();

  if (!anderson) {
    console.log('❌ Anderson Oliveira를 찾을 수 없습니다.');
    return;
  }

  console.log('📊 Anderson Oliveira 통계:');
  console.log(`  선수 ID: ${anderson.idPlayer}`);
  console.log(`  팀: ${anderson.strTeam}`);
  console.log(`  골: ${anderson.goals}개`);
  console.log(`  도움: ${anderson.assists}개 (공식 8개 - 1개 부족)`);
  console.log(`  출장: ${anderson.appearances}경기\n`);

  // Suwon FC 경기들 조회
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Suwon FC,strAwayTeam.eq.Suwon FC')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true });

  console.log(`📋 Suwon FC 매핑된 경기: ${events?.length}개\n`);

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

      // Anderson의 어시스트 찾기
      const andersonAssists = highlightlyEvents.filter(ev =>
        (ev.type === 'Goal' || ev.type === 'Penalty') &&
        ev.assist &&
        (ev.assistingPlayerId?.toString() === anderson.idPlayer ||
         ev.assist?.toLowerCase().includes('anderson'))
      );

      if (andersonAssists.length > 0) {
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
      // Skip on error
    }
  }

  console.log('\n⚽ Anderson Oliveira 어시스트 기록:\n');
  assistsByMatch.forEach((match, i) => {
    console.log(`${i + 1}. ${match.date} | vs ${match.vs} - ${match.assists}도움`);
    match.details.forEach((d: any) => {
      console.log(`   → ${d.scorer} (${d.type}) at ${d.time}'`);
    });
  });

  const totalAssists = assistsByMatch.reduce((sum, m) => sum + m.assists, 0);
  console.log(`\n총 ${totalAssists}도움 (공식 8도움 - ${8 - totalAssists}도움 부족)`);
}

checkAndersonAssists().catch(console.error);
