-- migrations/10-insert-historical-champions.sql
-- This script inserts historical champions data for K League 1 and K League 2
-- into the `standings_v2` table. It also ensures necessary historical teams exist in `teams_v2`.

BEGIN;

-- 1. Insert missing historical teams into `teams_v2`
-- These teams no longer exist or have changed names significantly, but are needed for foreign keys.
INSERT INTO public.teams_v2 ("id", "name", "nameKorean", "badgeUrl", "sourceIds", "createdAt", "updatedAt")
VALUES
    ('hist_hallelujah', 'Hallelujah FC', '할렐루야 FC', NULL, '{"type": "historical"}', NOW(), NOW()),
    ('hist_ansan_mugunghwa', 'Ansan Mugunghwa', '안산 무궁화', NULL, '{"type": "historical"}', NOW(), NOW()),
    ('hist_asan_mugunghwa', 'Asan Mugunghwa', '아산 무궁화', NULL, '{"type": "historical"}', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 2. Insert Historical Champions into `standings_v2`
-- Note: Points and other stats are set to 0 as we only need the champion record (Rank 1).
-- League IDs: K League 1 = '4689', K League 2 = '4822'

-- K League 1 Champions
INSERT INTO public.standings_v2 ("leagueId", "teamId", "season", "rank", "teamName", "points", "gamesPlayed", "wins", "draws", "losses", "goalsFor", "goalsAgainst", "goalDifference", "lastUpdated", "createdAt")
VALUES
  ('4689', 'hist_hallelujah', '1983', 1, 'Hallelujah FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138106', '1984', 1, 'Busan IPark', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Daewoo Royals
  ('4689', '138115', '1985', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Lucky-Goldstar Hwangso
  ('4689', '138112', '1986', 1, 'Pohang Steelers', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- POSCO Atoms
  ('4689', '138106', '1987', 1, 'Busan IPark', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Daewoo Royals
  ('4689', '138112', '1988', 1, 'Pohang Steelers', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- POSCO Atoms
  ('4689', '139078', '1989', 1, 'Jeju United', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Yukong Elephants
  ('4689', '138115', '1990', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Lucky-Goldstar Hwangso
  ('4689', '138106', '1991', 1, 'Busan IPark', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Daewoo Royals
  ('4689', '138112', '1992', 1, 'Pohang Steelers', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- POSCO Atoms
  ('4689', '138114', '1993', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Ilhwa Chunma
  ('4689', '138114', '1994', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138114', '1995', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138117', '1996', 1, 'Ulsan HD', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Ulsan Hyundai Horang-i
  ('4689', '138106', '1997', 1, 'Busan IPark', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Busan Daewoo Royals
  ('4689', '138116', '1998', 1, 'Suwon Samsung Bluewings', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138116', '1999', 1, 'Suwon Samsung Bluewings', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138115', '2000', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Anyang LG Cheetahs
  ('4689', '138114', '2001', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Seongnam Ilhwa Chunma
  ('4689', '138114', '2002', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138114', '2003', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138116', '2004', 1, 'Suwon Samsung Bluewings', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138117', '2005', 1, 'Ulsan HD', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Ulsan Hyundai Horang-i
  ('4689', '138114', '2006', 1, 'Seongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138112', '2007', 1, 'Pohang Steelers', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138116', '2008', 1, 'Suwon Samsung Bluewings', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2009', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138115', '2010', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2011', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138115', '2012', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138112', '2013', 1, 'Pohang Steelers', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2014', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2015', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138115', '2016', 1, 'FC Seoul', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2017', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2018', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2019', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2020', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138111', '2021', 1, 'Jeonbuk Hyundai Motors', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4689', '138117', '2022', 1, 'Ulsan HD', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Ulsan Hyundai
  ('4689', '138117', '2023', 1, 'Ulsan HD', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Ulsan Hyundai
  ('4689', '138117', '2024', 1, 'Ulsan HD', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())
ON CONFLICT ("leagueId", "teamId", "season") DO NOTHING;

-- K League 2 Champions
INSERT INTO public.standings_v2 ("leagueId", "teamId", "season", "rank", "teamName", "points", "gamesPlayed", "wins", "draws", "losses", "goalsFor", "goalsAgainst", "goalDifference", "lastUpdated", "createdAt")
VALUES
  ('4822', '138113', '2013', 1, 'Gimcheon Sangmu', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Sangju Sangmu
  ('4822', '139785', '2014', 1, 'Daejeon Hana Citizen', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Daejeon Citizen
  ('4822', '138113', '2015', 1, 'Gimcheon Sangmu', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()), -- Sangju Sangmu
  ('4822', 'hist_ansan_mugunghwa', '2016', 1, 'Ansan Mugunghwa', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '139079', '2017', 1, 'Gyeongnam FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', 'hist_asan_mugunghwa', '2018', 1, 'Asan Mugunghwa', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '138109', '2019', 1, 'Gwangju FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '139078', '2020', 1, 'Jeju United', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '138113', '2021', 1, 'Gimcheon Sangmu', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '138109', '2022', 1, 'Gwangju FC', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '138113', '2023', 1, 'Gimcheon Sangmu', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW()),
  ('4822', '139786', '2024', 1, 'FC Anyang', 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())
ON CONFLICT ("leagueId", "teamId", "season") DO NOTHING;

COMMIT;
