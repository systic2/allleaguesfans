-- migrations/09-create-teams-v2-schema.sql
-- This script creates the new `teams_v2` table.
-- The schema is based on the standardized `Team` domain model
-- defined in `src/types/domain.ts`.

BEGIN;

-- Drop table if it exists for easy re-running during development
DROP TABLE IF EXISTS public.teams_v2;

-- Create the new teams_v2 table
CREATE TABLE public.teams_v2 (
    "id" TEXT PRIMARY KEY, -- Using TheSportsDB idTeam as the primary key
    "name" TEXT NOT NULL,
    "nameKorean" TEXT,
    "badgeUrl" TEXT,
    
    -- Using a JSONB column for source-specific IDs is flexible
    "sourceIds" JSONB,
    
    -- Timestamps
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a trigger to automatically update the 'updatedAt' column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.teams_v2
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add comments for clarity
COMMENT ON TABLE public.teams_v2 IS 'Stores team information, standardized from multiple sources.';
COMMENT ON COLUMN public.teams_v2.id IS 'Primary key, typically from the main data source (e.g., TheSportsDB idTeam).';
COMMENT ON COLUMN public.teams_v2.name IS 'The official name of the team.';
COMMENT ON COLUMN public.teams_v2."badgeUrl" IS 'URL for the team''s badge/logo.';
COMMENT ON COLUMN public.teams_v2."sourceIds" IS 'JSONB object containing original IDs from various sources.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.teams_v2 ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on teams_v2"
ON public.teams_v2
FOR SELECT
USING (true);

COMMIT;
