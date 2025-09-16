-- Complete fix for standings table issues
-- Execute this in your Supabase SQL editor

-- 1. Disable RLS for standings table
ALTER TABLE standings DISABLE ROW LEVEL SECURITY;

-- 2. Check current standings table structure
-- (You can run this to see what columns exist)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'standings' AND table_schema = 'public'
-- ORDER BY column_name;

-- 3. Add missing columns if they don't exist (ignore errors if columns already exist)
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

-- 4. Test insert to verify it works
-- INSERT INTO standings (league_id, season_year, team_id, rank_position, points, goals_diff) 
-- VALUES (292, 2025, 2762, 1, 66, 25);
-- 
-- -- Clean up test
-- DELETE FROM standings WHERE team_id = 2762;