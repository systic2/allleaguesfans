-- Player Statistics Schema
-- Tracks individual player performance metrics (goals, assists, cards, etc.)

-- Drop existing table if needed
DROP TABLE IF EXISTS public.player_statistics CASCADE;

-- Create player_statistics table
CREATE TABLE public.player_statistics (
    id SERIAL PRIMARY KEY,

    -- Player identification
    idPlayer TEXT NOT NULL,  -- TheSportsDB player ID
    strPlayer TEXT NOT NULL,  -- Player name
    idTeam TEXT NOT NULL,     -- Team ID
    strTeam TEXT,             -- Team name
    idLeague TEXT NOT NULL,   -- League ID
    strSeason TEXT NOT NULL,  -- Season (e.g., '2025')

    -- Performance statistics
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    minutes_played INTEGER DEFAULT 0,

    -- Additional stats
    own_goals INTEGER DEFAULT 0,
    penalties_scored INTEGER DEFAULT 0,
    penalties_missed INTEGER DEFAULT 0,

    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one statistics record per player per season per league
    UNIQUE(idPlayer, idLeague, strSeason)
);

-- Create indexes for performance
CREATE INDEX idx_player_stats_player ON public.player_statistics(idPlayer);
CREATE INDEX idx_player_stats_team ON public.player_statistics(idTeam);
CREATE INDEX idx_player_stats_league ON public.player_statistics(idLeague);
CREATE INDEX idx_player_stats_season ON public.player_statistics(strSeason);
CREATE INDEX idx_player_stats_goals ON public.player_statistics(goals DESC);
CREATE INDEX idx_player_stats_assists ON public.player_statistics(assists DESC);

-- Create view for top scorers
CREATE OR REPLACE VIEW public.top_scorers AS
SELECT
    idPlayer,
    strPlayer,
    idTeam,
    strTeam,
    idLeague,
    strSeason,
    goals,
    assists,
    appearances,
    ROUND((goals::numeric / NULLIF(appearances, 0)), 2) as goals_per_game
FROM public.player_statistics
WHERE goals > 0
ORDER BY goals DESC, assists DESC, goals_per_game DESC;

-- Create view for top assisters
CREATE OR REPLACE VIEW public.top_assisters AS
SELECT
    idPlayer,
    strPlayer,
    idTeam,
    strTeam,
    idLeague,
    strSeason,
    assists,
    goals,
    appearances,
    ROUND((assists::numeric / NULLIF(appearances, 0)), 2) as assists_per_game
FROM public.player_statistics
WHERE assists > 0
ORDER BY assists DESC, goals DESC, assists_per_game DESC;

-- Enable Row Level Security
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Enable read access for all users" ON public.player_statistics
    FOR SELECT
    USING (true);

-- Create policy for service role write access
CREATE POLICY "Enable write access for service role" ON public.player_statistics
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.player_statistics IS 'Player performance statistics aggregated from match events';
COMMENT ON VIEW public.top_scorers IS 'Top goal scorers ranked by goals, assists, and goals per game';
COMMENT ON VIEW public.top_assisters IS 'Top assist providers ranked by assists, goals, and assists per game';
