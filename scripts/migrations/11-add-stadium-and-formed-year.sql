-- Add strStadium and intFormedYear columns to teams_v2 table
ALTER TABLE teams_v2
ADD COLUMN IF NOT EXISTS "strStadium" TEXT,
ADD COLUMN IF NOT EXISTS "intFormedYear" TEXT;

-- Verify columns are added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teams_v2';
