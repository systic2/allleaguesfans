-- migrate-to-new-schema.sql
-- API-Football 기반 새로운 데이터베이스 스키마 마이그레이션
-- 기존 TheSportsDB 구조에서 API-Football 표준 구조로 전환

-- 1단계: 새 테이블 생성
-- COUNTRIES 테이블 (신규)
CREATE TABLE countries (
  code VARCHAR(2) PRIMARY KEY,           -- 'KR', 'JP'
  name VARCHAR(100) NOT NULL,            -- 'South-Korea'
  flag_url TEXT,                         -- API 플래그 URL
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 기본 국가 데이터 삽입
INSERT INTO countries (code, name, flag_url) VALUES
('KR', 'South-Korea', 'https://media.api-sports.io/flags/kr.svg'),
('JP', 'Japan', 'https://media.api-sports.io/flags/jp.svg');

-- VENUES 테이블 (신규)
CREATE TABLE venues (
  id INTEGER PRIMARY KEY,                -- API venue ID
  name VARCHAR(100) NOT NULL,            -- 'Jeonju World Cup Stadium'
  address TEXT,
  city VARCHAR(50),
  country_code VARCHAR(2) REFERENCES countries(code),
  capacity INTEGER,
  surface VARCHAR(20),                   -- 'grass', 'artificial'
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2단계: 기존 LEAGUES 테이블 백업 및 재생성
CREATE TABLE leagues_backup AS SELECT * FROM leagues;

DROP TABLE IF EXISTS leagues CASCADE;

CREATE TABLE leagues (
  id INTEGER PRIMARY KEY,                -- API league ID (292, 293)
  name VARCHAR(100) NOT NULL,            -- 'K League 1'
  country_code VARCHAR(2) REFERENCES countries(code),
  type VARCHAR(50),                      -- 'League', 'Cup'
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- K-League 데이터 삽입
INSERT INTO leagues (id, name, country_code, type, logo_url, is_active) VALUES
(292, 'K League 1', 'KR', 'League', 'https://media.api-sports.io/football/leagues/292.png', true),
(293, 'K League 2', 'KR', 'League', 'https://media.api-sports.io/football/leagues/293.png', true);

-- 3단계: SEASONS 테이블 수정
CREATE TABLE seasons_backup AS SELECT * FROM seasons;

DROP TABLE IF EXISTS seasons CASCADE;

CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES leagues(id),
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(league_id, year)
);

-- 기존 시즌 데이터 복원
INSERT INTO seasons (league_id, year, is_current) 
SELECT 292, 2024, false
UNION ALL
SELECT 292, 2025, true
UNION ALL  
SELECT 293, 2024, false
UNION ALL
SELECT 293, 2025, true;

-- 4단계: TEAMS 테이블 백업 및 재생성
CREATE TABLE teams_backup AS SELECT * FROM teams;

DROP TABLE IF EXISTS teams CASCADE;

CREATE TABLE teams (
  id INTEGER PRIMARY KEY,                -- API team ID
  name VARCHAR(100) NOT NULL,
  code VARCHAR(3),                       -- 'JEO', 'DAE'
  short_name VARCHAR(20),
  country_code VARCHAR(2) REFERENCES countries(code),
  founded INTEGER,
  is_national BOOLEAN DEFAULT false,
  venue_id INTEGER REFERENCES venues(id),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5단계: PLAYERS 테이블 백업 및 재생성 (스키마 개선)
CREATE TABLE players_backup AS SELECT * FROM players;

DROP TABLE IF EXISTS players CASCADE;

CREATE TABLE players (
  id INTEGER PRIMARY KEY,                -- API player ID
  name VARCHAR(100) NOT NULL,
  firstname VARCHAR(50),
  lastname VARCHAR(50),
  nationality VARCHAR(50),
  birth_date DATE,
  birth_place VARCHAR(100),
  birth_country VARCHAR(100),
  height_cm INTEGER,
  weight_kg INTEGER,
  foot VARCHAR(5),                       -- 'Left', 'Right'
  is_injured BOOLEAN DEFAULT false,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 기존 players 데이터 마이그레이션
INSERT INTO players (
  id, name, firstname, lastname, nationality, 
  birth_date, height_cm, weight_kg, foot, photo_url
)
SELECT 
  id, name, firstname, lastname, nationality,
  birth_date, height_cm, weight_kg, foot, photo_url
FROM players_backup;

-- 6단계: SQUAD_MEMBERSHIPS 테이블 수정
CREATE TABLE squad_memberships_backup AS SELECT * FROM squad_memberships;

DROP TABLE IF EXISTS squad_memberships CASCADE;

CREATE TABLE squad_memberships (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  jersey_number INTEGER,
  position VARCHAR(20),                  -- 'Midfielder', 'Defender'
  is_captain BOOLEAN DEFAULT false,
  is_on_loan BOOLEAN DEFAULT false,
  joined_at DATE,
  left_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, season_year, player_id),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);

-- 7단계: FIXTURES 테이블 백업 및 재생성 (API-Football 구조로)
CREATE TABLE fixtures_backup AS SELECT * FROM fixtures;

DROP TABLE IF EXISTS fixtures CASCADE;

CREATE TABLE fixtures (
  id BIGINT PRIMARY KEY,                 -- API fixture ID
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  round VARCHAR(50),                     -- 'Regular Season - 1'
  kickoff_utc TIMESTAMP,
  timezone VARCHAR(50),                  -- 'UTC', 'Asia/Seoul'
  venue_id INTEGER REFERENCES venues(id),
  referee VARCHAR(100),
  
  -- Status
  status_short VARCHAR(5),               -- 'FT', 'NS', 'LIVE'
  status_long VARCHAR(50),               -- 'Match Finished'
  elapsed_minutes INTEGER,               -- 실제 경기 진행 시간
  
  -- Teams
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  
  -- Goals
  goals_home INTEGER,
  goals_away INTEGER,
  
  -- Score breakdown
  ht_home INTEGER,                       -- Halftime
  ht_away INTEGER,
  ft_home INTEGER,                       -- Fulltime
  ft_away INTEGER,
  et_home INTEGER,                       -- Extratime
  et_away INTEGER,
  pk_home INTEGER,                       -- Penalty
  pk_away INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);

-- 8단계: 핵심 - FIXTURE_EVENTS 테이블 생성 (기존 events 대체)
CREATE TABLE events_backup AS SELECT * FROM events;

DROP TABLE IF EXISTS events CASCADE;

CREATE TABLE fixture_events (
  id BIGSERIAL PRIMARY KEY,
  fixture_id BIGINT REFERENCES fixtures(id),
  team_id INTEGER REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  assist_player_id INTEGER REFERENCES players(id),
  
  -- 시간 정보 (API 표준)
  elapsed_minutes INTEGER NOT NULL,      -- API의 elapsed 그대로 사용
  extra_minutes INTEGER,                 -- API의 extra
  
  -- 이벤트 정보
  event_type VARCHAR(20) NOT NULL,       -- 'Goal', 'Card', 'substitution'
  event_detail VARCHAR(50),              -- 'Normal Goal', 'Yellow Card'
  comments TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 🔥 중복 방지 핵심 제약조건
  UNIQUE(fixture_id, player_id, event_type, elapsed_minutes, event_detail)
);

-- 인덱스 최적화
CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_fixture_events_time ON fixture_events(elapsed_minutes);

-- 9단계: STANDINGS 테이블 수정
CREATE TABLE standings_backup AS SELECT * FROM standings;

DROP TABLE IF EXISTS standings CASCADE;

CREATE TABLE standings (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  team_id INTEGER REFERENCES teams(id),
  
  -- 순위 정보
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  goals_for INTEGER,
  goals_against INTEGER,
  goal_difference INTEGER,
  
  -- 경기 통계
  games_played INTEGER,
  games_won INTEGER,
  games_drawn INTEGER,
  games_lost INTEGER,
  
  -- 기타
  form VARCHAR(10),                      -- 'WDLWW'
  group_name VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, season_year, team_id),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);

-- 기존 standings 데이터 마이그레이션 (스키마 매칭)
INSERT INTO standings (
  league_id, season_year, team_id, rank, points,
  goals_for, goals_against, goal_difference,
  games_played, games_won, games_drawn, games_lost, form
)
SELECT 
  league_id, season_year, team_id, rank, points,
  COALESCE(goals_for, 0), COALESCE(goals_against, 0), COALESCE(goal_difference, 0),
  COALESCE(games_played, 0), COALESCE(games_won, 0), COALESCE(games_drawn, 0), COALESCE(games_lost, 0),
  form
FROM standings_backup;

-- 10단계: LINEUPS 및 LINEUP_PLAYERS 테이블 유지 (API와 호환)
-- 기존 구조가 API-Football과 호환되므로 유지

-- 마이그레이션 완료 확인 쿼리들
SELECT 'Migration Status Check:' as status;
SELECT 'countries' as table_name, COUNT(*) as record_count FROM countries
UNION ALL
SELECT 'venues', COUNT(*) FROM venues  
UNION ALL
SELECT 'leagues', COUNT(*) FROM leagues
UNION ALL
SELECT 'seasons', COUNT(*) FROM seasons
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'squad_memberships', COUNT(*) FROM squad_memberships
UNION ALL
SELECT 'fixtures', COUNT(*) FROM fixtures
UNION ALL
SELECT 'fixture_events', COUNT(*) FROM fixture_events
UNION ALL
SELECT 'standings', COUNT(*) FROM standings;

-- 백업 테이블 정리 (나중에 수동으로 삭제)
-- DROP TABLE IF EXISTS leagues_backup;
-- DROP TABLE IF EXISTS seasons_backup;
-- DROP TABLE IF EXISTS teams_backup;
-- DROP TABLE IF EXISTS players_backup;
-- DROP TABLE IF EXISTS squad_memberships_backup;
-- DROP TABLE IF EXISTS fixtures_backup;
-- DROP TABLE IF EXISTS events_backup;
-- DROP TABLE IF EXISTS standings_backup;