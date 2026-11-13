// src/lib/mappers/thesportsdb-timeline-mappers.ts
// TheSportsDB v2 경기 타임라인(/lookup/event_timeline/{id}) 응답을 검증하고 선수 시즌 통계로 집계한다.
// 네트워크·DB 는 scripts/sync/lib/europe-player-stats.ts 가 담당하고, 여기는 순수 함수만 둔다.

// 저장·집계에 쓰는 타임라인 행 (득점·카드만)
export interface TimelineEntry {
  idTimeline: string;
  type: 'Goal' | 'Card';
  // Goal: 'Normal Goal' | 'Penalty' | 'Own Goal' | 'Missed Penalty', Card: 'Yellow Card' | 'Red Card'
  detail: string;
  // 선수 연결이 안 된 행(코칭스태프 카드 등)은 null: 스코어 비교에는 쓰고 선수 집계에서는 뺀다
  idPlayer: string | null;
  strPlayer: string;
  idAssist: string | null;
  strAssist: string | null;
  // 자책골은 득점이 인정된 팀이 들어온다 (선수 소속팀이 아님)
  idTeam: string;
  strTeam: string;
  isHome: boolean;
}

export interface StoredTimeline {
  eventId: string;
  date: string;
  entries: TimelineEntry[];
}

export interface FinishedEvent {
  id: string;
  date: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface StoredTimelineState {
  scoreMatches: boolean;
  fetchedAt: string;
}

export interface TimelinePlayerStatisticsRow {
  idPlayer: string;
  strPlayer: string;
  idTeam: string;
  strTeam: string;
  idLeague: string;
  strSeason: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  penalties_scored: number;
  penalties_missed: number;
  last_updated: string;
}

const HOUR_MS = 60 * 60 * 1000;
// 경기 후 이 시간 동안은 득점·도움 정정이 있을 수 있어 매번 다시 받는다
const SETTLE_WINDOW_MS = 48 * HOUR_MS;
// 킥오프 후 이 기간이 지나면 어떤 이유로도 다시 받지 않는다 (이후엔 원본이 더 채워지지 않는 것으로 본다)
const RETRY_WINDOW_MS = 7 * 24 * HOUR_MS;

function isPresentId(id: unknown): id is string {
  return typeof id === 'string' && id !== '' && id !== '0';
}

/**
 * event_timeline 응답 본문을 검증해 득점·카드 행만 돌려준다.
 * 데이터가 없는 경기는 {"Message":"No data found"} 가 오며 빈 배열로 본다.
 * 형식이 다르거나 다른 경기 행이 섞여 있으면 잘못 집계하지 않도록 예외를 던진다.
 * 같은 idTimeline 이 두 번 오면 한 번만 센다.
 */
export function parseTimelineResponse(body: unknown, eventId: string): TimelineEntry[] {
  const response = body as { lookup?: unknown; Message?: unknown } | null;
  if (response?.Message === 'No data found' && response.lookup === undefined) return [];
  if (!Array.isArray(response?.lookup)) throw new Error(`event_timeline ${eventId}: unexpected response shape`);

  const entries: TimelineEntry[] = [];
  const seen = new Set<string>();
  for (const row of response.lookup as Record<string, unknown>[]) {
    if (String(row.idEvent) !== eventId) throw new Error(`event_timeline ${eventId}: row for event ${String(row.idEvent)}`);
    if (row.strTimeline !== 'Goal' && row.strTimeline !== 'Card') continue;
    if (!isPresentId(row.idTimeline) || !isPresentId(row.idTeam) || typeof row.strTimelineDetail !== 'string') {
      throw new Error(`event_timeline ${eventId}: ${row.strTimeline} row ${String(row.idTimeline)} missing id/team/detail`);
    }
    if (seen.has(row.idTimeline)) continue;
    seen.add(row.idTimeline);
    entries.push({
      idTimeline: row.idTimeline,
      type: row.strTimeline,
      detail: row.strTimelineDetail,
      idPlayer: isPresentId(row.idPlayer) ? row.idPlayer : null,
      strPlayer: String(row.strPlayer ?? ''),
      idAssist: isPresentId(row.idAssist) ? row.idAssist : null,
      strAssist: isPresentId(row.idAssist) ? String(row.strAssist ?? '') : null,
      idTeam: row.idTeam,
      strTeam: String(row.strTeam ?? ''),
      isHome: row.strHome === 'Yes',
    });
  }
  return entries;
}

function isScoredGoal(entry: TimelineEntry): boolean {
  return entry.type === 'Goal' && entry.detail !== 'Missed Penalty';
}

/** 타임라인의 홈/원정 득점 수가 최종 스코어와 같은지 (자책골 포함, 실축 PK 제외). */
export function timelineMatchesScore(entries: TimelineEntry[], homeScore: number | null, awayScore: number | null): boolean {
  if (homeScore === null || awayScore === null) return false;
  const goals = entries.filter(isScoredGoal);
  const home = goals.filter(e => e.isHome).length;
  return home === homeScore && goals.length - home === awayScore;
}

export interface TimelineSnapshot {
  scoreMatches: boolean;
  entryCount: number;
}

/**
 * 새로 받은 타임라인으로 캐시를 바꿀지 정한다.
 * 일시적으로 덜 채워진 응답(빈 응답, 도움·카드 누락)이 더 완전한 캐시를 덮어쓰지 않도록
 * - 스코어 일치 여부가 다르면 일치하는 쪽을 남기고
 * - 같으면 행이 줄지 않을 때만 바꾼다.
 */
export function shouldReplaceStored(previous: TimelineSnapshot | undefined, next: TimelineSnapshot): boolean {
  if (!previous) return true;
  if (previous.scoreMatches !== next.scoreMatches) return next.scoreMatches;
  return next.entryCount >= previous.entryCount;
}

/**
 * 이번 실행에서 타임라인을 받을 경기를 고른다.
 * - 아직 저장되지 않은 경기
 * - 킥오프 후 48시간 안에 받은 경기 (정정 반영)
 * - 스코어와 맞지 않은 경기
 * 다시 받는 경우는 모두 킥오프 후 7일까지만이다 (캐시를 유지해 fetchedAt 이 그대로여도 끝없이 다시 받지 않도록).
 * 새로 저장할 경기를 먼저, 그 안에서는 최근 경기부터 고르고 limit 개로 자른다.
 */
export function selectEventsToFetch(
  events: FinishedEvent[], stored: Map<string, StoredTimelineState>, now: Date, limit: number
): string[] {
  const nowMs = now.getTime();
  const missing: FinishedEvent[] = [];
  const refresh: FinishedEvent[] = [];
  for (const event of events) {
    const kickoff = new Date(event.date).getTime();
    const state = stored.get(event.id);
    if (!state) { missing.push(event); continue; }
    const fetchedAt = new Date(state.fetchedAt).getTime();
    const unsettled = fetchedAt < kickoff + SETTLE_WINDOW_MS;
    if ((unsettled || !state.scoreMatches) && nowMs < kickoff + RETRY_WINDOW_MS) refresh.push(event);
  }
  const newestFirst = (a: FinishedEvent, b: FinishedEvent) => b.date.localeCompare(a.date);
  return [...missing.sort(newestFirst), ...refresh.sort(newestFirst)].slice(0, limit).map(e => e.id);
}

/**
 * 저장된 타임라인을 선수별 시즌 통계로 합친다.
 * 자책골은 득점·소속팀 판단에서 뺀다 (행의 팀이 상대팀이라서). 선수 연결이 안 된 행도 뺀다.
 * 선수 이름·소속팀은 가장 최근 경기 기준이다.
 */
export function aggregateTimelines(
  timelines: StoredTimeline[], idLeague: string, season: string, now: string = new Date().toISOString()
): TimelinePlayerStatisticsRow[] {
  const byPlayer = new Map<string, TimelinePlayerStatisticsRow>();

  const touch = (idPlayer: string, strPlayer: string, idTeam: string, strTeam: string) => {
    let row = byPlayer.get(idPlayer);
    if (!row) {
      row = {
        idPlayer, strPlayer, idTeam, strTeam, idLeague, strSeason: season,
        goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, penalties_scored: 0, penalties_missed: 0,
        last_updated: now,
      };
      byPlayer.set(idPlayer, row);
    }
    // 경기 날짜순으로 돌기 때문에 마지막에 쓴 값이 최신 소속팀이 된다.
    // 도움 행에는 이름이 비어 올 수 있어 이름은 비어 있지 않은 최신 값을 쓴다.
    row.idTeam = idTeam;
    row.strTeam = strTeam;
    if (strPlayer) row.strPlayer = strPlayer;
    return row;
  };

  const byDate = [...timelines].sort((a, b) => a.date.localeCompare(b.date));
  for (const { entries } of byDate) {
    for (const entry of entries) {
      if (!entry.idPlayer) continue;
      if (entry.type === 'Goal') {
        if (entry.detail === 'Own Goal') continue;
        const scorer = touch(entry.idPlayer, entry.strPlayer, entry.idTeam, entry.strTeam);
        if (entry.detail === 'Missed Penalty') { scorer.penalties_missed++; continue; }
        scorer.goals++;
        if (entry.detail === 'Penalty') scorer.penalties_scored++;
        // 도움 선수는 득점 선수와 같은 팀
        if (entry.idAssist) touch(entry.idAssist, entry.strAssist ?? '', entry.idTeam, entry.strTeam).assists++;
      } else {
        const player = touch(entry.idPlayer, entry.strPlayer, entry.idTeam, entry.strTeam);
        if (entry.detail === 'Yellow Card') player.yellow_cards++;
        else if (entry.detail === 'Red Card') player.red_cards++;
      }
    }
  }
  return [...byPlayer.values()];
}
