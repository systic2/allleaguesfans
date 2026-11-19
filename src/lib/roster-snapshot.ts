// src/lib/roster-snapshot.ts
// players_v2 명단에서 감독·코치와 이전 명단을 걸러낸다. 화면(src/lib/squad.ts)과 K리그 선수 연결(동기화)이 같은 기준을 쓴다.
import { STAFF_POSITIONS } from './positions';

// 한 번의 수집 실행은 모든 행에 같은 시각을 찍는다 (이전 스크립트로 넣은 행은 같은 실행 안에서도 1초 안팎 차이)
const SNAPSHOT_WINDOW_MS = 60 * 1000;

/**
 * 감독·코치를 빼고, 팀의 마지막 명단 수집과 함께 들어온 선수만 남긴다. players 는 한 팀의 명단이어야 한다.
 * 수집 스크립트는 응답에서 빠진 선수를 지우지 않으므로, 최신 수집 시각보다 1분 넘게 오래된 행은 이전 명단으로 본다.
 * 수집 시각이 없는 행은 판단할 수 없어 남긴다.
 */
export function currentRoster<T extends { strPosition: string | null; updatedAt: string | null }>(players: T[]): T[] {
  const latest = Math.max(...players.map((p) => (p.updatedAt ? Date.parse(p.updatedAt) : NaN)).filter((t) => !Number.isNaN(t)));
  return players.filter((p) => {
    if (STAFF_POSITIONS.includes(p.strPosition ?? "")) return false;
    const at = p.updatedAt ? Date.parse(p.updatedAt) : NaN;
    return Number.isNaN(at) || !Number.isFinite(latest) || latest - at <= SNAPSHOT_WINDOW_MS;
  });
}
