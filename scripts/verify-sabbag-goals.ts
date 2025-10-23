import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

async function verifySabbagGoals() {
  console.log('🔍 Sabbag 골 기록 상세 검증\n');

  // Sabbag의 player_statistics 조회
  const { data: sabbag } = await supabase
    .from('player_statistics')
    .select('*')
    .ilike('strPlayer', '%Sabbag%')
    .single();

  if (!sabbag) {
    console.log('❌ Sabbag 데이터를 찾을 수 없습니다.');
    return;
  }

  console.log('📊 Sabbag 통계 요약:');
  console.log(`  선수 ID: ${sabbag.idPlayer}`);
  console.log(`  이름: ${sabbag.strPlayer}`);
  console.log(`  팀: ${sabbag.strTeam}`);
  console.log(`  골: ${sabbag.goals}개`);
  console.log(`  도움: ${sabbag.assists}개`);
  console.log(`  출장: ${sabbag.appearances}경기\n`);

  // Suwon FC (Suwon City FC)의 모든 경기 조회
  console.log('📋 Suwon FC 전체 경기 목록:\n');
  const { data: events } = await supabase
    .from('events')
    .select('idEvent, dateEvent, strHomeTeam, strAwayTeam, intHomeScore, intAwayScore, highlightly_match_id')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .or('strHomeTeam.eq.Suwon FC,strAwayTeam.eq.Suwon FC')
    .order('dateEvent', { ascending: true });

  let completedMatches = 0;
  let mappedMatches = 0;
  let goalsByMatch: any[] = [];

  for (const e of events || []) {
    const isSuwonHome = e.strHomeTeam === 'Suwon FC';
    const score = isSuwonHome ? `${e.intHomeScore}-${e.intAwayScore}` : `${e.intAwayScore}-${e.intHomeScore}`;
    const vs = isSuwonHome ? e.strAwayTeam : e.strHomeTeam;
    const hasScore = e.intHomeScore !== null && e.intAwayScore !== null;
    const hasMapping = e.highlightly_match_id !== null;

    if (hasScore) completedMatches++;
    if (hasMapping) mappedMatches++;

    const status = hasScore ? '✅' : '⏳';
    const mapping = hasMapping ? '🔗' : '❌';

    // Highlightly API에서 Sabbag 골 확인
    let sabbagGoals = 0;
    if (hasMapping) {
      const url = `https://sports.highlightly.net/football/events/${e.highlightly_match_id}`;
      try {
        const response = await fetch(url, {
          headers: {
            'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
            'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
          },
        });

        if (response.ok) {
          const events: any[] = await response.json();
          sabbagGoals = events.filter(ev =>
            ev.type === 'Goal' &&
            ev.playerId?.toString() === sabbag.idPlayer
          ).length;
        }
      } catch (error) {
        // Skip on error
      }

      if (sabbagGoals > 0) {
        goalsByMatch.push({
          date: e.dateEvent,
          vs,
          score,
          goals: sabbagGoals,
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const goalInfo = sabbagGoals > 0 ? ` ⚽ ${sabbagGoals}골` : '';
    console.log(`  ${status}${mapping} ${e.dateEvent} | Suwon FC vs ${vs} | ${hasScore ? score : '미정'}${goalInfo}`);
  }

  console.log(`\n📊 경기 현황:`);
  console.log(`  전체: ${events?.length}경기`);
  console.log(`  완료: ${completedMatches}경기`);
  console.log(`  매핑: ${mappedMatches}경기`);

  console.log(`\n⚽ Sabbag 골 기록 상세:`);
  goalsByMatch.forEach((match, i) => {
    console.log(`  ${i + 1}. ${match.date} | vs ${match.vs} (${match.score}) - ${match.goals}골`);
  });
  console.log(`\n총 ${goalsByMatch.reduce((sum, m) => sum + m.goals, 0)}골`);
}

verifySabbagGoals().catch(console.error);
