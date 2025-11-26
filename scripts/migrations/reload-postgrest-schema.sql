-- Notify PostgREST to reload schema cache
-- Run this in Supabase SQL Editor after creating or modifying tables

NOTIFY pgrst, 'reload schema';

-- Alternative: You can also reload config
NOTIFY pgrst, 'reload config';

-- Verify player_statistics table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'player_statistics'
ORDER BY ordinal_position;
