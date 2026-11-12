-- 17: 뷰를 security_invoker 로 전환 (2026-11-12 Security Advisor 경고 대응)
--
-- top_scorers / top_assisters / v2_events_enhanced 는 소유자(postgres) 권한으로 실행돼
-- 기반 테이블의 RLS 를 우회하고 있었다. security_invoker 를 켜면 조회하는 역할의 권한과 RLS 가 적용된다.
--
-- 기반 테이블(player_statistics, events_v2, events_highlightly_enhanced)은 모두
-- anon SELECT 권한과 공개 읽기 정책이 있으므로 프론트엔드 조회 결과는 바뀌지 않는다.
-- (적용 전 anon 기준 행 수: top_scorers 265, top_assisters 322, v2_events_enhanced 4511)
-- 여러 번 실행해도 안전하다. Postgres 15 이상 필요.

ALTER VIEW public.top_scorers SET (security_invoker = true);
ALTER VIEW public.top_assisters SET (security_invoker = true);
ALTER VIEW public.v2_events_enhanced SET (security_invoker = true);

-- 검증 (3행 모두 security_invoker=true 여야 정상)
-- select c.relname, c.reloptions from pg_class c
--   where c.relnamespace = 'public'::regnamespace and c.relkind = 'v';
