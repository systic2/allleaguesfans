-- 22: K리그 선수 ID 연결 (2026-11-19)
--
-- K리그 개인 기록(player_statistics, idLeague 4689·4822)은 kleague.com 선수 ID 로 저장되고,
-- 선수 명단(players_v2)은 TheSportsDB 선수 ID 를 써서 두 데이터가 이어지지 않았다.
-- K리그 기록 동기화(scripts/sync/lib/kleague-player-stats.ts)가 같은 팀 명단에서 영문 이름이
-- 정확히 한 명과 일치할 때만 여기 연결을 남긴다. 확실하지 않은 선수는 연결하지 않는다.
--
-- 같은 사람의 ID 대응이라 시즌·이적과 관계없이 유지한다. 연결은 1:1 이다(명단 선수 하나에 kleague.com 선수 하나).
-- 화면은 anon 으로 읽기만 한다.
-- 여러 번 실행해도 안전하다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kleague_player_links (
  -- kleague.com 선수 ID (player_statistics."idPlayer")
  "kleaguePlayerId" TEXT PRIMARY KEY,
  -- TheSportsDB 선수 ID (players_v2."idPlayer")
  "idPlayer" TEXT NOT NULL,
  "matchedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kleague_player_links_player
  ON public.kleague_player_links ("idPlayer");

ALTER TABLE public.kleague_player_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kleague_player_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.kleague_player_links TO anon, authenticated;

DROP POLICY IF EXISTS "kleague_player_links public read" ON public.kleague_player_links;
CREATE POLICY "kleague_player_links public read" ON public.kleague_player_links
  FOR SELECT TO anon, authenticated USING (true);

COMMIT;

-- 검증: 테이블이 있고 RLS 가 켜져 있어야 정상
-- select relname, relrowsecurity from pg_class where oid = 'public.kleague_player_links'::regclass;
