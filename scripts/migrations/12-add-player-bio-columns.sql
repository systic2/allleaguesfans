-- Add biographical columns to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS "strNationality" TEXT,
ADD COLUMN IF NOT EXISTS "strHeight" TEXT,
ADD COLUMN IF NOT EXISTS "strWeight" TEXT,
ADD COLUMN IF NOT EXISTS "dateBorn" DATE,
ADD COLUMN IF NOT EXISTS "strThumb" TEXT,
ADD COLUMN IF NOT EXISTS "strBirthLocation" TEXT;

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players';
