-- Force recreate player_statistics table to refresh PostgREST cache
-- Run this in Supabase SQL Editor

-- Drop and recreate
DROP TABLE IF EXISTS public.player_statistics CASCADE;

CREATE TABLE public.player_statistics (
    id SERIAL PRIMARY KEY,

    -- Player identification
    "idPlayer" TEXT NOT NULL,
    "strPlayer" TEXT NOT NULL,
    "idTeam" TEXT NOT NULL,
    "strTeam" TEXT,
    "idLeague" TEXT NOT NULL,
    "strSeason" TEXT NOT NULL,

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

    -- Unique constraint
    UNIQUE("idPlayer", "idLeague", "strSeason")
);

-- Create indexes
CREATE INDEX idx_player_stats_player ON public.player_statistics("idPlayer");
CREATE INDEX idx_player_stats_team ON public.player_statistics("idTeam");
CREATE INDEX idx_player_stats_league ON public.player_statistics("idLeague");
CREATE INDEX idx_player_stats_season ON public.player_statistics("strSeason");
CREATE INDEX idx_player_stats_goals ON public.player_statistics(goals DESC);
CREATE INDEX idx_player_stats_assists ON public.player_statistics(assists DESC);

-- Create views
CREATE OR REPLACE VIEW public.top_scorers AS
SELECT
    "idPlayer",
    "strPlayer",
    "idTeam",
    "strTeam",
    "idLeague",
    "strSeason",
    goals,
    assists,
    appearances,
    ROUND((goals::numeric / NULLIF(appearances, 0)), 2) as goals_per_game
FROM public.player_statistics
WHERE goals > 0
ORDER BY goals DESC, assists DESC, goals_per_game DESC;

CREATE OR REPLACE VIEW public.top_assisters AS
SELECT
    "idPlayer",
    "strPlayer",
    "idTeam",
    "strTeam",
    "idLeague",
    "strSeason",
    assists,
    goals,
    appearances,
    ROUND((assists::numeric / NULLIF(appearances, 0)), 2) as assists_per_game
FROM public.player_statistics
WHERE assists > 0
ORDER BY assists DESC, goals DESC, assists_per_game DESC;

-- Enable RLS
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.player_statistics;
CREATE POLICY "Enable read access for all users" ON public.player_statistics
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Enable write access for service role" ON public.player_statistics;
CREATE POLICY "Enable write access for service role" ON public.player_statistics
    FOR ALL
    USING (auth.role() = 'service_role');

-- Force PostgREST to reload
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'player_statistics'
ORDER BY ordinal_position;
