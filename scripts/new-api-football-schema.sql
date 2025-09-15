-- new-api-football-schema.sql
-- 완전히 새로운 API-Football 기반 데이터베이스 스키마
-- 기존 모든 테이블을 삭제하고 API-Football 표준을 따르는 새로운 구조 생성

-- ============================================
-- 기존 테이블 완전 삭제
-- ============================================

DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS fixture_events CASCADE;
DROP TABLE IF EXISTS lineups CASCADE;
DROP TABLE IF EXISTS standings CASCADE;
DROP TABLE IF EXISTS fixtures CASCADE;
DROP TABLE IF EXISTS squad_memberships CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;

-- ============================================
-- 새로운 API-Football 기반 스키마
-- ============================================

-- 1. LEAGUES - API-Football leagues 엔드포인트 기반
CREATE TABLE leagues (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20),
  logo_url TEXT,
  country_name VARCHAR(100),
  country_code VARCHAR(3),
  country_flag_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. SEASONS - API-Football seasons 정보
CREATE TABLE seasons (
  league_id INTEGER,
  year INTEGER,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  coverage TEXT, -- API 커버리지 정보
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (league_id, year),
  FOREIGN KEY (league_id) REFERENCES leagues(id)
);

-- 3. TEAMS - API-Football teams 엔드포인트 기반
CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10),
  country VARCHAR(100),
  founded INTEGER,
  is_national BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  venue_id INTEGER,
  venue_name VARCHAR(100),
  venue_address TEXT,
  venue_city VARCHAR(100),
  venue_capacity INTEGER,
  venue_surface VARCHAR(50),
  venue_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. PLAYERS - API-Football players 엔드포인트 기반
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  age INTEGER,
  birth_date DATE,
  birth_place VARCHAR(100),
  birth_country VARCHAR(100),
  nationality VARCHAR(100),
  height_cm INTEGER,
  weight_kg INTEGER,
  injured BOOLEAN DEFAULT FALSE,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. TEAM_PLAYERS - 선수-팀 관계 (시즌별)
CREATE TABLE team_players (
  team_id INTEGER,
  player_id INTEGER,
  season_year INTEGER,
  jersey_number INTEGER,
  position VARCHAR(20),
  is_captain BOOLEAN DEFAULT FALSE,
  joined_date DATE,
  contract_until DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (team_id, player_id, season_year),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE(team_id, season_year, jersey_number) -- 같은 팀, 시즌에서 등번호 중복 방지
);

-- 6. FIXTURES - API-Football fixtures 엔드포인트 기반
CREATE TABLE fixtures (
  id INTEGER PRIMARY KEY,
  referee VARCHAR(100),
  timezone VARCHAR(50),
  date_utc TIMESTAMP,
  timestamp_unix BIGINT,
  
  -- League info
  league_id INTEGER,
  season_year INTEGER,
  round VARCHAR(50),
  
  -- Teams
  home_team_id INTEGER,
  away_team_id INTEGER,
  
  -- Venue
  venue_id INTEGER,
  venue_name VARCHAR(100),
  venue_city VARCHAR(100),
  
  -- Status
  status_long VARCHAR(50),
  status_short VARCHAR(10),
  elapsed_minutes INTEGER,
  
  -- Goals
  home_goals INTEGER,
  away_goals INTEGER,
  
  -- Score details
  ht_home INTEGER, -- Halftime
  ht_away INTEGER,
  ft_home INTEGER, -- Fulltime  
  ft_away INTEGER,
  et_home INTEGER, -- Extra time
  et_away INTEGER,
  pk_home INTEGER, -- Penalties
  pk_away INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id)
);

-- 7. FIXTURE_EVENTS - API-Football fixtures/events 엔드포인트 기반
CREATE TABLE fixture_events (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  player_id INTEGER,
  assist_player_id INTEGER,
  
  -- Event timing
  elapsed_minutes INTEGER NOT NULL,
  extra_minutes INTEGER,
  
  -- Event details
  event_type VARCHAR(20) NOT NULL, -- Goal, Card, Subst, Var
  event_detail VARCHAR(100), -- Normal Goal, Yellow Card, Red Card, etc.
  comments TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (assist_player_id) REFERENCES players(id),
  
  -- 중복 방지를 위한 복합 유니크 제약조건
  UNIQUE(fixture_id, team_id, player_id, elapsed_minutes, extra_minutes, event_type, event_detail)
);

-- 8. STANDINGS - API-Football standings 엔드포인트 기반  
CREATE TABLE standings (
  league_id INTEGER,
  season_year INTEGER,
  team_id INTEGER,
  
  -- Ranking
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  goals_diff INTEGER NOT NULL,
  group_name VARCHAR(50),
  form VARCHAR(20), -- Recent form: WWLDL
  status VARCHAR(50), -- same, up, down
  description TEXT,
  
  -- Games played
  played INTEGER NOT NULL,
  win INTEGER NOT NULL,
  draw INTEGER NOT NULL,
  lose INTEGER NOT NULL,
  
  -- Goals
  goals_for INTEGER NOT NULL,
  goals_against INTEGER NOT NULL,
  
  -- Home/Away breakdown (optional)
  home_played INTEGER,
  home_win INTEGER,  
  home_draw INTEGER,
  home_lose INTEGER,
  home_goals_for INTEGER,
  home_goals_against INTEGER,
  
  away_played INTEGER,
  away_win INTEGER,
  away_draw INTEGER, 
  away_lose INTEGER,
  away_goals_for INTEGER,
  away_goals_against INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (league_id, season_year, team_id),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- 9. PLAYER_STATISTICS - 선수별 시즌 통계
CREATE TABLE player_statistics (
  player_id INTEGER,
  team_id INTEGER,
  league_id INTEGER,
  season_year INTEGER,
  
  -- Games
  games_appearences INTEGER DEFAULT 0,
  games_lineups INTEGER DEFAULT 0,
  games_minutes INTEGER DEFAULT 0,
  games_number INTEGER, -- Jersey number
  games_position VARCHAR(20),
  games_rating DECIMAL(3,2),
  games_captain BOOLEAN DEFAULT FALSE,
  
  -- Substitutes
  substitutes_in INTEGER DEFAULT 0,
  substitutes_out INTEGER DEFAULT 0,
  substitutes_bench INTEGER DEFAULT 0,
  
  -- Shots
  shots_total INTEGER DEFAULT 0,
  shots_on INTEGER DEFAULT 0,
  
  -- Goals
  goals_total INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  goals_assists INTEGER DEFAULT 0,
  goals_saves INTEGER DEFAULT 0,
  
  -- Passes
  passes_total INTEGER DEFAULT 0,
  passes_key INTEGER DEFAULT 0,
  passes_accuracy INTEGER DEFAULT 0,
  
  -- Tackles
  tackles_total INTEGER DEFAULT 0,
  tackles_blocks INTEGER DEFAULT 0,
  tackles_interceptions INTEGER DEFAULT 0,
  
  -- Duels
  duels_total INTEGER DEFAULT 0,
  duels_won INTEGER DEFAULT 0,
  
  -- Dribbles
  dribbles_attempts INTEGER DEFAULT 0,
  dribbles_success INTEGER DEFAULT 0,
  dribbles_past INTEGER DEFAULT 0,
  
  -- Fouls
  fouls_drawn INTEGER DEFAULT 0,
  fouls_committed INTEGER DEFAULT 0,
  
  -- Cards
  cards_yellow INTEGER DEFAULT 0,
  cards_yellowred INTEGER DEFAULT 0,
  cards_red INTEGER DEFAULT 0,
  
  -- Penalty
  penalty_won INTEGER DEFAULT 0,
  penalty_commited INTEGER DEFAULT 0,
  penalty_scored INTEGER DEFAULT 0,
  penalty_missed INTEGER DEFAULT 0,
  penalty_saved INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (player_id, team_id, league_id, season_year),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (league_id) REFERENCES leagues(id)
);

-- ============================================
-- 인덱스 생성
-- ============================================

-- 성능 최적화를 위한 인덱스들
CREATE INDEX idx_fixtures_league_season ON fixtures(league_id, season_year);
CREATE INDEX idx_fixtures_date ON fixtures(date_utc);
CREATE INDEX idx_fixtures_teams ON fixtures(home_team_id, away_team_id);
CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_standings_league_season ON standings(league_id, season_year);
CREATE INDEX idx_standings_rank ON standings(league_id, season_year, rank);
CREATE INDEX idx_player_stats_goals ON player_statistics(goals_total DESC);
CREATE INDEX idx_team_players_season ON team_players(team_id, season_year);

-- ============================================
-- RLS (Row Level Security) 비활성화
-- ============================================

-- 모든 테이블에서 RLS 비활성화하여 임포트 문제 방지
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE seasons DISABLE ROW LEVEL SECURITY;  
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixture_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE standings DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_statistics DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 초기 데이터
-- ============================================

-- K-League 1과 K-League 2 추가
INSERT INTO leagues (id, name, type, country_name, country_code) VALUES
(292, 'K League 1', 'League', 'South Korea', 'KR'),
(293, 'K League 2', 'League', 'South Korea', 'KR');

-- 2024, 2025 시즌 추가
INSERT INTO seasons (league_id, year, is_current) VALUES
(292, 2024, false),
(292, 2025, true),
(293, 2024, false), 
(293, 2025, true);

-- 완료 메시지
SELECT 'API-Football 기반 새로운 데이터베이스 스키마가 생성되었습니다.' as status;