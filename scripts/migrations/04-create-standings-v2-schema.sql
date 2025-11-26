-- migrations/04-create-standings-v2-schema.sql
-- This script creates the new `standings_v2` table.
-- The schema is based on the standardized `Standing` domain model
-- defined in `src/types/domain.ts`.

-- Best practice: Run inside a transaction
BEGIN;

-- Drop table if it exists to allow for re-running the script during development
DROP TABLE IF EXISTS public.standings_v2;

-- Create the new standings_v2 table
CREATE TABLE public.standings_v2 (
    -- Composite Primary Key
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,

    -- Main ranking data
    "rank" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL, -- Denormalized for convenience
    "teamBadgeUrl" TEXT, -- Denormalized for convenience
    "points" INTEGER NOT NULL,
    
    -- Detailed match stats
    "gamesPlayed" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    
    -- Goal stats
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalDifference" INTEGER NOT NULL,

    -- Additional information
    "form" TEXT, -- e.g., "W-W-L-D-L"
    "description" TEXT,

    -- Timestamps
    "lastUpdated" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Define the composite primary key
    PRIMARY KEY ("leagueId", "teamId", "season")
);

-- Add comments to the columns for clarity
COMMENT ON TABLE public.standings_v2 IS 'Stores the league standings data, standardized from multiple sources.';
COMMENT ON COLUMN public.standings_v2."leagueId" IS 'Internal or source-specific league identifier.';
COMMENT ON COLUMN public.standings_v2."teamId" IS 'Internal or source-specific team identifier.';
COMMENT ON COLUMN public.standings_v2."season" IS 'The season year for the standing, e.g., "2025".';
COMMENT ON COLUMN public.standings_v2."rank" IS 'The team''s rank in the league.';
COMMENT ON COLUMN public.standings_v2."teamName" IS 'Denormalized team name for easier querying.';
COMMENT ON COLUMN public.standings_v2."lastUpdated" IS 'Timestamp of when the data was last updated from the source.';
COMMENT ON COLUMN public.standings_v2."createdAt" IS 'Timestamp of when the record was created in this table.';

-- Enable Row Level Security (RLS) for the new table, following Supabase best practices.
-- This ensures data is not publicly accessible by default.
ALTER TABLE public.standings_v2 ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access.
-- Adjust this policy based on your application's security requirements.
CREATE POLICY "Allow public read access on standings_v2"
ON public.standings_v2
FOR SELECT
USING (true);

COMMIT;
