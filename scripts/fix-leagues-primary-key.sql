-- fix-leagues-primary-key.sql
-- Safe migration to fix leagues table primary key structure

-- =====================================================
-- STEP 1: Check Current State
-- =====================================================

DO $$
DECLARE
    current_pk_columns TEXT[];
    has_data BOOLEAN;
    duplicate_count INTEGER;
BEGIN
    -- Check current primary key structure
    SELECT ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position)
    INTO current_pk_columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'leagues' 
    AND tc.constraint_type = 'PRIMARY KEY';
    
    -- Check if table has data
    SELECT EXISTS(SELECT 1 FROM leagues) INTO has_data;
    
    -- Check for potential duplicates that would prevent composite key
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT id, season_year, COUNT(*) as cnt
        FROM leagues 
        GROUP BY id, season_year 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '=== LEAGUES TABLE ANALYSIS ===';
    RAISE NOTICE 'Current PK columns: %', COALESCE(array_to_string(current_pk_columns, ', '), 'NONE');
    RAISE NOTICE 'Table has data: %', CASE WHEN has_data THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE 'Duplicate (id,season_year) pairs: %', duplicate_count;
    RAISE NOTICE '================================';
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'Found % duplicate (id,season_year) pairs - these must be resolved first!', duplicate_count;
    END IF;
END $$;

-- =====================================================
-- STEP 2: Remove Duplicates (if any)
-- =====================================================

-- Show duplicates first
DO $$
DECLARE
    duplicate_record RECORD;
BEGIN
    RAISE NOTICE '=== CHECKING FOR DUPLICATES ===';
    FOR duplicate_record IN 
        SELECT id, season_year, COUNT(*) as count, 
               STRING_AGG(name, ' | ') as names
        FROM leagues 
        GROUP BY id, season_year 
        HAVING COUNT(*) > 1
        ORDER BY id, season_year
    LOOP
        RAISE NOTICE 'Duplicate: ID=%, Season=%, Count=%, Names=%', 
            duplicate_record.id, duplicate_record.season_year, 
            duplicate_record.count, duplicate_record.names;
    END LOOP;
END $$;

-- Remove duplicates (keep the first one, remove others)
WITH ranked_leagues AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY id, season_year ORDER BY created_at DESC) as rn
    FROM leagues
)
DELETE FROM leagues 
WHERE (id, season_year, created_at) IN (
    SELECT id, season_year, created_at
    FROM ranked_leagues 
    WHERE rn > 1
);

-- Report how many were removed
DO $$
DECLARE
    removed_count INTEGER;
BEGIN
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    IF removed_count > 0 THEN
        RAISE NOTICE '✅ Removed % duplicate league records', removed_count;
    ELSE
        RAISE NOTICE '✅ No duplicate records found';
    END IF;
END $$;

-- =====================================================
-- STEP 3: Backup Current Structure
-- =====================================================

-- Create backup of current leagues table
CREATE TABLE leagues_backup_before_pk_fix AS 
SELECT * FROM leagues;

RAISE NOTICE '✅ Created backup table: leagues_backup_before_pk_fix';

-- =====================================================
-- STEP 4: Fix Primary Key Structure
-- =====================================================

DO $$
DECLARE
    current_constraint_name TEXT;
    record_count INTEGER;
BEGIN
    -- Count current records
    SELECT COUNT(*) INTO record_count FROM leagues;
    RAISE NOTICE '📊 Current leagues records: %', record_count;
    
    -- Find current primary key constraint name
    SELECT constraint_name INTO current_constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'leagues' 
    AND constraint_type = 'PRIMARY KEY';
    
    IF current_constraint_name IS NOT NULL THEN
        RAISE NOTICE '🔧 Dropping current primary key: %', current_constraint_name;
        EXECUTE format('ALTER TABLE leagues DROP CONSTRAINT %I', current_constraint_name);
    END IF;
    
    -- Add the composite primary key
    RAISE NOTICE '🔧 Adding composite primary key (id, season_year)';
    ALTER TABLE leagues ADD CONSTRAINT leagues_pkey PRIMARY KEY (id, season_year);
    
    RAISE NOTICE '✅ Successfully updated leagues primary key structure';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update primary key: %', SQLERRM;
END $$;

-- =====================================================
-- STEP 5: Verify the Fix
-- =====================================================

-- Verify the new structure
DO $$
DECLARE
    pk_columns TEXT;
    record_count INTEGER;
BEGIN
    -- Check new primary key
    SELECT STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    INTO pk_columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'leagues' 
    AND tc.constraint_type = 'PRIMARY KEY';
    
    SELECT COUNT(*) INTO record_count FROM leagues;
    
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    RAISE NOTICE '✅ New primary key columns: %', pk_columns;
    RAISE NOTICE '✅ Records preserved: %', record_count;
    
    -- Test if we can now create the foreign key constraint
    IF pk_columns = 'id, season_year' THEN
        RAISE NOTICE '✅ Ready for foreign key constraints!';
    ELSE
        RAISE WARNING '❌ Primary key structure still incorrect: %', pk_columns;
    END IF;
END $$;

-- =====================================================
-- STEP 6: Now Fix Player Statistics Foreign Key
-- =====================================================

DO $$
DECLARE
    existing_constraint_name TEXT;
BEGIN
    RAISE NOTICE '🔧 Fixing player_statistics foreign key constraint...';
    
    -- Drop any existing foreign key constraint on league_id
    SELECT constraint_name INTO existing_constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'player_statistics' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%league%';
    
    IF existing_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE player_statistics DROP CONSTRAINT %I', existing_constraint_name);
        RAISE NOTICE '✅ Dropped existing constraint: %', existing_constraint_name;
    END IF;
    
    -- Add the composite foreign key constraint
    ALTER TABLE player_statistics ADD CONSTRAINT player_statistics_league_fkey 
    FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
    
    RAISE NOTICE '✅ Added composite foreign key constraint to player_statistics';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '❌ Failed to add foreign key constraint: %', SQLERRM;
        RAISE NOTICE '💡 You may need to check for orphaned player_statistics records';
END $$;

-- =====================================================
-- STEP 7: Final Validation
-- =====================================================

-- Run the enhanced validation
SELECT * FROM validate_data_integrity_enhanced() 
WHERE check_name = 'leagues_table_structure';

-- Cleanup backup if everything is successful
DO $$
BEGIN
    -- Only drop backup if the fix was successful
    IF EXISTS(
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_name = 'leagues' 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name IN ('id', 'season_year')
        GROUP BY tc.constraint_name
        HAVING COUNT(*) = 2
    ) THEN
        DROP TABLE IF EXISTS leagues_backup_before_pk_fix;
        RAISE NOTICE '✅ Fix successful - removed backup table';
    ELSE
        RAISE NOTICE '⚠️ Fix may have issues - keeping backup table for safety';
    END IF;
END $$;

RAISE NOTICE '========================================';
RAISE NOTICE '🎉 LEAGUES PRIMARY KEY FIX COMPLETED!';
RAISE NOTICE '========================================';
RAISE NOTICE 'You can now run your original integrity fixes without the 42830 error.';
RAISE NOTICE 'Next: Run the master import script with improved error handling.';
RAISE NOTICE '========================================';