-- Create tables for top scorers and top assists
-- Execute this in your Supabase SQL editor

-- 1. Create top_scorers table
CREATE TABLE IF NOT EXISTS top_scorers (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_photo TEXT,
    team_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    team_logo TEXT,
    rank_position INTEGER NOT NULL,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    minutes INTEGER DEFAULT 0,
    penalties_scored INTEGER DEFAULT 0,
    penalties_missed INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    player_rating DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for league/season/player combination
    UNIQUE(league_id, season_year, player_id)
);

-- 2. Create top_assists table  
CREATE TABLE IF NOT EXISTS top_assists (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_photo TEXT,
    team_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    team_logo TEXT,
    rank_position INTEGER NOT NULL,
    assists INTEGER NOT NULL DEFAULT 0,
    goals INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    minutes INTEGER DEFAULT 0,
    key_passes INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    player_rating DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for league/season/player combination
    UNIQUE(league_id, season_year, player_id)
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_top_scorers_league_season ON top_scorers(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_top_scorers_rank ON top_scorers(rank_position);
CREATE INDEX IF NOT EXISTS idx_top_assists_league_season ON top_assists(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_top_assists_rank ON top_assists(rank_position);

-- 4. Enable Row Level Security (RLS) for both tables
ALTER TABLE top_scorers ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_assists ENABLE ROW LEVEL SECURITY;

-- 5. Create policies to allow read access for all users
CREATE POLICY IF NOT EXISTS "Allow read access for top_scorers" ON top_scorers
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow read access for top_assists" ON top_assists
    FOR SELECT USING (true);

-- 6. Grant permissions for service role
GRANT ALL ON top_scorers TO service_role;
GRANT ALL ON top_assists TO service_role;
GRANT USAGE ON SEQUENCE top_scorers_id_seq TO service_role;
GRANT USAGE ON SEQUENCE top_assists_id_seq TO service_role;

-- Success message
SELECT 'Top scorers and assists tables created successfully!' as result;