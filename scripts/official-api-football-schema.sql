-- official-api-football-schema.sql
-- API-Football 공식 아키텍처 다이어그램을 정확히 따르는 데이터베이스 스키마
-- 모든 기존 테이블을 삭제하고 공식 구조대로 재생성

-- ============================================
-- 기존 테이블 완전 삭제 (CASCADE로 의존성까지 모두 제거)
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
DROP TABLE IF EXISTS player_statistics CASCADE;
DROP TABLE IF EXISTS team_players CASCADE;

-- ============================================
-- API-Football 공식 아키텍처 기반 스키마
-- ============================================

-- 1. COUNTRIES (다이어그램 상단)
CREATE TABLE countries (
  name VARCHAR(100) PRIMARY KEY,
  code VARCHAR(3) UNIQUE,
  flag_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. SEASONS (다이어그램 상단 좌측)
CREATE TABLE seasons (
  year INTEGER PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. LEAGUES (중앙 핵심)
CREATE TABLE leagues (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20), -- League, Cup
  country_name VARCHAR(100),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (country_name) REFERENCES countries(name)
);

-- 4. TEAMS (우측)
CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10),
  country_name VARCHAR(100),
  founded INTEGER,
  is_national BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (country_name) REFERENCES countries(name)
);

-- 5. VENUES (다이어그램에서 Teams와 연결)
CREATE TABLE venues (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country_name VARCHAR(100),
  capacity INTEGER,
  surface VARCHAR(50),
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (country_name) REFERENCES countries(name)
);

-- Teams와 Venues 관계 추가
ALTER TABLE teams ADD COLUMN venue_id INTEGER;
ALTER TABLE teams ADD FOREIGN KEY (venue_id) REFERENCES venues(id);

-- 6. FIXTURES (중앙 좌측)
CREATE TABLE fixtures (
  id INTEGER PRIMARY KEY,
  referee VARCHAR(100),
  timezone VARCHAR(50),
  date_utc TIMESTAMP NOT NULL,
  timestamp_unix BIGINT,
  
  -- League 관계
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  round VARCHAR(50),
  
  -- Teams 관계
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  
  -- Venue 관계
  venue_id INTEGER,
  
  -- Status
  status_long VARCHAR(50),
  status_short VARCHAR(10),
  elapsed_minutes INTEGER,
  
  -- Goals (최종 스코어)
  home_goals INTEGER,
  away_goals INTEGER,
  
  -- Score breakdown
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
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id),
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- 7. H2H (Head to Head - Fixtures에서 파생)
CREATE TABLE h2h (
  id BIGSERIAL PRIMARY KEY,
  team1_id INTEGER NOT NULL,
  team2_id INTEGER NOT NULL,
  fixture_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (team1_id) REFERENCES teams(id),
  FOREIGN KEY (team2_id) REFERENCES teams(id),
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id),
  UNIQUE(team1_id, team2_id, fixture_id)
);

-- 8. EVENTS (Fixtures에서 파생)
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  player_id INTEGER,
  assist_player_id INTEGER,
  
  -- Timing
  elapsed_minutes INTEGER NOT NULL,
  extra_minutes INTEGER,
  
  -- Event details
  event_type VARCHAR(20) NOT NULL, -- Goal, Card, Subst, Var
  event_detail VARCHAR(100), -- Normal Goal, Yellow Card, etc.
  comments TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  
  -- 중복 방지 제약조건
  UNIQUE(fixture_id, team_id, player_id, elapsed_minutes, extra_minutes, event_type, event_detail)
);

-- 9. LINEUPS (Fixtures에서 파생)
CREATE TABLE lineups (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  formation VARCHAR(10), -- 4-4-2, 3-5-2, etc.
  
  -- Coach info
  coach_id INTEGER,
  coach_name VARCHAR(100),
  coach_photo_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(fixture_id, team_id)
);

-- 10. FIXTURE_STATISTICS (Fixtures에서 파생)
CREATE TABLE fixture_statistics (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  
  -- 통계 데이터
  shots_on_goal INTEGER DEFAULT 0,
  shots_off_goal INTEGER DEFAULT 0,
  total_shots INTEGER DEFAULT 0,
  blocked_shots INTEGER DEFAULT 0,
  shots_inside_box INTEGER DEFAULT 0,
  shots_outside_box INTEGER DEFAULT 0,
  fouls INTEGER DEFAULT 0,
  corner_kicks INTEGER DEFAULT 0,
  offside INTEGER DEFAULT 0,
  ball_possession INTEGER DEFAULT 0, -- percentage
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  goalkeeper_saves INTEGER DEFAULT 0,
  total_passes INTEGER DEFAULT 0,
  passes_accurate INTEGER DEFAULT 0,
  passes_percentage INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(fixture_id, team_id)
);

-- 11. LIVE (실시간 경기 데이터)
CREATE TABLE live (
  fixture_id INTEGER PRIMARY KEY,
  last_updated TIMESTAMP DEFAULT NOW(),
  status_short VARCHAR(10),
  elapsed_minutes INTEGER,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE
);

-- 12. STANDINGS (Leagues에서 파생)
CREATE TABLE standings (
  id BIGSERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  
  -- Ranking
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  goals_diff INTEGER NOT NULL,
  group_name VARCHAR(50),
  form VARCHAR(20), -- WWLDL
  status VARCHAR(50), -- same, up, down
  description TEXT,
  
  -- Games
  played INTEGER NOT NULL DEFAULT 0,
  win INTEGER NOT NULL DEFAULT 0,
  draw INTEGER NOT NULL DEFAULT 0,
  lose INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  
  -- Home performance
  home_played INTEGER DEFAULT 0,
  home_win INTEGER DEFAULT 0,
  home_draw INTEGER DEFAULT 0,
  home_lose INTEGER DEFAULT 0,
  home_goals_for INTEGER DEFAULT 0,
  home_goals_against INTEGER DEFAULT 0,
  
  -- Away performance
  away_played INTEGER DEFAULT 0,
  away_win INTEGER DEFAULT 0,
  away_draw INTEGER DEFAULT 0,
  away_lose INTEGER DEFAULT 0,
  away_goals_for INTEGER DEFAULT 0,
  away_goals_against INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(league_id, season_year, team_id)
);

-- 13. PLAYERS (우측)
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

-- Events와 Players 관계 추가
ALTER TABLE events ADD FOREIGN KEY (player_id) REFERENCES players(id);
ALTER TABLE events ADD FOREIGN KEY (assist_player_id) REFERENCES players(id);

-- 14. PLAYERS_SQUADS (Players와 Teams 연결)
CREATE TABLE players_squads (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  jersey_number INTEGER,
  position VARCHAR(20),
  is_captain BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  UNIQUE(player_id, team_id, season_year),
  UNIQUE(team_id, season_year, jersey_number) -- 같은 팀에서 등번호 중복 방지
);

-- 15. PLAYERS_STATISTICS (Players에서 파생)
CREATE TABLE players_statistics (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  
  -- Games
  games_appearances INTEGER DEFAULT 0,
  games_lineups INTEGER DEFAULT 0,
  games_minutes INTEGER DEFAULT 0,
  games_number INTEGER,
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
  penalty_committed INTEGER DEFAULT 0,
  penalty_scored INTEGER DEFAULT 0,
  penalty_missed INTEGER DEFAULT 0,
  penalty_saved INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  UNIQUE(player_id, team_id, league_id, season_year)
);

-- 16. PLAYERS_PROFILES (Players에서 파생)
CREATE TABLE players_profiles (
  player_id INTEGER PRIMARY KEY,
  biography TEXT,
  career_history TEXT,
  social_media JSONB,
  achievements TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 17. PLAYERS_TEAMS (선수 이적 기록)
CREATE TABLE players_teams (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- 18. TOP_SCORERS (Leagues에서 파생)
CREATE TABLE top_scorers (
  id BIGSERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  penalty_goals INTEGER DEFAULT 0,
  rank INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(league_id, season_year, player_id, team_id)
);

-- 19. TEAMS_STATISTICS (Teams에서 파생)
CREATE TABLE teams_statistics (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL,
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  
  -- League position
  league_position INTEGER,
  league_points INTEGER DEFAULT 0,
  
  -- Forms and streaks
  form VARCHAR(20), -- WWLDL
  current_streak VARCHAR(50),
  
  -- Goals statistics
  goals_for_total INTEGER DEFAULT 0,
  goals_against_total INTEGER DEFAULT 0,
  goals_for_average DECIMAL(3,2) DEFAULT 0,
  goals_against_average DECIMAL(3,2) DEFAULT 0,
  
  -- Biggest scores
  biggest_wins_home VARCHAR(10), -- 5-0
  biggest_wins_away VARCHAR(10),
  biggest_loses_home VARCHAR(10),
  biggest_loses_away VARCHAR(10),
  
  -- Clean sheets and failed to score
  clean_sheet_total INTEGER DEFAULT 0,
  clean_sheet_home INTEGER DEFAULT 0,
  clean_sheet_away INTEGER DEFAULT 0,
  failed_to_score_total INTEGER DEFAULT 0,
  failed_to_score_home INTEGER DEFAULT 0,
  failed_to_score_away INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  UNIQUE(team_id, league_id, season_year)
);

-- 20. TRANSFERS (다이어그램 우측 하단)
CREATE TABLE transfers (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_from_id INTEGER,
  team_to_id INTEGER NOT NULL,
  date DATE NOT NULL,
  transfer_type VARCHAR(20), -- Loan, Free, Transfer
  fee_amount BIGINT,
  fee_currency VARCHAR(3),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_from_id) REFERENCES teams(id),
  FOREIGN KEY (team_to_id) REFERENCES teams(id)
);

-- 21. COACHES (다이어그램 우측 하단)
CREATE TABLE coaches (
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
  photo_url TEXT,
  team_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Lineups와 Coaches 관계 추가
ALTER TABLE lineups ADD FOREIGN KEY (coach_id) REFERENCES coaches(id);

-- 22. TROPHIES (다이어그램 하단 우측)
CREATE TABLE trophies (
  id BIGSERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  trophy_type VARCHAR(50), -- Winner, Runner-up, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (season_year) REFERENCES seasons(year),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- 23. SIDELINED (다이어그램 하단 우측)
CREATE TABLE sidelined (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  type VARCHAR(20), -- Injury, Suspension, etc.
  start_date DATE,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 24. INJURIES (Events에서 파생)
CREATE TABLE injuries (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  fixture_id INTEGER,
  injury_type VARCHAR(50),
  reason VARCHAR(100), -- Knock, Fitness, etc.
  date DATE,
  expected_return DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id)
);

-- 25. PREDICTIONS (다이어그램 좌측 하단)
CREATE TABLE predictions (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  
  -- Winner predictions
  winner_id INTEGER, -- team_id of predicted winner, null for draw
  winner_name VARCHAR(100),
  winner_comment TEXT,
  
  -- Win/Draw/Lose predictions
  predictions_win_or_draw BOOLEAN,
  predictions_under_over VARCHAR(10), -- Under 2.5, Over 2.5, etc.
  predictions_goals_home VARCHAR(10), -- 0-1, 2-3, etc.
  predictions_goals_away VARCHAR(10),
  predictions_advice VARCHAR(100),
  predictions_percent_home INTEGER, -- percentage
  predictions_percent_draw INTEGER,
  predictions_percent_away INTEGER,
  
  -- H2H comparison
  h2h_played INTEGER DEFAULT 0,
  h2h_wins_home INTEGER DEFAULT 0,
  h2h_wins_away INTEGER DEFAULT 0,
  h2h_draws INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES teams(id)
);

-- ============================================
-- ODDS 관련 테이블들 (다이어그램 중앙 하단의 노란색 영역)
-- ============================================

-- 26. ODDS (Fixtures에서 파생)
CREATE TABLE odds (
  id BIGSERIAL PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  bookmaker_id INTEGER NOT NULL,
  bookmaker_name VARCHAR(100) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  UNIQUE(fixture_id, bookmaker_id)
);

-- 27. LIVE_ODDS (Odds에서 파생)
CREATE TABLE live_odds (
  id BIGSERIAL PRIMARY KEY,
  odds_id INTEGER NOT NULL,
  
  -- Market info
  market_id INTEGER NOT NULL,
  market_name VARCHAR(100) NOT NULL, -- Match Winner, Over/Under, etc.
  
  -- Outcome info  
  outcome_id INTEGER NOT NULL,
  outcome_name VARCHAR(100) NOT NULL, -- Home, Away, Draw, Over 2.5, etc.
  outcome_odd DECIMAL(5,2) NOT NULL,
  outcome_handicap VARCHAR(10),
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (odds_id) REFERENCES odds(id) ON DELETE CASCADE,
  UNIQUE(odds_id, market_id, outcome_id)
);

-- 28. PRE_MATCH_ODDS (Odds에서 파생)  
CREATE TABLE pre_match_odds (
  id BIGSERIAL PRIMARY KEY,
  odds_id INTEGER NOT NULL,
  
  -- Market info
  market_id INTEGER NOT NULL,
  market_name VARCHAR(100) NOT NULL,
  
  -- Outcome info
  outcome_id INTEGER NOT NULL, 
  outcome_name VARCHAR(100) NOT NULL,
  outcome_odd DECIMAL(5,2) NOT NULL,
  outcome_handicap VARCHAR(10),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (odds_id) REFERENCES odds(id) ON DELETE CASCADE,
  UNIQUE(odds_id, market_id, outcome_id)
);

-- 29. BETS (Pre-match Odds에서 파생)
CREATE TABLE bets (
  id BIGSERIAL PRIMARY KEY,
  pre_match_odds_id INTEGER NOT NULL,
  
  -- Bet details
  bet_amount DECIMAL(10,2) NOT NULL,
  potential_win DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, won, lost
  placed_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (pre_match_odds_id) REFERENCES pre_match_odds(id)
);

-- 30. BOOKMAKERS (Odds에서 파생)
CREATE TABLE bookmakers (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Odds와 Bookmakers 관계 추가
ALTER TABLE odds ADD FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id);

-- ============================================
-- 성능 최적화 인덱스
-- ============================================

-- Fixtures 관련 인덱스 (가장 자주 쿼리되는 테이블)
CREATE INDEX idx_fixtures_league_season ON fixtures(league_id, season_year);
CREATE INDEX idx_fixtures_date ON fixtures(date_utc);
CREATE INDEX idx_fixtures_teams ON fixtures(home_team_id, away_team_id);
CREATE INDEX idx_fixtures_status ON fixtures(status_short);

-- Events 관련 인덱스
CREATE INDEX idx_events_fixture ON events(fixture_id);
CREATE INDEX idx_events_player ON events(player_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_goals ON events(event_type) WHERE event_type = 'Goal';

-- Standings 관련 인덱스
CREATE INDEX idx_standings_league_season ON standings(league_id, season_year);
CREATE INDEX idx_standings_rank ON standings(league_id, season_year, rank);

-- Players Statistics 관련 인덱스
CREATE INDEX idx_player_stats_goals ON players_statistics(goals_total DESC);
CREATE INDEX idx_player_stats_league_season ON players_statistics(league_id, season_year);

-- Top Scorers 관련 인덱스  
CREATE INDEX idx_top_scorers_league_season ON top_scorers(league_id, season_year, rank);
CREATE INDEX idx_top_scorers_goals ON top_scorers(goals DESC);

-- Squads 관련 인덱스
CREATE INDEX idx_players_squads_team_season ON players_squads(team_id, season_year);

-- ============================================
-- RLS (Row Level Security) 비활성화
-- ============================================

-- 모든 테이블에 RLS 비활성화 (임포트 문제 방지)
ALTER TABLE countries DISABLE ROW LEVEL SECURITY;
ALTER TABLE seasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE venues DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures DISABLE ROW LEVEL SECURITY;
ALTER TABLE h2h DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE lineups DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixture_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE live DISABLE ROW LEVEL SECURITY;
ALTER TABLE standings DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE players_squads DISABLE ROW LEVEL SECURITY;
ALTER TABLE players_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE players_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE players_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE top_scorers DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE coaches DISABLE ROW LEVEL SECURITY;
ALTER TABLE trophies DISABLE ROW LEVEL SECURITY;
ALTER TABLE sidelined DISABLE ROW LEVEL SECURITY;
ALTER TABLE injuries DISABLE ROW LEVEL SECURITY;
ALTER TABLE predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE odds DISABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds DISABLE ROW LEVEL SECURITY;
ALTER TABLE pre_match_odds DISABLE ROW LEVEL SECURITY;
ALTER TABLE bets DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookmakers DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 초기 데이터 (K-League 설정)
-- ============================================

-- 국가 추가
INSERT INTO countries (name, code) VALUES 
('South Korea', 'KR');

-- 시즌 추가  
INSERT INTO seasons (year, is_current) VALUES
(2024, false),
(2025, true);

-- 리그 추가
INSERT INTO leagues (id, name, type, country_name) VALUES
(292, 'K League 1', 'League', 'South Korea'),
(293, 'K League 2', 'League', 'South Korea');

-- 완료 메시지
SELECT '🎉 API-Football 공식 아키텍처 기반 완전 새로운 데이터베이스 스키마 생성 완료!' as status,
       '총 30개 테이블이 생성되었습니다.' as details;