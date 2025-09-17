-- diagnose-leagues-dependencies.sql
-- Script to identify all objects that depend on leagues table constraints

-- =====================================================
-- 1. Find Foreign Key Dependencies on leagues table
-- =====================================================

SELECT 
    'Foreign Key Dependencies' as dependency_type,
    tc.table_name as dependent_table,
    tc.constraint_name as constraint_name,
    kcu.column_name as dependent_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'leagues'
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 2. Check Current leagues Primary Key Structure
-- =====================================================

SELECT 
    'Current Primary Key' as info_type,
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as pk_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'leagues' 
AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.constraint_name;

-- =====================================================
-- 3. Check if any foreign keys reference (id, season_year)
-- =====================================================

SELECT 
    'Composite Key References' as check_type,
    tc.table_name,
    tc.constraint_name,
    COUNT(DISTINCT kcu.column_name) as column_count,
    STRING_AGG(DISTINCT kcu.column_name, ', ') as columns,
    STRING_AGG(DISTINCT ccu.column_name, ', ') as referenced_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'leagues'
AND tc.constraint_type = 'FOREIGN KEY'
GROUP BY tc.table_name, tc.constraint_name
HAVING COUNT(DISTINCT kcu.column_name) > 1;

-- =====================================================
-- 4. Show sample data to understand the structure
-- =====================================================

SELECT 
    'leagues sample data' as info_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT id) as unique_ids,
    COUNT(DISTINCT (id, season_year)) as unique_id_season_pairs
FROM leagues;

-- Show actual data
SELECT 'Sample leagues data' as info_type;
SELECT id, season_year, name, type FROM leagues ORDER BY id, season_year LIMIT 10;

-- =====================================================
-- 5. Check referencing table structures
-- =====================================================

-- Check teams table references
SELECT 'teams table references' as info_type;
SELECT 
    league_id,
    season_year,
    COUNT(*) as team_count
FROM teams 
GROUP BY league_id, season_year 
ORDER BY league_id, season_year;

-- Check if any teams reference non-existent leagues
SELECT 'orphaned teams references' as check_type;
SELECT DISTINCT t.league_id, t.season_year, 'NOT FOUND IN LEAGUES' as status
FROM teams t
LEFT JOIN leagues l ON t.league_id = l.id AND t.season_year = l.season_year
WHERE l.id IS NULL;

-- =====================================================
-- 6. Get constraint details for safer removal
-- =====================================================

SELECT 
    'Constraint removal order' as strategy_type,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    'DROP CONSTRAINT IF EXISTS ' || tc.constraint_name as drop_command
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'leagues'
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;