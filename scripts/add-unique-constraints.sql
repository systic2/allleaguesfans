-- Add unique constraint to events table to prevent duplicates
-- This will prevent the same event from being inserted twice

-- First, let's add a unique constraint on the combination of fields that make an event unique
ALTER TABLE events 
ADD CONSTRAINT events_unique_constraint 
UNIQUE (
  fixture_id, 
  team_id, 
  player_id, 
  COALESCE(assist_player_id, 0), 
  elapsed_minutes, 
  COALESCE(extra_minutes, 0), 
  event_type, 
  COALESCE(event_detail, '')
);

-- Create an index for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_events_duplicate_check 
ON events (
  fixture_id, 
  team_id, 
  player_id, 
  elapsed_minutes, 
  event_type
);