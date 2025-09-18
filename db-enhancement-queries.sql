-- ============================================
-- API-Football 기반 데이터베이스 구조 개선 SQL
-- ============================================

-- 1. Players 테이블에 누락된 컬럼들 추가
-- 현재 players 테이블에 jersey_number, position 등이 없음
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS jersey_number INTEGER,
ADD COLUMN IF NOT EXISTS position VARCHAR(20),
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS injured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS api_football_id INTEGER UNIQUE;

-- 2. Teams 테이블에 누락된 컬럼들 추가
-- API-Football의 teams 엔드포인트 기반
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS api_football_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS team_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS league_id INTEGER,
ADD COLUMN IF NOT EXISTS season_year INTEGER;

-- 3. Squads 테이블 생성 (현재 없음)
-- players/squads 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS squads (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    jersey_number INTEGER,
    position VARCHAR(20),
    season_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(team_id, player_id, season_year)
);

-- 4. Coaches 테이블 생성
-- coachs 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    firstname VARCHAR(255),
    lastname VARCHAR(255),
    age INTEGER,
    birth_date DATE,
    birth_place VARCHAR(255),
    birth_country VARCHAR(255),
    nationality VARCHAR(255),
    height_cm INTEGER,
    weight_kg INTEGER,
    photo_url TEXT,
    api_football_id INTEGER UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Team Statistics 테이블 생성
-- teams/statistics 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS team_statistics (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    form VARCHAR(10),
    fixtures_played_home INTEGER DEFAULT 0,
    fixtures_played_away INTEGER DEFAULT 0,
    fixtures_played_total INTEGER DEFAULT 0,
    fixtures_wins_home INTEGER DEFAULT 0,
    fixtures_wins_away INTEGER DEFAULT 0,
    fixtures_wins_total INTEGER DEFAULT 0,
    fixtures_draws_home INTEGER DEFAULT 0,
    fixtures_draws_away INTEGER DEFAULT 0,
    fixtures_draws_total INTEGER DEFAULT 0,
    fixtures_loses_home INTEGER DEFAULT 0,
    fixtures_loses_away INTEGER DEFAULT 0,
    fixtures_loses_total INTEGER DEFAULT 0,
    goals_for_total INTEGER DEFAULT 0,
    goals_for_average_home DECIMAL(3,2),
    goals_for_average_away DECIMAL(3,2),
    goals_for_average_total DECIMAL(3,2),
    goals_against_total INTEGER DEFAULT 0,
    goals_against_average_home DECIMAL(3,2),
    goals_against_average_away DECIMAL(3,2),
    goals_against_average_total DECIMAL(3,2),
    biggest_streak_wins INTEGER DEFAULT 0,
    biggest_streak_draws INTEGER DEFAULT 0,
    biggest_streak_loses INTEGER DEFAULT 0,
    biggest_wins_home VARCHAR(10),
    biggest_wins_away VARCHAR(10),
    biggest_loses_home VARCHAR(10),
    biggest_loses_away VARCHAR(10),
    clean_sheet_home INTEGER DEFAULT 0,
    clean_sheet_away INTEGER DEFAULT 0,
    clean_sheet_total INTEGER DEFAULT 0,
    failed_to_score_home INTEGER DEFAULT 0,
    failed_to_score_away INTEGER DEFAULT 0,
    failed_to_score_total INTEGER DEFAULT 0,
    penalty_scored_total INTEGER DEFAULT 0,
    penalty_missed_total INTEGER DEFAULT 0,
    penalty_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(team_id, league_id, season_year)
);

-- 6. Standings 테이블 생성
-- standings 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS standings (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    rank_position INTEGER NOT NULL,
    points INTEGER NOT NULL,
    goal_diff INTEGER NOT NULL,
    group_name VARCHAR(50),
    form VARCHAR(10),
    status VARCHAR(50),
    description TEXT,
    all_played INTEGER DEFAULT 0,
    all_win INTEGER DEFAULT 0,
    all_draw INTEGER DEFAULT 0,
    all_lose INTEGER DEFAULT 0,
    all_goals_for INTEGER DEFAULT 0,
    all_goals_against INTEGER DEFAULT 0,
    home_played INTEGER DEFAULT 0,
    home_win INTEGER DEFAULT 0,
    home_draw INTEGER DEFAULT 0,
    home_lose INTEGER DEFAULT 0,
    home_goals_for INTEGER DEFAULT 0,
    home_goals_against INTEGER DEFAULT 0,
    away_played INTEGER DEFAULT 0,
    away_win INTEGER DEFAULT 0,
    away_draw INTEGER DEFAULT 0,
    away_lose INTEGER DEFAULT 0,
    away_goals_for INTEGER DEFAULT 0,
    away_goals_against INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(league_id, season_year, team_id)
);

-- 7. Fixture Statistics 테이블 생성
-- fixtures/statistics 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS fixture_statistics (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    shots_on_goal INTEGER DEFAULT 0,
    shots_off_goal INTEGER DEFAULT 0,
    shots_insidebox INTEGER DEFAULT 0,
    shots_outsidebox INTEGER DEFAULT 0,
    total_shots INTEGER DEFAULT 0,
    blocked_shots INTEGER DEFAULT 0,
    fouls INTEGER DEFAULT 0,
    corner_kicks INTEGER DEFAULT 0,
    offsides INTEGER DEFAULT 0,
    ball_possession INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    goalkeeper_saves INTEGER DEFAULT 0,
    total_passes INTEGER DEFAULT 0,
    passes_accurate INTEGER DEFAULT 0,
    passes_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(fixture_id, team_id)
);

-- 8. Player Statistics 테이블 생성
-- players 엔드포인트의 상세 통계 데이터 저장용
CREATE TABLE IF NOT EXISTS player_statistics (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    position VARCHAR(20),
    rating DECIMAL(3,1),
    captain BOOLEAN DEFAULT FALSE,
    substitutes_in INTEGER DEFAULT 0,
    substitutes_out INTEGER DEFAULT 0,
    substitutes_bench INTEGER DEFAULT 0,
    shots_total INTEGER DEFAULT 0,
    shots_on INTEGER DEFAULT 0,
    goals_total INTEGER DEFAULT 0,
    goals_conceded INTEGER DEFAULT 0,
    goals_assists INTEGER DEFAULT 0,
    goals_saves INTEGER DEFAULT 0,
    passes_total INTEGER DEFAULT 0,
    passes_key INTEGER DEFAULT 0,
    passes_accuracy INTEGER DEFAULT 0,
    tackles_total INTEGER DEFAULT 0,
    tackles_blocks INTEGER DEFAULT 0,
    tackles_interceptions INTEGER DEFAULT 0,
    duels_total INTEGER DEFAULT 0,
    duels_won INTEGER DEFAULT 0,
    dribbles_attempts INTEGER DEFAULT 0,
    dribbles_success INTEGER DEFAULT 0,
    dribbles_past INTEGER DEFAULT 0,
    fouls_drawn INTEGER DEFAULT 0,
    fouls_committed INTEGER DEFAULT 0,
    cards_yellow INTEGER DEFAULT 0,
    cards_red INTEGER DEFAULT 0,
    penalty_won INTEGER DEFAULT 0,
    penalty_committed INTEGER DEFAULT 0,
    penalty_scored INTEGER DEFAULT 0,
    penalty_missed INTEGER DEFAULT 0,
    penalty_saved INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(player_id, team_id, league_id, season_year)
);

-- 9. Injuries 테이블 생성
-- injuries 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS injuries (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    injury_type VARCHAR(50),
    injury_reason VARCHAR(255),
    injury_date DATE,
    injury_status VARCHAR(50), -- Missing Fixture, Questionable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE SET NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 10. Transfers 테이블 생성
-- transfers 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS transfers (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    transfer_date DATE NOT NULL,
    team_from_id INTEGER,
    team_to_id INTEGER,
    transfer_type VARCHAR(50), -- Free, Loan, Transfer, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (team_from_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (team_to_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- 11. Trophies 테이블 생성
-- trophies 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS trophies (
    id SERIAL PRIMARY KEY,
    player_id INTEGER,
    coach_id INTEGER,
    league VARCHAR(255) NOT NULL,
    country VARCHAR(255),
    season_year VARCHAR(20),
    place VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
    CONSTRAINT check_player_or_coach CHECK (
        (player_id IS NOT NULL AND coach_id IS NULL) OR 
        (player_id IS NULL AND coach_id IS NOT NULL)
    )
);

-- 12. Venues 테이블 업데이트 (기존 테이블이 있다면 컬럼 추가)
-- venues 엔드포인트 기반으로 누락된 컬럼들 추가
CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(255),
    country VARCHAR(255),
    capacity INTEGER,
    surface VARCHAR(50),
    image_url TEXT,
    api_football_id INTEGER UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기존 venues 테이블에 컬럼 추가 (존재하는 경우)
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS capacity INTEGER,
ADD COLUMN IF NOT EXISTS surface VARCHAR(50),
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS api_football_id INTEGER UNIQUE;

-- 13. Predictions 테이블 생성
-- predictions 엔드포인트 데이터 저장용
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    winner_id INTEGER,
    winner_name VARCHAR(255),
    winner_comment TEXT,
    win_or_draw BOOLEAN,
    under_over VARCHAR(10),
    goals_home VARCHAR(10),
    goals_away VARCHAR(10),
    advice TEXT,
    percent_home INTEGER,
    percent_draw INTEGER,
    percent_away INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(fixture_id)
);

-- Events 테이블 개선 (기존 테이블 업데이트)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS api_football_event_id INTEGER,
ADD COLUMN IF NOT EXISTS event_detail VARCHAR(100),
ADD COLUMN IF NOT EXISTS event_comments TEXT;

-- Fixtures 테이블 개선 (기존 테이블 업데이트)
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS api_football_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS period INTEGER,
ADD COLUMN IF NOT EXISTS venue_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS venue_city VARCHAR(255);

-- 14. 인덱스 생성 (성능 최적화)
-- 자주 사용되는 쿼리 패턴에 대한 인덱스 추가

-- Players 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_players_api_football_id ON players(api_football_id);
CREATE INDEX IF NOT EXISTS idx_players_jersey_number ON players(jersey_number);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);

-- Squads 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_squads_team_season ON squads(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_squads_player_season ON squads(player_id, season_year);

-- Teams 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_teams_api_football_id ON teams(api_football_id);
CREATE INDEX IF NOT EXISTS idx_teams_league_season ON teams(league_id, season_year);

-- Standings 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_standings_league_season ON standings(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_standings_team_season ON standings(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_standings_position ON standings(rank_position);

-- Player Statistics 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_player_stats_player_season ON player_statistics(player_id, season_year);
CREATE INDEX IF NOT EXISTS idx_player_stats_team_season ON player_statistics(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_player_stats_league_season ON player_statistics(league_id, season_year);

-- Fixture Statistics 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_fixture_stats_fixture ON fixture_statistics(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixture_stats_team ON fixture_statistics(team_id);

-- 15. 데이터 무결성을 위한 제약조건 및 트리거
-- 업데이트 시간 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 업데이트 트리거 적용
CREATE TRIGGER update_players_modtime BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_teams_modtime BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_squads_modtime BEFORE UPDATE ON squads FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_coaches_modtime BEFORE UPDATE ON coaches FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_team_stats_modtime BEFORE UPDATE ON team_statistics FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_player_stats_modtime BEFORE UPDATE ON player_statistics FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_injuries_modtime BEFORE UPDATE ON injuries FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_venues_modtime BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================
-- 완료 메시지
-- ============================================
-- 이 스크립트는 API-Football 문서를 기반으로 
-- 데이터베이스 구조를 대폭 개선합니다.
--
-- 추가된 주요 기능:
-- 1. 선수 등번호 및 포지션 정보
-- 2. 스쿼드 관리 시스템
-- 3. 코치 정보 관리
-- 4. 상세 팀/선수 통계
-- 5. 순위표 관리
-- 6. 부상자 명단
-- 7. 이적 기록
-- 8. 트로피 및 수상 이력
-- 9. 경기 예측 데이터
-- 10. 성능 최적화 인덱스
--
-- 이제 API-Football의 모든 주요 엔드포인트
-- 데이터를 완전히 활용할 수 있습니다!
-- ============================================