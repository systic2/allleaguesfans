-- migrations/05-drop-old-standings-table.sql
-- This script drops the old `standings` table, as it has been replaced
-- by the new `standings_v2` table.

-- Best practice: Run inside a transaction
BEGIN;

-- Drop the old table if it exists
DROP TABLE IF EXISTS public.standings;

COMMIT;
