#!/usr/bin/env tsx

/**
 * Highlightly Live Match Sync
 * 실시간 라이브 매치 데이터 동기화 스크립트
 * 
 * Purpose: 주말 경기 시간 중 실시간 데이터를 Highlightly API로부터 가져와 동기화
 * Usage: npx tsx scripts/highlightly-live-sync.ts
 */

import { HighlightlyAPI } from './lib/highlightly-api.ts';
import { supa } from './lib/supabase.ts';

interface LiveSyncStats {
  liveMatches: number;
  eventsUpdated: number;
  scoresUpdated: number;
  highlightsAdded: number;
  errors: string[];
}

async function syncLiveMatchData(): Promise<LiveSyncStats> {
  const stats: LiveSyncStats = {
    liveMatches: 0,
    eventsUpdated: 0,
    scoresUpdated: 0,
    highlightsAdded: 0,
    errors: []
  };

  try {
    const highlightlyAPI = new HighlightlyAPI();
    console.log('🔗 Highlightly API 연결 중...');

    // 1. 현재 라이브 매치 가져오기
    console.log('⚡ 라이브 매치 데이터 조회 중...');
    const liveMatches = await highlightlyAPI.getLiveMatches();
    stats.liveMatches = liveMatches.length;

    console.log(`🏟️ 발견된 라이브 매치: ${stats.liveMatches}개`);

    if (stats.liveMatches === 0) {
      console.log('📢 현재 진행 중인 라이브 매치가 없습니다.');
      return stats;
    }

    // 2. 각 라이브 매치 처리
    for (const match of liveMatches) {
      try {
        console.log(`\n🎯 매치 처리 중: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`);

        // 2a. 실시간 스코어 업데이트
        if (match.homeScore !== undefined && match.awayScore !== undefined) {
          const { error: scoreError } = await supa
            .from('fixtures')
            .update({
              home_score: match.homeScore,
              away_score: match.awayScore,
              status: match.status,
              minute: match.minute,
              updated_at: new Date().toISOString()
            })
            .eq('highlightly_match_id', match.id);

          if (scoreError) {
            stats.errors.push(`스코어 업데이트 실패 (매치 ${match.id}): ${scoreError.message}`);
          } else {
            stats.scoresUpdated++;
            console.log(`✅ 스코어 업데이트: ${match.homeScore}-${match.awayScore}`);
          }
        }

        // 2b. 실시간 이벤트 동기화
        const matchEvents = await highlightlyAPI.getMatchEvents(match.id);
        console.log(`📋 매치 이벤트: ${matchEvents.length}개 발견`);

        for (const event of matchEvents) {
          const { error: eventError } = await supa
            .from('match_events')
            .upsert({
              fixture_id: match.fixtureId, // 매핑된 fixture ID
              highlightly_event_id: event.id,
              type: event.type,
              minute: event.minute,
              player_name: event.player?.name,
              team_name: event.team?.name,
              description: event.description,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'highlightly_event_id'
            });

          if (eventError) {
            stats.errors.push(`이벤트 동기화 실패: ${eventError.message}`);
          } else {
            stats.eventsUpdated++;
          }
        }

        // 2c. 하이라이트 동기화 (선택적)
        try {
          const highlights = await highlightlyAPI.getMatchHighlights(match.id);
          console.log(`🎥 하이라이트: ${highlights.length}개 발견`);

          for (const highlight of highlights) {
            const { error: highlightError } = await supa
              .from('match_highlights')
              .upsert({
                fixture_id: match.fixtureId,
                highlightly_highlight_id: highlight.id,
                title: highlight.title,
                video_url: highlight.videoUrl,
                thumbnail_url: highlight.thumbnailUrl,
                duration: highlight.duration,
                minute: highlight.minute,
                created_at: new Date().toISOString()
              }, {
                onConflict: 'highlightly_highlight_id'
              });

            if (highlightError) {
              stats.errors.push(`하이라이트 동기화 실패: ${highlightError.message}`);
            } else {
              stats.highlightsAdded++;
            }
          }
        } catch (highlightError) {
          console.log('⚠️ 하이라이트 동기화 건너뜀 (선택적 기능)');
        }

      } catch (matchError) {
        const errorMsg = `매치 ${match.id} 처리 실패: ${matchError instanceof Error ? matchError.message : 'Unknown error'}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return stats;

  } catch (error) {
    const errorMsg = `라이브 동기화 전체 실패: ${error instanceof Error ? error.message : 'Unknown error'}`;
    stats.errors.push(errorMsg);
    console.error(`💥 ${errorMsg}`);
    return stats;
  }
}

async function main() {
  console.log('🚀 Highlightly 실시간 라이브 매치 동기화 시작\n');
  console.log('⏰ 실행 시각:', new Date().toLocaleString('ko-KR'));
  
  const startTime = Date.now();
  
  try {
    const stats = await syncLiveMatchData();
    const duration = Date.now() - startTime;
    
    console.log('\n📊 실시간 동기화 결과:');
    console.log('================================');
    console.log(`⚡ 라이브 매치 수: ${stats.liveMatches}`);
    console.log(`📈 스코어 업데이트: ${stats.scoresUpdated}`);
    console.log(`🎯 이벤트 동기화: ${stats.eventsUpdated}`);
    console.log(`🎥 하이라이트 추가: ${stats.highlightsAdded}`);
    console.log(`⏱️ 실행 시간: ${(duration / 1000).toFixed(2)}초`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️ 오류 발생 (${stats.errors.length}건):`);
      stats.errors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('\n✅ 모든 실시간 데이터 동기화 성공!');
    }
    
    // GitHub Actions 출력
    if (process.env.NODE_ENV === 'production') {
      console.log(`\n🎯 GitHub Actions Summary:`);
      console.log(`Live Matches: ${stats.liveMatches}, Scores: ${stats.scoresUpdated}, Events: ${stats.eventsUpdated}, Highlights: ${stats.highlightsAdded}`);
      console.log(`Errors: ${stats.errors.length}, Duration: ${(duration / 1000).toFixed(2)}s`);
    }
    
  } catch (error) {
    console.error('💥 실시간 동기화 실패:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}