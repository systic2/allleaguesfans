import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // Use SERVICE_ROLE for write operations
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

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
  console.log('🔍 Highlightly API에서 K League 2 경기 가져오기\n');

  const allMatches: any[] = [];
  let offset = 1;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL('https://sports.highlightly.net/football/matches');
    url.searchParams.append('countryCode', 'KR');
    url.searchParams.append('season', '2025');
    url.searchParams.append('leagueName', 'K League 2');
    url.searchParams.append('offset', offset.toString());

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
      break;
    }

    allMatches.push(...matches);
    offset += matches.length;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ 총 Highlightly 경기 수: ${allMatches.length}개\n`);

  return allMatches;
}

async function saveMatchIds() {
  console.log('📊 3단계: events 테이블에 highlightly_match_id 저장 시작\n');

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

  let savedCount = 0;
  let unmatchedCount = 0;

  console.log('\n🔄 저장 진행 중...\n');

  for (const event of events || []) {
    const eventDate = event.dateEvent;
    const homeTeam = normalizeTeamName(event.strHomeTeam);
    const awayTeam = normalizeTeamName(event.strAwayTeam);

    // Highlightly에서 같은 날짜, 같은 팀 경기 찾기
    const match = highlightlyMatches.find((m: any) => {
      const matchDate = m.date ? new Date(m.date).toISOString().split('T')[0] : '';
      const matchHome = m.homeTeam.name;
      const matchAway = m.awayTeam.name;

      return matchDate === eventDate &&
             matchHome === homeTeam &&
             matchAway === awayTeam;
    });

    if (match) {
      // events 테이블 업데이트
      const { error: updateError } = await supabase
        .from('events')
        .update({ highlightly_match_id: match.id.toString() })
        .eq('idEvent', event.idEvent);

      if (updateError) {
        console.error(`❌ [${event.idEvent}] 저장 실패: ${updateError.message}`);
      } else {
        savedCount++;
        console.log(`✅ [${savedCount}] ${eventDate} | ${event.strHomeTeam} vs ${event.strAwayTeam} → ${match.id}`);
      }
    } else {
      unmatchedCount++;
    }
  }

  console.log('\n📊 저장 결과:');
  console.log(`  ✅ 저장 성공: ${savedCount}개`);
  console.log(`  ❌ 매칭 실패: ${unmatchedCount}개`);
}

saveMatchIds().catch(console.error);
