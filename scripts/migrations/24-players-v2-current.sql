-- 24: 현재 선수단만 보는 뷰 (2026-11-21)
--
-- 명단 수집(scripts/sync/import-team-players.ts)은 응답에서 빠진 선수를 지우지 않고, 한 번의 실행이 받은 행에 같은
-- updated_at 을 찍는다. 팀 선수단 화면과 K리그 선수 연결은 src/lib/roster-snapshot.ts 의 currentRoster 로
-- 팀의 최신 수집 시각에서 60초 안의 행만 현재 선수단으로 본다.
-- /players 목록은 서버에서 거르고 세고 페이지를 나누므로 같은 기준을 이 뷰로 둔다.
-- (적용 전 anon 기준: players_v2 4508행 중 739행이 이전 명단에만 있는 행, 뷰는 3769행 = 마지막 명단 수집 행 수)
--
-- 감독·코치는 거르지 않는다(화면 쿼리가 따로 뺀다). updated_at 이 없는 행은 판단할 수 없어 남긴다(currentRoster 와 같음).
-- security_invoker 라 조회하는 역할의 권한과 players_v2 의 RLS 가 그대로 적용된다.
-- 여러 번 실행해도 안전하다. Postgres 15 이상 필요.

BEGIN;

CREATE OR REPLACE VIEW public.players_v2_current
WITH (security_invoker = true) AS
SELECT p.*
FROM public.players_v2 p
-- 팀별 최신 수집 시각을 한 번에 구해 붙인다(행마다 서브쿼리를 돌지 않게)
LEFT JOIN (
  SELECT "idTeam", max(updated_at) AS latest_updated_at
  FROM public.players_v2
  WHERE "idTeam" IS NOT NULL
  GROUP BY "idTeam"
) latest ON latest."idTeam" = p."idTeam"
WHERE p.updated_at IS NULL
   OR p."idTeam" IS NULL
   OR p.updated_at >= latest.latest_updated_at - interval '60 seconds';

REVOKE ALL ON public.players_v2_current FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.players_v2_current TO anon, authenticated;

COMMIT;

-- 검증: 적용 시점 기준 3769행(감독·코치 포함)이 나와야 정상
-- select count(*) from public.players_v2_current;
