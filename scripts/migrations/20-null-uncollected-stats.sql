-- 20: 수집하지 않은 기록을 0 대신 NULL 로 둔다 (docs/prd.md DATA-02·03·04)
--
-- player_statistics
--   통계 컬럼이 DEFAULT 0 이라 수집 스크립트가 쓰지 않는 항목이 0 으로 저장됐다.
--   (2026-11-18 기준) 수집 경로별로 실제로 쓰는 항목:
--     K리그(4689, 4822, kleague.com 순위): goals, assists, appearances, yellow_cards, red_cards
--     유럽(event_timeline 집계):            goals, assists, yellow_cards, red_cards, penalties_scored, penalties_missed
--   minutes_played, own_goals 는 어느 경로도 쓰지 않는다.
--   DEFAULT 를 없애 앞으로 쓰지 않는 항목은 NULL 로 들어가게 하고, 기존 0 을 NULL 로 바꾼다.
--
-- standings_v2
--   10-insert-historical-champions.sql 은 K리그 과거 우승팀을 경기·승점 0 으로 넣었고,
--   import-historical-champions-euro.ts 도 TheSportsDB 가 0 으로 준 과거 시즌을 그대로 넣었다.
--   우승팀(rank 1)이 한 경기도 안 치렀을 수는 없으므로 수집되지 않은 값으로 보고 NULL 로 바꾼다.
--   현재 시즌(리그별 최신 시즌)은 개막 전이면 0 이 실제 값이므로 건드리지 않는다.
--   lastUpdated 는 원천 갱신 시각만 담도록 NULL 을 허용한다 (수집 시각은 sync_runs 가 기록).
--   이미 저장된 다른 행의 lastUpdated 가 원천 값인지 예전 매퍼가 채운 수집 시각인지는 DB 만으로 구분할 수 없다.
--   현재 시즌 행은 다음 수집 때 원천 값(없으면 NULL)으로 덮이고, 그 밖의 과거 행은 그대로 둔다.
--
-- 여러 번 실행해도 안전하다.

BEGIN;

-- player_statistics ---------------------------------------------------------

ALTER TABLE public.player_statistics
  ALTER COLUMN goals DROP DEFAULT,
  ALTER COLUMN assists DROP DEFAULT,
  ALTER COLUMN yellow_cards DROP DEFAULT,
  ALTER COLUMN red_cards DROP DEFAULT,
  ALTER COLUMN appearances DROP DEFAULT,
  ALTER COLUMN minutes_played DROP DEFAULT,
  ALTER COLUMN own_goals DROP DEFAULT,
  ALTER COLUMN penalties_scored DROP DEFAULT,
  ALTER COLUMN penalties_missed DROP DEFAULT;

-- 기본값으로 들어간 0 만 지운다. 0 이 아닌 값은 어디서 왔든 실제 값으로 보고 남긴다 (다시 실행해도 안전).
UPDATE public.player_statistics SET minutes_played = NULL WHERE minutes_played = 0;
UPDATE public.player_statistics SET own_goals = NULL WHERE own_goals = 0;

UPDATE public.player_statistics SET penalties_scored = NULL
WHERE "idLeague" IN ('4689', '4822') AND penalties_scored = 0;
UPDATE public.player_statistics SET penalties_missed = NULL
WHERE "idLeague" IN ('4689', '4822') AND penalties_missed = 0;

UPDATE public.player_statistics SET appearances = NULL
WHERE "idLeague" NOT IN ('4689', '4822') AND appearances = 0;

-- standings_v2 ----------------------------------------------------------------

ALTER TABLE public.standings_v2
  ALTER COLUMN "points" DROP NOT NULL,
  ALTER COLUMN "gamesPlayed" DROP NOT NULL,
  ALTER COLUMN "wins" DROP NOT NULL,
  ALTER COLUMN "draws" DROP NOT NULL,
  ALTER COLUMN "losses" DROP NOT NULL,
  ALTER COLUMN "goalsFor" DROP NOT NULL,
  ALTER COLUMN "goalsAgainst" DROP NOT NULL,
  ALTER COLUMN "goalDifference" DROP NOT NULL,
  ALTER COLUMN "lastUpdated" DROP NOT NULL;

UPDATE public.standings_v2 s
SET "points" = NULL, "gamesPlayed" = NULL, "wins" = NULL, "draws" = NULL, "losses" = NULL,
    "goalsFor" = NULL, "goalsAgainst" = NULL, "goalDifference" = NULL, "lastUpdated" = NULL
WHERE s."rank" = 1
  AND s."gamesPlayed" = 0
  AND s."points" = 0
  AND s."season" < (SELECT max(latest."season") FROM public.standings_v2 latest WHERE latest."leagueId" = s."leagueId");

COMMIT;

-- 검증
--   select count(*) from player_statistics where minutes_played is not null or own_goals is not null;   -- 0
--   select count(*) from standings_v2 where "gamesPlayed" = 0 and rank = 1 and season < '2025';         -- 0
--   select column_name, column_default from information_schema.columns
--     where table_name = 'player_statistics' and column_default is not null;                             -- id, last_updated, created_at 만
