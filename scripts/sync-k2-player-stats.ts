/**
 * Sync K League 2 Player Statistics from Highlightly API
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY!;

interface HighlightlyEvent {
  type: string;
  player: string;
  playerId: number;
  team: { name: string };
  time: string;
  assist?: string;
  assistingPlayerId?: number;
}

async function syncK2PlayerStats() {
  console.log('🚀 K League 2 선수 통계 동기화 시작\n');

  // 1. Highlightly API에서 K League 2 경기 가져오기
  console.log('📡 Highlightly API에서 K League 2 경기 가져오는 중...\n');

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

    const data = await response.json();
    const matches = data.data || [];
    if (matches.length === 0) break;

    allMatches.push(...matches);
    offset += matches.length;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ K League 2 경기: ${allMatches.length}개\n`);

  // 2. 각 경기의 이벤트 가져와서 선수 통계 집계
  const playerStatsMap = new Map<string, {
    player_id: string;
    player_name: string;
    team_name: string;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    appearances: Set<string>;
  }>();

  let totalEvents = 0;
  let processedMatches = 0;

  for (const match of allMatches) {
    processedMatches++;
    const matchId = match.id.toString();

    console.log(`📡 [${processedMatches}/${allMatches.length}] ${match.homeTeam.name} vs ${match.awayTeam.name} (match ${matchId})`);

    const eventsUrl = `https://sports.highlightly.net/football/events/${matchId}`;

    try {
      const response = await fetch(eventsUrl, {
        headers: {
          'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
          'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   ⚠️  이벤트 없음\n`);
        continue;
      }

      const highlightlyEvents: HighlightlyEvent[] = await response.json();

      console.log(`   ✅ ${highlightlyEvents.length}개 이벤트`);
      totalEvents += highlightlyEvents.length;

      // 이벤트 처리
      for (const ev of highlightlyEvents) {
        // Assist는 골 넣은 선수의 playerId가 없어도 처리 가능하므로 먼저 체크
        if ((ev.type === 'Goal' || ev.type === 'Penalty') && ev.assist && ev.assistingPlayerId) {
          const assistId = ev.assistingPlayerId.toString();
          if (!playerStatsMap.has(assistId)) {
            playerStatsMap.set(assistId, {
              player_id: assistId,
              player_name: ev.assist,
              team_name: ev.team.name,
              goals: 0,
              assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              appearances: new Set(),
            });
          }

          playerStatsMap.get(assistId)!.assists++;
          playerStatsMap.get(assistId)!.appearances.add(matchId);
        }

        // 골을 넣은 선수의 정보가 없으면 나머지 처리는 건너뛰기
        if (!ev.playerId || !ev.player) continue;

        const playerId = ev.playerId.toString();

        if (!playerStatsMap.has(playerId)) {
          playerStatsMap.set(playerId, {
            player_id: playerId,
            player_name: ev.player,
            team_name: ev.team.name,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            appearances: new Set(),
          });
        }

        const stats = playerStatsMap.get(playerId)!;
        stats.appearances.add(matchId);

        if (ev.type === 'Goal' || ev.type === 'Penalty') {
          stats.goals++;
        } else if (ev.type === 'Yellow Card') {
          stats.yellow_cards++;
        } else if (ev.type === 'Red Card') {
          stats.red_cards++;
        }
      }

      console.log(`   📊 누적: ${playerStatsMap.size}명 선수\n`);

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }

  // 3. 데이터베이스에 저장
  console.log('\n💾 데이터베이스에 저장 중...\n');

  // 기존 K League 2 데이터 삭제
  const { error: deleteError } = await supabase
    .from('player_statistics')
    .delete()
    .eq('idLeague', '4822')
    .eq('strSeason', '2025');

  if (deleteError) {
    console.error('⚠️  기존 데이터 삭제 실패:', deleteError.message);
  } else {
    console.log('✅ 기존 데이터 삭제 완료\n');
  }

  // 새 데이터 삽입
  let savedPlayers = 0;
  let errorCount = 0;

  for (const [playerId, stats] of playerStatsMap.entries()) {
    const { error: insertError } = await supabase
      .from('player_statistics')
      .insert({
        idPlayer: playerId,
        strPlayer: stats.player_name,
        idTeam: '0',
        strTeam: stats.team_name,
        idLeague: '4822', // K League 2
        strSeason: '2025',
        goals: stats.goals,
        assists: stats.assists,
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
        appearances: stats.appearances.size,
      });

    if (insertError) {
      errorCount++;
    } else {
      savedPlayers++;
    }
  }

  console.log('\n✅ 동기화 완료!');
  console.log(`📊 최종 통계:`);
  console.log(`  - 처리한 경기: ${processedMatches}개`);
  console.log(`  - 총 이벤트: ${totalEvents}개`);
  console.log(`  - 저장된 선수: ${savedPlayers}명`);
  console.log(`  - 에러: ${errorCount}개`);
}

syncK2PlayerStats().catch(console.error);
