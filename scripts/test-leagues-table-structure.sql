-- test-leagues-table-structure.sql
-- Quick test to understand the current leagues table structure and constraints

-- 1. Check table structure
\echo '=== LEAGUES TABLE STRUCTURE ==='
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leagues' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check all constraints
\echo '=== LEAGUES TABLE CONSTRAINTS ==='
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'leagues' AND tc.table_schema = 'public'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- 3. Check current data
\echo '=== LEAGUES TABLE DATA SAMPLE ==='
SELECT 
    id,
    season_year,
    name,
    type,
    current
FROM leagues 
ORDER BY id, season_year
LIMIT 10;

-- 4. Check for duplicate issues
\echo '=== POTENTIAL DUPLICATE LEAGUES ==='
SELECT 
    id,
    season_year,
    name,
    COUNT(*) as count
FROM leagues 
GROUP BY id, season_year, name
HAVING COUNT(*) > 1;

-- 5. Test what the error is about
\echo '=== TESTING FOREIGN KEY REFERENCE ==='
-- This should show us if we can reference leagues properly
SELECT 
    'Test: Can we reference leagues(id, season_year)?' as test_description,
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
        ) THEN 'YES - Composite primary key exists'
        WHEN EXISTS(
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
            WHERE tc.table_name = 'leagues' 
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = 'id'
        ) THEN 'PARTIAL - Only id is primary key, missing season_year'
        ELSE 'NO - No suitable primary key found'
    END as result;