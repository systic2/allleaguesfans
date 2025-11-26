-- Add highlightly_match_id column to events table

ALTER TABLE events
ADD COLUMN IF NOT EXISTS highlightly_match_id TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_highlightly_match_id
ON events(highlightly_match_id);

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name = 'highlightly_match_id';
