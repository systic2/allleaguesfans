-- diagnose-leagues-table.sql
-- Script to diagnose the current leagues table structure

-- Check current table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leagues' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check existing constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
WHERE tc.table_name = 'leagues' AND tc.table_schema = 'public';

-- Check existing indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'leagues' AND schemaname = 'public';

-- Check current data structure
SELECT 
    id,
    season_year,
    name,
    COUNT(*) as record_count
FROM leagues 
GROUP BY id, season_year, name
ORDER BY id, season_year;