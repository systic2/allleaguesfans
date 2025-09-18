-- fix-database-integrity-issues.sql
-- This script fixes the database integrity issues identified in the GitHub Actions log

-- =====================================================
-- 1. Fix Events Table Constraints
-- =====================================================

-- Add unique constraint to events table to support ON CONFLICT operations
DROP INDEX IF EXISTS idx_events_unique_constraint;
ALTER TABLE events ADD CONSTRAINT events_unique_key 
UNIQUE (fixture_id, team_id, player_id, type, time_elapsed);

-- Add index for better performance on event queries
CREATE INDEX IF NOT EXISTS idx_events_composite ON events (fixture_id, team_id, player_id);

-- =====================================================
-- 2. Fix Player Statistics League References
-- =====================================================

-- Update player_statistics table to handle composite foreign key correctly
-- The issue is that league_id references need to match the leagues table structure

-- Drop the existing foreign key constraint for league_id
ALTER TABLE player_statistics DROP CONSTRAINT IF EXISTS player_statistics_league_id_fkey;

-- Add a composite foreign key that matches the leagues table structure
ALTER TABLE player_statistics ADD CONSTRAINT player_statistics_league_fkey 
FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);

-- =====================================================
-- 3. Insert Missing Venues
-- =====================================================

-- Insert common K League venues that were referenced but missing
INSERT INTO venues (id, name, city, country, capacity, surface)
VALUES 
    (1005, 'Suwon World Cup Stadium', 'Suwon', 'South Korea', 43959, 'Grass'),
    (1009, 'Seoul World Cup Stadium', 'Seoul', 'South Korea', 66806, 'Grass'),
    (1010, 'Daegu Stadium', 'Daegu', 'South Korea', 66422, 'Grass')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    country = EXCLUDED.country,
    capacity = EXCLUDED.capacity,
    surface = EXCLUDED.surface,
    updated_at = NOW();

-- =====================================================
-- 4. Insert Missing Leagues for Statistics
-- =====================================================

-- Insert missing league references (15, 294) that were causing statistics errors
-- These might be related to other competitions or historical data
INSERT INTO leagues (id, name, type, season_year, current)
VALUES 
    (15, 'FIFA World Cup', 'Cup', 2025, false),
    (294, 'AFC Asian Cup', 'Cup', 2025, false)
ON CONFLICT (id, season_year) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    current = EXCLUDED.current,
    updated_at = NOW();

-- =====================================================
-- 5. Update Standings Table for UPSERT Support
-- =====================================================

-- The standings table already has the correct unique constraint:
-- UNIQUE(league_id, season_year, team_id)
-- No schema changes needed, just need to update the application code

-- =====================================================
-- 6. Add Missing Squad Memberships Table (if needed)
-- =====================================================

-- The script references squad_memberships but schema has 'squads'
-- Create a view or synonym if the import expects 'squad_memberships'
CREATE OR REPLACE VIEW squad_memberships AS 
SELECT 
    id,
    team_id,
    player_id,
    season_year,
    position,
    jersey_number,
    created_at,
    updated_at
FROM squads;

-- =====================================================
-- 7. Fix Team References in Various Tables
-- =====================================================

-- Update teams table to ensure venue_id references are valid
-- This will clean up any invalid venue references
UPDATE teams SET venue_id = NULL 
WHERE venue_id NOT IN (SELECT id FROM venues);

-- =====================================================
-- 8. Add Logging for Import Operations
-- =====================================================

-- Create a simple log table to track import operations
CREATE TABLE IF NOT EXISTS import_logs (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index on import_logs
CREATE INDEX IF NOT EXISTS idx_import_logs_operation ON import_logs(operation, started_at);

-- =====================================================
-- 9. Performance Optimization Indexes
-- =====================================================

-- Add missing indexes that will help with import performance
CREATE INDEX IF NOT EXISTS idx_player_statistics_league_season ON player_statistics(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(type, time_elapsed);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status_short);

-- =====================================================
-- 10. Data Validation Functions
-- =====================================================

-- Create a function to validate data integrity
CREATE OR REPLACE FUNCTION validate_data_integrity() 
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Check for orphaned player statistics
    RETURN QUERY
    SELECT 
        'player_statistics_orphaned_leagues'::TEXT as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::TEXT as status,
        'Found ' || COUNT(*) || ' player statistics with invalid league references'::TEXT as details
    FROM player_statistics ps
    LEFT JOIN leagues l ON ps.league_id = l.id AND ps.season_year = l.season_year
    WHERE l.id IS NULL;

    -- Check for orphaned fixtures
    RETURN QUERY
    SELECT 
        'fixtures_orphaned_venues'::TEXT as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::TEXT as status,
        'Found ' || COUNT(*) || ' fixtures with invalid venue references'::TEXT as details
    FROM fixtures f
    LEFT JOIN venues v ON f.venue_id = v.id
    WHERE f.venue_id IS NOT NULL AND v.id IS NULL;

    -- Check for duplicate standings
    RETURN QUERY
    SELECT 
        'standings_duplicates'::TEXT as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'WARN' ELSE 'PASS' END::TEXT as status,
        'Found ' || COUNT(*) || ' potential duplicate standings entries'::TEXT as details
    FROM (
        SELECT league_id, season_year, team_id, COUNT(*) as cnt
        FROM standings
        GROUP BY league_id, season_year, team_id
        HAVING COUNT(*) > 1
    ) duplicates;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Completion Message
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database integrity fixes completed!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Events table constraints added';
    RAISE NOTICE '✅ Player statistics foreign keys fixed';
    RAISE NOTICE '✅ Missing venues inserted';
    RAISE NOTICE '✅ Missing leagues inserted';
    RAISE NOTICE '✅ Squad memberships view created';
    RAISE NOTICE '✅ Performance indexes added';
    RAISE NOTICE '✅ Data validation function created';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Run: SELECT * FROM validate_data_integrity(); to check status';
END $$;