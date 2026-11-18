-- 21: 수집 단계별 실행 기록 (docs/prd.md 10장 sync_runs, COMMON-02 기준 시각)
--
-- scripts/sync/orchestrator.ts 가 단계(standings, events, kleague_player_stats, europe_player_stats)마다
-- 한 행을 남긴다. 화면은 sync_status 뷰로 단계별 마지막 성공 시각만 읽는다.
-- error 컬럼은 내부 로그라 anon 에게 열지 않는다 (컬럼 단위 권한).
--
-- 여러 번 실행해도 안전하다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sync_runs (
  "id" BIGSERIAL PRIMARY KEY,
  "step" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL,
  "finishedAt" TIMESTAMPTZ NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_step_finished
  ON public.sync_runs ("step", "finishedAt" DESC);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sync_runs FROM anon, authenticated;
GRANT SELECT ("step", "startedAt", "finishedAt", "ok") ON public.sync_runs TO anon, authenticated;

DROP POLICY IF EXISTS "sync_runs public read" ON public.sync_runs;
CREATE POLICY "sync_runs public read" ON public.sync_runs
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE VIEW public.sync_status
WITH (security_invoker = true) AS
SELECT "step", max("finishedAt") AS "lastSuccessAt"
FROM public.sync_runs
WHERE "ok"
GROUP BY "step";

GRANT SELECT ON public.sync_status TO anon, authenticated;

COMMIT;

-- 검증 (anon 키로)
--   select * from sync_status;                 -- 단계별 마지막 성공 시각
--   select error from sync_runs limit 1;       -- permission denied 여야 정상
