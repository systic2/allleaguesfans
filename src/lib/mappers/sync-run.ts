// src/lib/mappers/sync-run.ts
// scripts/sync/orchestrator.ts 가 단계마다 sync_runs 에 남기는 행 (migration 21).

export interface SyncRunRow {
  step: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  error: string | null;
}

/**
 * 단계 결과를 sync_runs 행으로 만든다.
 * 단계 함수는 실패를 로그로 남기고 false 만 돌려주므로, 예외 메시지가 없으면 일반 문구를 쓰고
 * GitHub Actions 실행 주소가 있으면 붙여 로그로 바로 갈 수 있게 한다.
 */
export function buildSyncRunRow(
  step: string, startedAt: string, finishedAt: string, ok: boolean, thrown: unknown, runUrl: string | null
): SyncRunRow {
  let error: string | null = null;
  if (!ok) {
    error = thrown === undefined ? 'step reported failures' : thrown instanceof Error ? thrown.message : String(thrown);
    if (runUrl) error = `${error} (${runUrl})`;
  }
  return { step, startedAt, finishedAt, ok, error };
}
