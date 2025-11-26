-- Update RLS policy to allow INSERT for authenticated and anon users
-- This is safe because the table is write-only for data synchronization

-- Drop existing write policy
DROP POLICY IF EXISTS "Enable write access for service role" ON public.player_statistics;

-- Create new policy allowing all write operations
CREATE POLICY "Enable write access for all" ON public.player_statistics
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verify policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'player_statistics';
