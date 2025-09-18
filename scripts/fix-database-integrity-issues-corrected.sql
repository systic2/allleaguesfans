-- fix-database-integrity-issues-corrected.sql
-- This script fixes the database integrity issues with proper constraint handling

-- =====================================================
-- 0. Diagnose Current State
-- =====================================================

-- First, let's check if leagues table has the expected structure
DO $$
DECLARE
    constraint_exists BOOLEAN;
    primary_key_columns TEXT;
BEGIN
    -- Check if leagues has composite primary key (id, season_year)
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_name = 'leagues' 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name IN ('id', 'season_year')
        GROUP BY tc.constraint_name
        HAVING COUNT(*) = 2
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        RAISE NOTICE '⚠️ WARNING: leagues table does not have composite primary key (id, season_year)';
        RAISE NOTICE '   This may cause foreign key reference issues.';
    ELSE
        RAISE NOTICE '✅ leagues table has proper composite primary key';
    END IF;
END $$;

-- =====================================================
-- 1. Fix Events Table Constraints
-- =====================================================

-- Add unique constraint to events table to support ON CONFLICT operations
DROP INDEX IF EXISTS idx_events_unique_constraint;

-- Check if constraint already exists
DO $$
BEGIN
    -- Try to add the constraint
    BEGIN
        ALTER TABLE events ADD CONSTRAINT events_unique_key 
        UNIQUE (fixture_id, team_id, player_id, type, time_elapsed);
        RAISE NOTICE '✅ Added unique constraint to events table';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE '⚠️ events_unique_key constraint already exists, skipping';
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error adding events constraint: %', SQLERRM;
    END;
END $$;

-- Add index for better performance on event queries
CREATE INDEX IF NOT EXISTS idx_events_composite ON events (fixture_id, team_id, player_id);

-- =====================================================
-- 2. Fix Player Statistics League References
-- =====================================================

-- IMPORTANT: Only modify player_statistics if leagues table structure is correct
DO $$
DECLARE
    leagues_has_composite_pk BOOLEAN;
    existing_constraint_name TEXT;
BEGIN
    -- Check if leagues has the expected composite primary key
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_name = 'leagues' 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name IN ('id', 'season_year')
        GROUP BY tc.constraint_name
        HAVING COUNT(*) = 2
    ) INTO leagues_has_composite_pk;
    
    IF leagues_has_composite_pk THEN
        RAISE NOTICE '✅ Leagues table has composite primary key, proceeding with foreign key fix';
        
        -- Drop any existing foreign key constraint on league_id
        SELECT constraint_name INTO existing_constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'player_statistics' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%league%'
        LIMIT 1;
        
        IF existing_constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE player_statistics DROP CONSTRAINT %I', existing_constraint_name);
            RAISE NOTICE '✅ Dropped existing constraint: %', existing_constraint_name;
        END IF;
        
        -- Add the composite foreign key constraint
        ALTER TABLE player_statistics ADD CONSTRAINT player_statistics_league_fkey 
        FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
        
        RAISE NOTICE '✅ Added composite foreign key constraint to player_statistics';
    ELSE
        RAISE NOTICE '⚠️ Skipping player_statistics foreign key fix - leagues table structure incompatible';
        RAISE NOTICE '   Expected: PRIMARY KEY (id, season_year)';
        RAISE NOTICE '   Solution: Run the complete schema creation script first';
    END IF;
END $$;

-- =====================================================
-- 3. Insert Missing Venues (Safe Approach)
-- =====================================================

-- Insert common K League venues that were referenced but missing
DO $$
BEGIN
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
    
    RAISE NOTICE '✅ Inserted/Updated missing venues';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error inserting venues: %', SQLERRM;
END $$;

-- =====================================================
-- 4. Insert Missing Leagues (Safe Approach)
-- =====================================================

-- Insert missing league references (15, 294) that were causing statistics errors
DO $$
BEGIN
    -- First check if we can insert into leagues table
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues') THEN
        INSERT INTO leagues (id, name, type, season_year, current)
        VALUES 
            (15, 'FIFA World Cup', 'Cup', 2025, false),
            (294, 'AFC Asian Cup', 'Cup', 2025, false)
        ON CONFLICT (id, season_year) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            current = EXCLUDED.current,
            updated_at = NOW();
        
        RAISE NOTICE '✅ Inserted/Updated missing leagues';
    ELSE
        RAISE NOTICE '❌ Leagues table not found';
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE '⚠️ Some leagues already exist, updating existing records';
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error inserting leagues: %', SQLERRM;
        RAISE NOTICE '   This may indicate the leagues table has a different structure than expected';
END $$;

-- =====================================================
-- 5. Create Squad Memberships View (Safe)
-- =====================================================

-- Create a view for squad_memberships if squads table exists
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'squads') THEN
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
        
        RAISE NOTICE '✅ Created squad_memberships view';
    ELSE
        RAISE NOTICE '⚠️ squads table not found, skipping view creation';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error creating squad_memberships view: %', SQLERRM;
END $$;

-- =====================================================
-- 6. Fix Team References (Safe)
-- =====================================================

-- Update teams table to ensure venue_id references are valid
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE teams SET venue_id = NULL 
    WHERE venue_id IS NOT NULL 
    AND venue_id NOT IN (SELECT id FROM venues WHERE id IS NOT NULL);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Fixed % teams with invalid venue references', updated_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error fixing team venue references: %', SQLERRM;
END $$;

-- =====================================================
-- 7. Add Performance Indexes (Safe)
-- =====================================================

-- Add missing indexes that will help with import performance
CREATE INDEX IF NOT EXISTS idx_player_statistics_league_season ON player_statistics(league_id, season_year);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(type, time_elapsed);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status_short);

-- =====================================================
-- 8. Create Validation Function (Enhanced)
-- =====================================================

-- Create a function to validate data integrity
CREATE OR REPLACE FUNCTION validate_data_integrity_enhanced() 
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT, recommendation TEXT) AS $$
BEGIN
    -- Check leagues table structure
    RETURN QUERY
    SELECT 
        'leagues_table_structure'::TEXT as check_name,
        CASE 
            WHEN EXISTS(
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name 
                WHERE tc.table_name = 'leagues' 
                AND tc.constraint_type = 'PRIMARY KEY'
                AND kcu.column_name IN ('id', 'season_year')
                GROUP BY tc.constraint_name
                HAVING COUNT(*) = 2
            ) THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN EXISTS(
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name 
                WHERE tc.table_name = 'leagues' 
                AND tc.constraint_type = 'PRIMARY KEY'
                AND kcu.column_name IN ('id', 'season_year')
                GROUP BY tc.constraint_name
                HAVING COUNT(*) = 2
            ) THEN 'Leagues table has proper composite primary key'::TEXT
            ELSE 'Leagues table missing composite primary key (id, season_year)'::TEXT
        END as details,
        'Run complete schema creation script (02-create-all-tables.sql)'::TEXT as recommendation;

    -- Check for orphaned player statistics
    RETURN QUERY
    SELECT 
        'player_statistics_orphaned_leagues'::TEXT as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::TEXT as status,
        'Found ' || COUNT(*) || ' player statistics with invalid league references'::TEXT as details,
        'Clean orphaned data or insert missing leagues'::TEXT as recommendation
    FROM player_statistics ps
    WHERE NOT EXISTS (
        SELECT 1 FROM leagues l 
        WHERE l.id = ps.league_id 
        AND l.season_year = ps.season_year
    );

    -- Check for orphaned fixtures
    RETURN QUERY
    SELECT 
        'fixtures_orphaned_venues'::TEXT as check_name,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::TEXT as status,
        'Found ' || COUNT(*) || ' fixtures with invalid venue references'::TEXT as details,
        'Insert missing venues or clean fixture references'::TEXT as recommendation
    FROM fixtures f
    LEFT JOIN venues v ON f.venue_id = v.id
    WHERE f.venue_id IS NOT NULL AND v.id IS NULL;

    -- Check events unique constraint
    RETURN QUERY
    SELECT 
        'events_unique_constraint'::TEXT as check_name,
        CASE 
            WHEN EXISTS(
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = 'events' 
                AND constraint_name = 'events_unique_key'
            ) THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN EXISTS(
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = 'events' 
                AND constraint_name = 'events_unique_key'
            ) THEN 'Events table has unique constraint for UPSERT operations'::TEXT
            ELSE 'Events table missing unique constraint'::TEXT
        END as details,
        'Add unique constraint: events_unique_key'::TEXT as recommendation;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Final Validation and Report
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database integrity fixes completed!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Run: SELECT * FROM validate_data_integrity_enhanced();';
    RAISE NOTICE 'to check the current status of all fixes.';
    RAISE NOTICE '============================================';
END $$;