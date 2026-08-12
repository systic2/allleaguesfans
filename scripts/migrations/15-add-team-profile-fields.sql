-- Add club profile fields to teams_v2, sourced from TheSportsDB's lookupteam.php
-- (strLocation, intStadiumCapacity, strWebsite, strDescriptionEN, strEquipment).
-- Backfilled by scripts/one-off/populate-team-details.ts.
ALTER TABLE teams_v2
ADD COLUMN IF NOT EXISTS "strLocation" TEXT,
ADD COLUMN IF NOT EXISTS "intStadiumCapacity" INTEGER,
ADD COLUMN IF NOT EXISTS "strWebsite" TEXT,
ADD COLUMN IF NOT EXISTS "strDescriptionEN" TEXT,
ADD COLUMN IF NOT EXISTS "strEquipment" TEXT;

-- Verify columns are added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'teams_v2';
