-- 18: 유럽 리그 경기 타임라인 캐시 (2026-11-13)
--
-- TheSportsDB v2 event_timeline 으로 경기별 득점·도움·카드를 받아 선수 시즌 통계를 집계한다.
-- 매 동기화마다 시즌 전체 경기를 다시 받으면 요청이 수백 건이라, 받은 타임라인을 여기 저장하고
-- 새로 끝난 경기와 아직 확정되지 않은 경기만 다시 받는다.
--
-- 동기화 스크립트(service_role)만 읽고 쓴다. 프론트엔드는 집계 결과인 player_statistics 만 읽으므로
-- RLS 를 켜고 정책을 두지 않으며 anon/authenticated 권한도 회수한다.
-- 여러 번 실행해도 안전하다.

CREATE TABLE IF NOT EXISTS public.event_timelines (
  "eventId" TEXT PRIMARY KEY REFERENCES public.events_v2("id") ON DELETE CASCADE,
  "leagueId" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  -- 득점·카드 행만 추려 저장 (교체·VAR 행 제외)
  "timeline" JSONB NOT NULL,
  -- 타임라인 득점 수가 최종 스코어와 맞는지 (맞지 않으면 아직 입력 중인 것으로 보고 다시 받는다)
  "scoreMatches" BOOLEAN NOT NULL,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_timelines_league_season
  ON public.event_timelines ("leagueId", "season");

ALTER TABLE public.event_timelines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_timelines FROM anon, authenticated;

-- 검증: 테이블이 있고 RLS 가 켜져 있어야 정상
-- select relname, relrowsecurity from pg_class where oid = 'public.event_timelines'::regclass;
