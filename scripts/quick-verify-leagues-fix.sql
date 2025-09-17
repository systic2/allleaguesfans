-- quick-verify-leagues-fix.sql
-- Quick verification script to check leagues table status

-- Check current primary key structure
SELECT 
    'Primary Key Check' as test_type,
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
        ) THEN '✅ CORRECT - Composite (id, season_year) primary key exists'
        ELSE '❌ INCORRECT - Missing composite primary key'
    END as result;

-- Check foreign key constraint status
SELECT 
    'Foreign Key Check' as test_type,
    CASE 
        WHEN EXISTS(
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'player_statistics' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'player_statistics_league_fkey'
        ) THEN '✅ CORRECT - player_statistics foreign key exists'
        ELSE '⚠️  PENDING - Foreign key constraint not yet created'
    END as result;

-- Check for duplicates that might prevent primary key creation
SELECT 
    'Duplicate Check' as test_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ CLEAN - No duplicate (id, season_year) pairs'
        ELSE '❌ ISSUE - Found ' || COUNT(*) || ' duplicate pairs'
    END as result
FROM (
    SELECT id, season_year, COUNT(*) as cnt
    FROM leagues 
    GROUP BY id, season_year 
    HAVING COUNT(*) > 1
) duplicates;

-- Show current leagues data structure
SELECT 
    'Data Sample' as info_type,
    'Current leagues in database:' as description;

SELECT 
    id,
    season_year,
    name,
    type,
    current
FROM leagues 
ORDER BY id, season_year
LIMIT 10;