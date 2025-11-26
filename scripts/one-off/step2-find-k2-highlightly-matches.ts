import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;
const K_LEAGUE_1_ID = '249276'; // Highlightly에서 K League 1 ID

// 팀 이름 매핑 (TheSportsDB → Highlightly)
const TEAM_NAME_MAP: Record<string, string> = {
  // K League 2 팀 이름 매핑
  'Suwon Samsung Bluewings': 'Suwon Bluewings',
  'Gimpo FC': 'Gimpo Citizen',
  'Hwaseong FC': 'Hwaseong',
  'Seoul E-Land': 'Seoul E-Land FC',
  'Chungnam Asan': 'Asan Mugunghwa',
  'Chungbuk Cheongju': 'Cheongju',
  'Busan IPark': 'Busan I Park',

  // 이름 그대로 사용하는 팀들
  'Ansan Greeners': 'Ansan Greeners',
  'Bucheon FC 1995': 'Bucheon FC 1995',
  'Gyeongnam FC': 'Gyeongnam FC',
  'Incheon United': 'Incheon United',
  'Jeonnam Dragons': 'Jeonnam Dragons',
  'Seongnam FC': 'Seongnam FC',
  'Cheonan City': 'Cheonan City',
};

function normalizeTeamName(name: string): string {
  return TEAM_NAME_MAP[name] || name;
}

async function fetchHighlightlyMatches() {
  console.log('🔍 2단계: Highlightly API에서 K League 2 경기 찾기\n');

  const allMatches: any[] = [];
  let offset = 1;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL('https://sports.highlightly.net/football/matches');
    url.searchParams.append('countryCode', 'KR');
    url.searchParams.append('season', '2025');
    url.searchParams.append('leagueName', 'K League 2');
    url.searchParams.append('offset', offset.toString());

    console.log(`📡 Highlightly API 호출 중 (페이지 ${page}, offset ${offset})...`);

    const response = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const matches = data.data || [];

    if (matches.length === 0) {
      console.log(`  ℹ️  페이지 ${page}에서 더 이상 경기 없음\n`);
      break;
    }

    console.log(`  ✅ ${matches.length}개 경기 가져옴\n`);
    allMatches.push(...matches);
    offset += matches.length;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ 총 Highlightly 경기 수: ${allMatches.length}개\n`);

  // 샘플 경기 확인
  console.log('📋 샘플 Highlightly 경기 5개:');
  allMatches.slice(0, 5).forEach((match: any) => {
    const date = match.date ? new Date(match.date).toISOString().split('T')[0] : 'N/A';
    console.log(`  ${date} | ${match.homeTeam.name} vs ${match.awayTeam.name} (ID: ${match.id})`);
  });

  // 고유한 팀 이름 확인
  const teamNames = new Set<string>();
  allMatches.forEach((match: any) => {
    teamNames.add(match.homeTeam.name);
    teamNames.add(match.awayTeam.name);
  });
  console.log('\n📋 Highlightly 팀 이름 목록:');
  Array.from(teamNames).sort().forEach(name => console.log(`  - ${name}`));

  return allMatches;
}

async function matchEvents() {
  console.log('\n🔗 3단계: events 테이블과 Highlightly 경기 매칭 시작\n');

  // events 테이블에서 K League 2 경기 가져오기
  const { data: events, error } = await supabase
    .from('events')
    .select('idEvent, strEvent, strHomeTeam, strAwayTeam, dateEvent')
    .eq('idLeague', '4822')
    .eq('strSeason', '2025')
    .order('dateEvent', { ascending: true });

  if (error) {
    throw new Error(`DB 조회 실패: ${error.message}`);
  }

  console.log(`📊 events 테이블 경기 수: ${events?.length}개`);

  // Highlightly 경기 가져오기
  const highlightlyMatches = await fetchHighlightlyMatches();

  let matchedCount = 0;
  let unmatchedEvents: any[] = [];

  console.log('\n🔄 매칭 진행 중...\n');

  for (const event of events || []) {
    const eventDate = event.dateEvent;
    const homeTeam = normalizeTeamName(event.strHomeTeam);
    const awayTeam = normalizeTeamName(event.strAwayTeam);

    // Highlightly에서 같은 날짜, 같은 팀 경기 찾기
    const match = highlightlyMatches.find((m: any) => {
      // Highlightly uses ISO 8601 timestamp, convert to YYYY-MM-DD
      const matchDate = m.date ? new Date(m.date).toISOString().split('T')[0] : '';
      const matchHome = m.homeTeam.name;
      const matchAway = m.awayTeam.name;

      return matchDate === eventDate &&
             matchHome === homeTeam &&
             matchAway === awayTeam;
    });

    if (match) {
      matchedCount++;
      console.log(`✅ [${matchedCount}] ${eventDate} | ${event.strHomeTeam} vs ${event.strAwayTeam}`);
      console.log(`   → Highlightly: ${match.homeTeam.name} vs ${match.awayTeam.name} (ID: ${match.id})\n`);
    } else {
      unmatchedEvents.push(event);
    }
  }

  console.log('\n📊 매칭 결과:');
  console.log(`  ✅ 매칭 성공: ${matchedCount}개`);
  console.log(`  ❌ 매칭 실패: ${unmatchedEvents.length}개`);

  if (unmatchedEvents.length > 0) {
    console.log('\n⚠️  매칭 실패한 경기들:');
    unmatchedEvents.slice(0, 10).forEach(e => {
      console.log(`  ${e.dateEvent} | ${e.strHomeTeam} vs ${e.strAwayTeam}`);
    });
  }
}

matchEvents().catch(console.error);
