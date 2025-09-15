-- SQL script to add unique constraint to prevent duplicate events
-- This constraint ensures that the same event (fixture_id + player_id + type + elapsed) cannot be inserted twice

-- First, let's check if the constraint already exists
-- If it doesn't exist, create it
DO $$
BEGIN
    -- Add unique constraint to prevent duplicate events based on the same logic used in cleanup
    -- NULL values are allowed (events without player_id or elapsed time)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'events_no_duplicates_unique' 
        AND conrelid = 'events'::regclass
    ) THEN
        ALTER TABLE events 
        ADD CONSTRAINT events_no_duplicates_unique 
        UNIQUE (fixture_id, player_id, type, elapsed);
        
        RAISE NOTICE 'Added unique constraint: events_no_duplicates_unique';
    ELSE
        RAISE NOTICE 'Unique constraint events_no_duplicates_unique already exists';
    END IF;
END $$;

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'events_no_duplicates_unique'
AND conrelid = 'events'::regclass;