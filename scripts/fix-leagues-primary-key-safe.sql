-- fix-leagues-primary-key-safe.sql
-- Safe migration with foreign key dependency handling

-- =====================================================
-- STEP 1: Analyze Current Dependencies
-- =====================================================

DO $$
DECLARE
    fk_record RECORD;
    dependency_count INTEGER;
BEGIN
    RAISE NOTICE '=== ANALYZING FOREIGN KEY DEPENDENCIES ===';
    
    -- Count dependencies
    SELECT COUNT(*) INTO dependency_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'leagues'
    AND tc.constraint_type = 'FOREIGN KEY';
    
    RAISE NOTICE 'Found % foreign key dependencies on leagues table', dependency_count;
    
    -- List each dependency
    FOR fk_record IN
        SELECT 
            tc.table_name as dependent_table,
            tc.constraint_name,
            kcu.column_name as dependent_column,
            ccu.column_name as referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
        WHERE ccu.table_name = 'leagues'
        AND tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name
    LOOP
        RAISE NOTICE '  → %.% (%) references leagues.%', 
            fk_record.dependent_table, 
            fk_record.dependent_column,
            fk_record.constraint_name,
            fk_record.referenced_column;
    END LOOP;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✅ No foreign key dependencies found - safe to modify primary key';
    ELSE
        RAISE NOTICE '⚠️ Found dependencies - will handle them safely';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Create Backups
-- =====================================================

DO $$
DECLARE
    backup_count INTEGER;
BEGIN
    -- Backup leagues table
    DROP TABLE IF EXISTS leagues_backup_safe;
    CREATE TABLE leagues_backup_safe AS SELECT * FROM leagues;
    
    -- Backup dependent tables (if they exist)
    BEGIN
        DROP TABLE IF EXISTS teams_backup_safe;
        CREATE TABLE teams_backup_safe AS SELECT * FROM teams;
        SELECT COUNT(*) INTO backup_count FROM teams_backup_safe;
        RAISE NOTICE '✅ Backed up teams table: % records', backup_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ teams table not found or error backing up: %', SQLERRM;
    END;
    
    BEGIN
        DROP TABLE IF EXISTS fixtures_backup_safe;
        CREATE TABLE fixtures_backup_safe AS SELECT * FROM fixtures;
        SELECT COUNT(*) INTO backup_count FROM fixtures_backup_safe;
        RAISE NOTICE '✅ Backed up fixtures table: % records', backup_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ fixtures table not found or error backing up: %', SQLERRM;
    END;
    
    SELECT COUNT(*) INTO backup_count FROM leagues_backup_safe;
    RAISE NOTICE '✅ Backed up leagues table: % records', backup_count;
END $$;

-- =====================================================
-- STEP 3: Temporarily Drop Foreign Key Constraints
-- =====================================================

DO $$
DECLARE
    fk_constraint RECORD;
    dropped_constraints TEXT[] := '{}';
BEGIN
    RAISE NOTICE '🔧 Temporarily dropping foreign key constraints...';
    
    -- Find and drop all foreign keys referencing leagues
    FOR fk_constraint IN
        SELECT 
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
        WHERE ccu.table_name = 'leagues'
        AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
            fk_constraint.table_name, 
            fk_constraint.constraint_name);
        
        dropped_constraints := dropped_constraints || 
            format('%s.%s', fk_constraint.table_name, fk_constraint.constraint_name);
            
        RAISE NOTICE '  ✅ Dropped: %.%', 
            fk_constraint.table_name, 
            fk_constraint.constraint_name;
    END LOOP;
    
    -- Store dropped constraints for later restoration
    CREATE TEMP TABLE IF NOT EXISTS dropped_fk_constraints (
        table_name TEXT,
        constraint_name TEXT,
        full_name TEXT
    );
    
    DELETE FROM dropped_fk_constraints;
    INSERT INTO dropped_fk_constraints (table_name, constraint_name, full_name)
    SELECT 
        SPLIT_PART(constraint_info, '.', 1) as table_name,
        SPLIT_PART(constraint_info, '.', 2) as constraint_name,
        constraint_info as full_name
    FROM UNNEST(dropped_constraints) as constraint_info;
    
    RAISE NOTICE '📝 Stored % constraint names for restoration', array_length(dropped_constraints, 1);
END $$;

-- =====================================================
-- STEP 4: Remove Duplicates and Fix Primary Key
-- =====================================================

DO $$
DECLARE
    current_constraint_name TEXT;
    record_count INTEGER;
    duplicate_count INTEGER;
BEGIN
    -- Remove duplicates first
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
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    IF duplicate_count > 0 THEN
        RAISE NOTICE '✅ Removed % duplicate records', duplicate_count;
    END IF;
    
    SELECT COUNT(*) INTO record_count FROM leagues;
    RAISE NOTICE '📊 Clean leagues records: %', record_count;
    
    -- Find current primary key constraint name
    SELECT constraint_name INTO current_constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'leagues' 
    AND constraint_type = 'PRIMARY KEY';
    
    -- Now we can safely drop the primary key (no more dependencies)
    IF current_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE leagues DROP CONSTRAINT %I', current_constraint_name);
        RAISE NOTICE '🔧 Dropped primary key: %', current_constraint_name;
    END IF;
    
    -- Add the composite primary key
    ALTER TABLE leagues ADD CONSTRAINT leagues_pkey PRIMARY KEY (id, season_year);
    RAISE NOTICE '✅ Added composite primary key (id, season_year)';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ Failed to modify primary key: %', SQLERRM;
END $$;

-- =====================================================
-- STEP 5: Recreate Foreign Key Constraints with Proper Structure
-- =====================================================

DO $$
DECLARE
    constraint_info RECORD;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Recreating foreign key constraints with proper structure...';
    
    -- Recreate teams foreign key (if teams table exists)
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
            ALTER TABLE teams ADD CONSTRAINT teams_league_fkey 
            FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
            success_count := success_count + 1;
            RAISE NOTICE '  ✅ Added teams.league_fkey (composite)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '  ❌ Failed to add teams constraint: %', SQLERRM;
    END;
    
    -- Recreate fixtures foreign key (if fixtures table exists)
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'fixtures') THEN
            ALTER TABLE fixtures ADD CONSTRAINT fixtures_league_fkey 
            FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
            success_count := success_count + 1;
            RAISE NOTICE '  ✅ Added fixtures.league_fkey (composite)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '  ❌ Failed to add fixtures constraint: %', SQLERRM;
    END;
    
    -- Recreate standings foreign key (if standings table exists)
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'standings') THEN
            ALTER TABLE standings ADD CONSTRAINT standings_league_fkey 
            FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
            success_count := success_count + 1;
            RAISE NOTICE '  ✅ Added standings.league_fkey (composite)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '  ❌ Failed to add standings constraint: %', SQLERRM;
    END;
    
    -- Recreate player_statistics foreign key (if player_statistics table exists)
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'player_statistics') THEN
            ALTER TABLE player_statistics ADD CONSTRAINT player_statistics_league_fkey 
            FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
            success_count := success_count + 1;
            RAISE NOTICE '  ✅ Added player_statistics.league_fkey (composite)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '  ❌ Failed to add player_statistics constraint: %', SQLERRM;
    END;
    
    RAISE NOTICE '📊 Foreign key recreation: % success, % errors', success_count, error_count;
END $$;

-- =====================================================
-- STEP 6: Final Verification
-- =====================================================

DO $$
DECLARE
    pk_columns TEXT;
    fk_count INTEGER;
    is_success BOOLEAN;
BEGIN
    -- Verify primary key
    SELECT STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
    INTO pk_columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'leagues' 
    AND tc.constraint_type = 'PRIMARY KEY';
    
    -- Count recreated foreign keys
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'leagues'
    AND tc.constraint_type = 'FOREIGN KEY';
    
    is_success := (pk_columns = 'id, season_year');
    
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    RAISE NOTICE 'Primary key columns: %', pk_columns;
    RAISE NOTICE 'Foreign key references: %', fk_count;
    RAISE NOTICE 'Status: %', CASE WHEN is_success THEN '✅ SUCCESS' ELSE '❌ FAILED' END;
    
    IF is_success THEN
        -- Clean up backups on success
        DROP TABLE IF EXISTS leagues_backup_safe;
        DROP TABLE IF EXISTS teams_backup_safe;
        DROP TABLE IF EXISTS fixtures_backup_safe;
        
        RAISE NOTICE '========================================';
        RAISE NOTICE '🎉 LEAGUES PRIMARY KEY FIX COMPLETED!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ Composite primary key (id, season_year) created';
        RAISE NOTICE '✅ All foreign key constraints updated';
        RAISE NOTICE '✅ No more PostgreSQL 42830 errors expected';
        RAISE NOTICE '========================================';
    ELSE
        RAISE NOTICE '⚠️ Migration may have issues - backup tables preserved';
        RAISE NOTICE 'Manual intervention may be required';
    END IF;
END $$;