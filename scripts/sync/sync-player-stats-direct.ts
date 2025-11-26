/**
 * Sync Player Statistics Directly from events.highlightly_match_id
 */

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

interface HighlightlyEvent {
  type: string;
  time: string;
  player: string;
  playerId: number;
  team: {
    id: number;
    name: string;
  };
  assist?: string | null;
  assistingPlayerId?: number | null;
}

async function fetchMatchEvents(matchId: string): Promise<HighlightlyEvent[]> {
  const url = `https://sports.highlightly.net/football/events/${matchId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
        'x-rapidapi-key': HIGHLIGHTLY_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: HighlightlyEvent[] = await response.json();
    return data || [];
  } catch (error) {
    console.error(`   ❌ Error fetching match ${matchId}:`, error);
    return [];
  }
}

async function syncPlayerStats() {
  console.log('🚀 선수 통계 동기화 시작\n');

  // events 테이블에서 highlightly_match_id가 있는 경기 가져오기
  const { data: events, error } = await supabase
    .from('events')
    .select('idEvent, idLeague, strHomeTeam, strAwayTeam, highlightly_match_id')
    .eq('idLeague', '4689')
    .eq('strSeason', '2025')
    .not('highlightly_match_id', 'is', null)
    .order('dateEvent', { ascending: true });

  if (error) {
    throw new Error(`DB 조회 실패: ${error.message}`);
  }

  console.log(`✅ 매핑된 경기: ${events?.length}개\n`);

  // Key: playerId (not playerId_playerName to avoid duplicates from name variations)
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

  let processedMatches = 0;
  let totalEvents = 0;

  for (const event of events || []) {
    const matchId = event.highlightly_match_id!;

    console.log(`📡 [${++processedMatches}/${events?.length}] ${event.strHomeTeam} vs ${event.strAwayTeam} (match ${matchId})`);

    const highlightlyEvents = await fetchMatchEvents(matchId);

    if (highlightlyEvents.length === 0) {
      console.log(`   ⚠️  이벤트 없음\n`);
      continue;
    }

    console.log(`   ✅ ${highlightlyEvents.length}개 이벤트`);
    totalEvents += highlightlyEvents.length;

    // 이벤트 처리
    for (const ev of highlightlyEvents) {
      // Assist는 골 넣은 선수의 playerId가 없어도 처리 가능하므로 먼저 체크
      // Assist 처리 (골 이벤트에만 적용)
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

        // Debug: Yago의 도움만 로그
        if (assistId === '5767335') {
          console.log(`      🎯 Yago 도움 +1: ${ev.player || 'unknown'} 골 (${ev.time}') → 현재 도움: ${playerStatsMap.get(assistId)!.assists + 1}`);
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

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n💾 데이터베이스에 저장 중...\n');

  // player_statistics 테이블 초기화 (K League 1만)
  const { error: deleteError } = await supabase
    .from('player_statistics')
    .delete()
    .eq('idLeague', '4689')
    .eq('strSeason', '2025');

  if (deleteError) {
    console.error('⚠️  기존 데이터 삭제 실패:', deleteError.message);
  } else {
    console.log('✅ 기존 데이터 삭제 완료\n');
  }

  // 새 데이터 삽입
  let savedCount = 0;
  let errorCount = 0;

  for (const [playerId, stats] of playerStatsMap.entries()) {
    const { error: insertError } = await supabase
      .from('player_statistics')
      .insert({
        idPlayer: playerId,
        strPlayer: stats.player_name,
        idTeam: '0',
        strTeam: stats.team_name,
        idLeague: '4689',
        strSeason: '2025',
        goals: stats.goals,
        assists: stats.assists,
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
        appearances: stats.appearances.size,
      });

    if (insertError) {
      errorCount++;
      if (errorCount <= 3) {
        console.error(`❌ 저장 실패 [${stats.player_name}]:`, insertError.message);
      }
    } else {
      savedCount++;
    }
  }

  console.log('\n✅ 동기화 완료!\n');
  console.log('📊 최종 통계:');
  console.log(`  - 처리한 경기: ${processedMatches}개`);
  console.log(`  - 총 이벤트: ${totalEvents}개`);
  console.log(`  - 저장된 선수: ${savedCount}명`);
  console.log(`  - 에러: ${errorCount}개`);
}

syncPlayerStats().catch(console.error);
