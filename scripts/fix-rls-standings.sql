-- Fix Row-Level Security for standings table
-- Execute this in your Supabase SQL editor

-- Option 1: Disable RLS for standings table (simpler)
ALTER TABLE standings DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a permissive policy (if you want to keep RLS enabled)
-- DROP POLICY IF EXISTS "Enable read access for all users" ON standings;
-- CREATE POLICY "Enable read access for all users" ON standings FOR SELECT USING (true);
-- CREATE POLICY "Enable insert access for all users" ON standings FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Enable update access for all users" ON standings FOR UPDATE USING (true);

-- Also check if there are any similar issues with other tables
-- You can run this query to check which tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = true;

-- To disable RLS for all tables if needed:
-- ALTER TABLE events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_statistics DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE venues DISABLE ROW LEVEL SECURITY;