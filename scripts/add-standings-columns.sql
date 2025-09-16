-- Add missing columns to standings table (RLS 정책은 그대로 유지)
-- Execute this in your Supabase SQL editor

-- Add missing columns if they don't exist (ignore errors if columns already exist)
ALTER TABLE standings ADD COLUMN IF NOT EXISTS goals_diff INTEGER;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS form TEXT;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS description TEXT;

-- All match statistics columns
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_played INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_win INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_draw INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_lose INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_goals_for INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS all_goals_against INTEGER DEFAULT 0;

-- Home match statistics
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_played INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_win INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_draw INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_lose INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_goals_for INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS home_goals_against INTEGER DEFAULT 0;

-- Away match statistics  
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_played INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_win INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_draw INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_lose INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_goals_for INTEGER DEFAULT 0;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS away_goals_against INTEGER DEFAULT 0;

-- Check current columns (you can run this to verify)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'standings' AND table_schema = 'public'
-- ORDER BY column_name;