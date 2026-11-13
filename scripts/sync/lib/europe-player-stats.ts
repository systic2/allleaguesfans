// scripts/sync/lib/europe-player-stats.ts
// 유럽 5대 리그 선수 득점/도움/카드를 TheSportsDB v2 경기 타임라인에서 집계해 player_statistics 에 반영한다.
//
// 경기별 타임라인은 event_timelines 테이블(migration 18)에 캐시하고, 새로 끝난 경기와
// 아직 확정되지 않은 경기만 다시 받는다. 응답 검증·집계는 src/lib/mappers 쪽 순수 함수가 맡는다.
import { supa } from './supabase.js';
import {
  aggregateTimelines, parseTimelineResponse, selectEventsToFetch, shouldReplaceStored, timelineMatchesScore,
  type FinishedEvent, type StoredTimelineState, type TimelineEntry,
} from '../../../src/lib/mappers/thesportsdb-timeline-mappers.js';
import { planStaleDeletion } from '../../../src/lib/mappers/kleague-player-stats-mappers.js';

const TIMELINE_URL = 'https://www.thesportsdb.com/api/v2/json/lookup/event_timeline';
const EVENTS_V2_TABLE = 'events_v2';
const EVENT_TIMELINES_TABLE = 'event_timelines';
const PLAYER_STATISTICS_TABLE = 'player_statistics';

// TheSportsDB 프리미엄 한도(분당 100회) 아래로 유지
const REQUEST_INTERVAL_MS = 700;
// 한 번의 동기화에서 보낼 HTTP 요청 최대 수 (재시도 포함). 남은 경기는 다음 실행에서 이어 받는다.
const MAX_REQUESTS_PER_RUN = 600;
// 워크플로 timeout(30분) 안에 끝나도록 타임라인 수집에 쓰는 시간 상한
const FETCH_DEADLINE_MS = 12 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
// 받은 타임라인을 이 개수마다 저장해 중간에 끊겨도 진행분을 남긴다
const CACHE_WRITE_BATCH = 25;

const EUROPE_LEAGUES = [
  { idLeague: '4328', name: 'English Premier League' },
  { idLeague: '4335', name: 'Spanish La Liga' },
  { idLeague: '4332', name: 'Italian Serie A' },
  { idLeague: '4331', name: 'German Bundesliga' },
  { idLeague: '4334', name: 'French Ligue 1' },
] as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RequestLimits {
  remaining: number;
  deadline: number;
}

class RequestLimitReached extends Error {}

// 네트워크 오류·타임아웃·429·5xx 는 2s/4s/8s 간격으로 최대 3번 재시도. 재시도도 요청 수·시간 상한에 포함한다.
async function fetchTimeline(apiKey: string, eventId: string, limits: RequestLimits): Promise<TimelineEntry[]> {
  for (let attempt = 0; ; attempt++) {
    if (limits.remaining <= 0 || Date.now() >= limits.deadline) throw new RequestLimitReached();
    limits.remaining--;

    let response: Response | undefined;
    let networkError: unknown;
    try {
      response = await fetch(`${TIMELINE_URL}/${eventId}`, {
        headers: { 'X-API-KEY': apiKey, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      networkError = error;
    }
    if (response?.ok) return parseTimelineResponse(await response.json(), eventId);

    const retryable = !response || response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 3) throw new Error(`event_timeline ${eventId}: ${response?.status ?? String(networkError)}`);
    await sleep(2000 * 2 ** attempt);
  }
}

/**
 * 유럽 리그별로 끝난 경기의 타임라인을 받아 저장하고, 저장된 전체 타임라인으로 선수 통계를 다시 집계한다.
 * 끝난 경기 중 하나라도 캐시에 없으면(초기 적재 중, 요청 실패) 그 리그의 통계는 이번에 쓰지 않는다.
 * Returns true if successful, false if any league failed.
 */
export async function syncEuropePlayerStats(apiKey: string, season: string): Promise<boolean> {
  console.log(`\n🚀 Starting Europe Player Stats Sync (Season ${season})...`);
  let ok = true;
  const limits: RequestLimits = { remaining: MAX_REQUESTS_PER_RUN, deadline: Date.now() + FETCH_DEADLINE_MS };

  for (const [index, league] of EUROPE_LEAGUES.entries()) {
    // 앞 리그가 느리거나 계속 실패해도 뒤 리그가 굶지 않도록 남은 요청 수·시간을 남은 리그 수로 나눠 준다.
    // 다 쓰지 않은 몫은 다음 리그로 넘어간다.
    const leaguesLeft = EUROPE_LEAGUES.length - index;
    const leagueLimits: RequestLimits = {
      remaining: Math.floor(Math.max(limits.remaining, 0) / leaguesLeft),
      deadline: Date.now() + Math.max(limits.deadline - Date.now(), 0) / leaguesLeft,
    };
    const leagueBudget = leagueLimits.remaining;

    try {
      const { data: events, error: eventsError } = await supa
        .from(EVENTS_V2_TABLE)
        .select('id, date, homeScore, awayScore')
        .eq('leagueId', league.idLeague)
        .eq('season', season)
        .eq('status', 'FINISHED');
      if (eventsError) throw eventsError;
      if (!events || events.length === 0) {
        console.log(`🟡 No finished matches yet for ${league.name} ${season}. Skipping.`);
        continue;
      }
      const eventsById = new Map((events as FinishedEvent[]).map(e => [String(e.id), { ...e, id: String(e.id) }]));

      const { data: cachedRows, error: cachedError } = await supa
        .from(EVENT_TIMELINES_TABLE)
        .select('eventId, timeline, fetchedAt')
        .eq('leagueId', league.idLeague)
        .eq('season', season);
      if (cachedError) throw cachedError;
      const cache = new Map<string, { entries: TimelineEntry[]; fetchedAt: string }>(
        (cachedRows ?? []).map(r => [String(r.eventId), { entries: r.timeline as TimelineEntry[], fetchedAt: String(r.fetchedAt) }])
      );

      // 스코어 일치 여부는 저장된 값이 아니라 현재 events_v2 스코어로 매번 다시 판단한다 (스코어 정정 대비)
      const matchesScore = (eventId: string, entries: TimelineEntry[]) => {
        const event = eventsById.get(eventId)!;
        return timelineMatchesScore(entries, event.homeScore, event.awayScore);
      };
      const stateOf = (eventId: string): StoredTimelineState | undefined => {
        const cached = cache.get(eventId);
        return cached && eventsById.has(eventId)
          ? { scoreMatches: matchesScore(eventId, cached.entries), fetchedAt: cached.fetchedAt }
          : undefined;
      };
      const states = new Map<string, StoredTimelineState>();
      for (const eventId of cache.keys()) {
        const state = stateOf(eventId);
        if (state) states.set(eventId, state);
      }

      const toFetch = selectEventsToFetch([...eventsById.values()], states, new Date(), leagueLimits.remaining);

      let pending: { eventId: string; leagueId: string; season: string; timeline: TimelineEntry[]; scoreMatches: boolean; fetchedAt: string }[] = [];
      const flush = async () => {
        if (pending.length === 0) return;
        const { error: upsertError } = await supa.from(EVENT_TIMELINES_TABLE).upsert(pending, { onConflict: 'eventId' });
        if (upsertError) throw upsertError;
        for (const row of pending) cache.set(row.eventId, { entries: row.timeline, fetchedAt: row.fetchedAt });
        pending = [];
      };

      let fetched = 0;
      let kept = 0;
      let failed = 0;
      let limitReached = false;
      for (const eventId of toFetch) {
        let entries: TimelineEntry[];
        try {
          entries = await fetchTimeline(apiKey, eventId, leagueLimits);
        } catch (error) {
          if (error instanceof RequestLimitReached) { limitReached = true; break; }
          console.error(`[TheSportsDB] ❌ ${league.name}:`, error);
          failed++;
          await sleep(REQUEST_INTERVAL_MS);
          continue;
        }

        fetched++;
        const scoreMatches = matchesScore(eventId, entries);
        const cached = cache.get(eventId);
        const previous = cached && { scoreMatches: matchesScore(eventId, cached.entries), entryCount: cached.entries.length };
        if (!shouldReplaceStored(previous, { scoreMatches, entryCount: entries.length })) {
          kept++;
        } else {
          pending.push({
            eventId, leagueId: league.idLeague, season, timeline: entries, scoreMatches, fetchedAt: new Date().toISOString(),
          });
          // DB 저장 실패는 경기 단위 실패가 아니라 리그 실패로 올린다
          if (pending.length >= CACHE_WRITE_BATCH) await flush();
        }
        await sleep(REQUEST_INTERVAL_MS);
      }
      await flush();
      if (failed > 0) ok = false;
      if (limitReached) console.warn(`[TheSportsDB] ⚠️  Request share used up for ${league.name}; remaining matches continue next run.`);

      const missing = [...eventsById.keys()].filter(id => !cache.has(id)).length;
      if (missing > 0) {
        console.warn(`🟡 ${league.name}: ${missing}/${eventsById.size} finished matches not cached yet. Keeping existing player stats.`);
        continue;
      }

      // 시즌 중 상태가 FINISHED 가 아니게 바뀐 경기(연기 등)는 집계에서 뺀다
      const usable = [...eventsById.values()].map(event => ({ eventId: event.id, date: event.date, entries: cache.get(event.id)!.entries }));
      const mismatched = usable.filter(t => !matchesScore(t.eventId, t.entries)).length;
      const rows = aggregateTimelines(usable, league.idLeague, season);

      // 삭제 비율은 이번 upsert 전 기존 행 기준으로 계산해야 신규 선수 때문에 낮아지지 않는다.
      const { data: existing, error: selectError } = await supa
        .from(PLAYER_STATISTICS_TABLE)
        .select('idPlayer')
        .eq('idLeague', league.idLeague)
        .eq('strSeason', season);
      if (selectError) throw selectError;

      if (rows.length > 0) {
        const { error: statsError } = await supa
          .from(PLAYER_STATISTICS_TABLE)
          .upsert(rows, { onConflict: 'idPlayer,idLeague,strSeason' });
        if (statsError) throw statsError;
      }

      // 스코어와 맞지 않는 경기가 있으면 빠진 기록일 수 있어 기존 선수 행은 지우지 않는다
      const { stale, skip: overLimit } = planStaleDeletion(existing.map(r => String(r.idPlayer)), rows.map(r => r.idPlayer));
      const skip = overLimit || mismatched > 0;
      if (skip) {
        if (stale.length > 0) console.warn(`[DB] ⚠️  Skipping stale cleanup for ${league.name}: ${stale.length}/${existing.length} rows missing from timelines, ${mismatched} matches not matching score.`);
      } else if (stale.length > 0) {
        const { error: deleteError } = await supa
          .from(PLAYER_STATISTICS_TABLE)
          .delete()
          .eq('idLeague', league.idLeague)
          .eq('strSeason', season)
          .in('idPlayer', stale);
        if (deleteError) throw deleteError;
      }

      console.log(
        `[DB] ✅ ${league.name}: fetched ${fetched}/${toFetch.length} timelines (kept ${kept} cached, failed ${failed}), ` +
        `${usable.length}/${eventsById.size} matches stored (${mismatched} not matching score), ` +
        `${rows.length} players, removed ${skip ? 0 : stale.length}.`
      );
    } catch (error) {
      console.error(`❌ Europe player stats failed for ${league.name}:`, error);
      ok = false;
    } finally {
      limits.remaining -= leagueBudget - leagueLimits.remaining;
    }
  }

  return ok;
}
