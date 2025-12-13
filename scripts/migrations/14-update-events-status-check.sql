-- Remove the restrictive check constraint on events_v2 status column
-- to allow for granular match statuses like '1H', '2H', 'HT', 'ET', etc. from TheSportsDB.

ALTER TABLE events_v2 DROP CONSTRAINT IF EXISTS events_v2_status_check;

-- Optionally, we can add a new constraint with the expanded list, 
-- but leaving it open allows for better future compatibility with API changes.
-- If strict validation is needed, uncomment and update the following:
-- ALTER TABLE events_v2 ADD CONSTRAINT events_v2_status_check 
-- CHECK (status IN ('SCHEDULED', 'FINISHED', 'POSTPONED', 'CANCELED', 'IN_PLAY', 'LIVE', 'UNKNOWN', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'FT', 'AET', 'PEN'));
