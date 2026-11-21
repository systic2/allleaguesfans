-- 25: Supabase pg_cron 으로 데이터 수집 워크플로를 매시 실행 (2026-11-21)
--
-- .github/workflows/data-sync.yml 은 매시 정각(schedule)으로 예약돼 있지만 GitHub 예약 실행이 밀려
-- 2026-11-20(UTC)에는 00:05, 07:55, 16:36, 22:53 에만 돌았다. 그래서 매시 7분에 pg_cron 이 pg_net 으로
-- GitHub API(workflow_dispatch)를 불러 워크플로를 직접 실행한다. 워크플로의 schedule 은 6시간마다 도는 예비로
-- 줄인다(토큰이 만료돼도 수집이 멈추지 않게). 예비 실행은 이 실행과 별개로 하나 더 돌 수 있지만 concurrency 그룹
-- data-sync 라 겹쳐 돌지 않고, 수집은 upsert 라 한 번 더 돌아도 행이 중복되지 않는다.
--
-- 적용 전 준비 (토큰은 저장소에 커밋하지 않는다):
--   1. GitHub → Settings → Developer settings → Fine-grained personal access token
--      - Repository access: systic2/allleaguesfans 만
--      - Permissions: Actions = Read and write (나머지는 없음)
--      - 만료일을 정하고, 만료되면 새 토큰을 만들어 아래 2번처럼 Vault 값을 바꾼다
--   2. Dashboard → Integrations → Vault 에서 이름 github_actions_dispatch_token 으로 토큰을 넣는다
--      (토큰을 바꿀 때도 같은 화면에서 값을 고친다). SQL Editor 에서
--        select vault.create_secret('<토큰>', 'github_actions_dispatch_token', 'data-sync.yml 실행용');
--      로 넣어도 되지만, 그러면 토큰이 SQL Editor 쿼리 기록에 남으므로 실행 뒤 그 기록을 지운다.
--
-- 토큰이 Vault 에 없으면 작업은 요청을 보내지 않는다(아무 일도 하지 않음).
-- 주의: 요청이 처리되기 전까지 토큰이 net.http_request_queue 에 잠시 남는다. 이 스키마는 PostgREST 로
-- 노출되지 않아 anon 은 읽을 수 없고, 데이터베이스에 직접 로그인하는 역할만 볼 수 있다.
--
-- 여러 번 실행해도 안전하다(같은 이름의 작업을 지우고 다시 만든다).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-data-sync';

SELECT cron.schedule(
  'dispatch-data-sync',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://api.github.com/repos/systic2/allleaguesfans/actions/workflows/data-sync.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || s.decrypted_secret,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'allleaguesfans-supabase-cron',
      'Content-Type', 'application/json'
    ),
    body := '{"ref":"main"}'::jsonb,
    -- pg_net 기본값 2초는 GitHub API 응답이 조금만 늦어도 끊기므로 늘린다
    timeout_milliseconds := 10000
  )
  FROM vault.decrypted_secrets s
  WHERE s.name = 'github_actions_dispatch_token';
  $$
);

COMMIT;

-- 검증
--   select jobname, schedule, active from cron.job where jobname = 'dispatch-data-sync';
--   -- 매시 7분이 지난 뒤: 실행 기록과 GitHub 응답 (204 면 정상, 401·403 이면 토큰·권한 확인)
--   select status, return_message, start_time from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'dispatch-data-sync') order by start_time desc limit 5;
--   select status_code, content, timed_out, error_msg, created from net._http_response order by created desc limit 5;
--   -- GitHub 쪽: gh run list --workflow=data-sync.yml 에 event 가 workflow_dispatch 인 실행이 매시 생긴다
-- 끄기: select cron.unschedule('dispatch-data-sync');
