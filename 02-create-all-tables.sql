-- 02-create-all-tables.sql
-- Complete database creation script with all API-Football endpoint support
-- Execute after 01-drop-all-tables.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables
-- Countries table
CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(10),
    flag TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leagues table
CREATE TABLE leagues (
    id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    logo_url TEXT,
    country_id INTEGER REFERENCES countries(id),
    country_name VARCHAR(255),
    country_code VARCHAR(10),
    country_flag TEXT,
    season_year INTEGER NOT NULL,
    season_start DATE,
    season_end DATE,
    current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, season_year)
);

-- Teams table
CREATE TABLE teams (
    id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10),
    logo_url TEXT,
    country_name VARCHAR(255),
    founded INTEGER,
    national BOOLEAN DEFAULT FALSE,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    venue_id INTEGER,
    venue_name VARCHAR(255),
    venue_address VARCHAR(500),
    venue_city VARCHAR(255),
    venue_capacity INTEGER,
    venue_surface VARCHAR(50),
    venue_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, season_year),
    FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year)
);

-- Venues table
CREATE TABLE venues (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(255),
    country VARCHAR(255),
    capacity INTEGER,
    surface VARCHAR(50),
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
    id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    firstname VARCHAR(255),
    lastname VARCHAR(255),
    age INTEGER,
    birth_date DATE,
    birth_place VARCHAR(255),
    birth_country VARCHAR(255),
    nationality VARCHAR(255),
    height VARCHAR(20),
    weight VARCHAR(20),
    injured BOOLEAN DEFAULT FALSE,
    photo TEXT,
    jersey_number INTEGER,
    position VARCHAR(50),
    team_id INTEGER,
    season_year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, season_year),
    FOREIGN KEY (team_id, season_year) REFERENCES teams(id, season_year)
);

-- Coaches table
CREATE TABLE coaches (
    id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    firstname VARCHAR(255),
    lastname VARCHAR(255),
    age INTEGER,
    birth_date DATE,
    birth_place VARCHAR(255),
    birth_country VARCHAR(255),
    nationality VARCHAR(255),
    height VARCHAR(20),
    weight VARCHAR(20),
    photo TEXT,
    team_id INTEGER,
    season_year INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, season_year),
    FOREIGN KEY (team_id, season_year) REFERENCES teams(id, season_year)
);

-- Fixtures table
CREATE TABLE fixtures (
    id INTEGER PRIMARY KEY,
    referee VARCHAR(255),
    timezone VARCHAR(50),
    date_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    timestamp INTEGER,
    status_long VARCHAR(100),
    status_short VARCHAR(20),
    elapsed INTEGER,
    round VARCHAR(100),
    season_year INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    home_goals INTEGER,
    away_goals INTEGER,
    venue_id INTEGER REFERENCES venues(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year),
    FOREIGN KEY (home_team_id, season_year) REFERENCES teams(id, season_year),
    FOREIGN KEY (away_team_id, season_year) REFERENCES teams(id, season_year)
);

-- Lineups table
CREATE TABLE lineups (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER REFERENCES fixtures(id),
    team_id INTEGER REFERENCES teams(id),
    coach_id INTEGER REFERENCES coaches(id),
    formation VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fixture_id, team_id)
);

-- Lineup players table
CREATE TABLE lineup_players (
    id SERIAL PRIMARY KEY,
    lineup_id INTEGER REFERENCES lineups(id),
    player_id INTEGER REFERENCES players(id),
    jersey_number INTEGER,
    position VARCHAR(50),
    grid VARCHAR(10),
    is_substitute BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER REFERENCES fixtures(id),
    team_id INTEGER REFERENCES teams(id),
    player_id INTEGER REFERENCES players(id),
    assist_player_id INTEGER REFERENCES players(id),
    time_elapsed INTEGER,
    time_extra INTEGER,
    type VARCHAR(50),
    detail VARCHAR(100),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Statistics table
CREATE TABLE player_statistics (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    league_id INTEGER REFERENCES leagues(id),
    season_year INTEGER NOT NULL,
    position VARCHAR(50),
    rating DECIMAL(3,2),
    captain BOOLEAN DEFAULT FALSE,
    
    -- Appearance stats
    appearances INTEGER DEFAULT 0,
    lineups INTEGER DEFAULT 0,
    minutes INTEGER DEFAULT 0,
    
    -- Substitution stats
    substitute_in INTEGER DEFAULT 0,
    substitute_out INTEGER DEFAULT 0,
    substitute_bench INTEGER DEFAULT 0,
    
    -- Shot stats
    shots_total INTEGER DEFAULT 0,
    shots_on INTEGER DEFAULT 0,
    
    -- Goal stats
    goals_total INTEGER DEFAULT 0,
    goals_conceded INTEGER DEFAULT 0,
    goals_assists INTEGER DEFAULT 0,
    goals_saves INTEGER DEFAULT 0,
    
    -- Pass stats
    passes_total INTEGER DEFAULT 0,
    passes_key INTEGER DEFAULT 0,
    passes_accuracy DECIMAL(5,2),
    
    -- Tackle stats
    tackles_total INTEGER DEFAULT 0,
    tackles_blocks INTEGER DEFAULT 0,
    tackles_interceptions INTEGER DEFAULT 0,
    
    -- Duel stats
    duels_total INTEGER DEFAULT 0,
    duels_won INTEGER DEFAULT 0,
    
    -- Dribble stats
    dribbles_attempts INTEGER DEFAULT 0,
    dribbles_success INTEGER DEFAULT 0,
    dribbles_past INTEGER DEFAULT 0,
    
    -- Foul stats
    fouls_drawn INTEGER DEFAULT 0,
    fouls_committed INTEGER DEFAULT 0,
    
    -- Card stats
    cards_yellow INTEGER DEFAULT 0,
    cards_yellowred INTEGER DEFAULT 0,
    cards_red INTEGER DEFAULT 0,
    
    -- Penalty stats
    penalty_won INTEGER DEFAULT 0,
    penalty_committed INTEGER DEFAULT 0,
    penalty_scored INTEGER DEFAULT 0,
    penalty_missed INTEGER DEFAULT 0,
    penalty_saved INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, team_id, league_id, season_year)
);

-- Team Statistics table
CREATE TABLE team_statistics (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id),
    league_id INTEGER REFERENCES leagues(id),
    season_year INTEGER NOT NULL,
    
    -- Form and fixtures
    form VARCHAR(20),
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
    
    -- Goals
    goals_for_total_home INTEGER DEFAULT 0,
    goals_for_total_away INTEGER DEFAULT 0,
    goals_for_total INTEGER DEFAULT 0,
    goals_for_average_home DECIMAL(4,2),
    goals_for_average_away DECIMAL(4,2),
    goals_for_average_total DECIMAL(4,2),
    
    goals_against_total_home INTEGER DEFAULT 0,
    goals_against_total_away INTEGER DEFAULT 0,
    goals_against_total INTEGER DEFAULT 0,
    goals_against_average_home DECIMAL(4,2),
    goals_against_average_away DECIMAL(4,2),
    goals_against_average_total DECIMAL(4,2),
    
    -- Biggest scores
    biggest_streak_wins INTEGER,
    biggest_streak_draws INTEGER,
    biggest_streak_loses INTEGER,
    biggest_wins_home VARCHAR(20),
    biggest_wins_away VARCHAR(20),
    biggest_loses_home VARCHAR(20),
    biggest_loses_away VARCHAR(20),
    
    -- Clean sheets and failed to score
    clean_sheet_home INTEGER DEFAULT 0,
    clean_sheet_away INTEGER DEFAULT 0,
    clean_sheet_total INTEGER DEFAULT 0,
    failed_to_score_home INTEGER DEFAULT 0,
    failed_to_score_away INTEGER DEFAULT 0,
    failed_to_score_total INTEGER DEFAULT 0,
    
    -- Penalty stats
    penalty_scored_total INTEGER DEFAULT 0,
    penalty_scored_percentage DECIMAL(5,2),
    penalty_missed_total INTEGER DEFAULT 0,
    penalty_missed_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, league_id, season_year)
);

-- Standings table
CREATE TABLE standings (
    id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(id),
    season_year INTEGER NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    rank_position INTEGER,
    points INTEGER DEFAULT 0,
    goalsDiff INTEGER DEFAULT 0,
    group_name VARCHAR(50),
    form VARCHAR(20),
    status VARCHAR(50),
    description TEXT,
    
    -- All matches
    all_played INTEGER DEFAULT 0,
    all_win INTEGER DEFAULT 0,
    all_draw INTEGER DEFAULT 0,
    all_lose INTEGER DEFAULT 0,
    all_goals_for INTEGER DEFAULT 0,
    all_goals_against INTEGER DEFAULT 0,
    
    -- Home matches
    home_played INTEGER DEFAULT 0,
    home_win INTEGER DEFAULT 0,
    home_draw INTEGER DEFAULT 0,
    home_lose INTEGER DEFAULT 0,
    home_goals_for INTEGER DEFAULT 0,
    home_goals_against INTEGER DEFAULT 0,
    
    -- Away matches
    away_played INTEGER DEFAULT 0,
    away_win INTEGER DEFAULT 0,
    away_draw INTEGER DEFAULT 0,
    away_lose INTEGER DEFAULT 0,
    away_goals_for INTEGER DEFAULT 0,
    away_goals_against INTEGER DEFAULT 0,
    
    -- Last update
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, season_year, team_id)
);

-- Squad table (separate from players for team-specific data)
CREATE TABLE squads (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id),
    player_id INTEGER REFERENCES players(id),
    season_year INTEGER NOT NULL,
    position VARCHAR(50),
    jersey_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, player_id, season_year)
);

-- Transfers table
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season_year INTEGER NOT NULL,
    transfer_date DATE,
    type VARCHAR(50), -- loan, transfer
    team_in_id INTEGER REFERENCES teams(id),
    team_in_logo TEXT,
    team_out_id INTEGER REFERENCES teams(id),
    team_out_logo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Injuries table
CREATE TABLE injuries (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    fixture_id INTEGER REFERENCES fixtures(id),
    season_year INTEGER NOT NULL,
    injury_type VARCHAR(100),
    reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trophies table
CREATE TABLE trophies (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    league VARCHAR(255),
    country VARCHAR(255),
    season VARCHAR(20),
    place VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_leagues_season_year ON leagues(season_year);
CREATE INDEX idx_teams_league_season ON teams(league_id, season_year);
CREATE INDEX idx_players_team_season ON players(team_id, season_year);
CREATE INDEX idx_fixtures_league_season ON fixtures(league_id, season_year);
CREATE INDEX idx_fixtures_date ON fixtures(date_utc);
CREATE INDEX idx_fixtures_teams ON fixtures(home_team_id, away_team_id);
CREATE INDEX idx_events_fixture ON events(fixture_id);
CREATE INDEX idx_events_player ON events(player_id);
CREATE INDEX idx_lineups_fixture ON lineups(fixture_id);
CREATE INDEX idx_lineup_players_lineup ON lineup_players(lineup_id);
CREATE INDEX idx_player_statistics_player_season ON player_statistics(player_id, season_year);
CREATE INDEX idx_team_statistics_team_season ON team_statistics(team_id, season_year);
CREATE INDEX idx_standings_league_season ON standings(league_id, season_year);
CREATE INDEX idx_standings_rank ON standings(rank_position);
CREATE INDEX idx_squads_team_season ON squads(team_id, season_year);
CREATE INDEX idx_transfers_player_season ON transfers(player_id, season_year);
CREATE INDEX idx_injuries_player_season ON injuries(player_id, season_year);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fixtures_updated_at BEFORE UPDATE ON fixtures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lineup_players_updated_at BEFORE UPDATE ON lineup_players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_statistics_updated_at BEFORE UPDATE ON player_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_statistics_updated_at BEFORE UPDATE ON team_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_standings_updated_at BEFORE UPDATE ON standings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_squads_updated_at BEFORE UPDATE ON squads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_injuries_updated_at BEFORE UPDATE ON injuries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trophies_updated_at BEFORE UPDATE ON trophies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access" ON countries FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON leagues FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON venues FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON coaches FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON fixtures FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON lineups FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON lineup_players FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON player_statistics FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON team_statistics FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON standings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON squads FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON transfers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON injuries FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON trophies FOR SELECT USING (true);

-- Create service role policies for full access (needed for import scripts)
CREATE POLICY "Service role full access" ON countries FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON leagues FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON teams FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON venues FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON players FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON coaches FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON fixtures FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON lineups FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON lineup_players FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON events FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON player_statistics FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON team_statistics FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON standings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON squads FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON transfers FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON injuries FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON trophies FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully with all API-Football endpoint support!';
    RAISE NOTICE 'Tables created: %, indexes: %, triggers: %', 
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'),
        (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public');
END $$;