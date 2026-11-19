-- 23: kleague.com 선수 생년월일 캐시 (2026-11-20)
--
-- K리그 선수 연결(kleague_player_links, migration 22)은 영문 이름으로 못 이은 선수를 kleague.com 선수 상세 페이지의
-- 생년월일로 한 번 더 찾는다. 생년월일은 바뀌지 않으니 한 번 받은 값은 여기 두고, 매시간 동기화가 같은 페이지를
-- 다시 받지 않게 한다.
-- "birthDate" 가 NULL 이면 페이지는 받았지만 생년월일이 없던 경우다(동기화가 7일 뒤 다시 확인한다).
--
-- 동기화(service role)만 쓴다. 화면은 읽지 않으므로 anon·authenticated 권한은 주지 않는다(event_timelines 와 같음).
-- 여러 번 실행해도 안전하다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kleague_player_birthdates (
  -- kleague.com 선수 ID (player_statistics."idPlayer")
  "kleaguePlayerId" TEXT PRIMARY KEY,
  "birthDate" DATE,
  "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kleague_player_birthdates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kleague_player_birthdates FROM PUBLIC, anon, authenticated;

COMMIT;

-- 검증: 테이블이 있고 RLS 가 켜져 있어야 정상
-- select relname, relrowsecurity from pg_class where oid = 'public.kleague_player_birthdates'::regclass;
