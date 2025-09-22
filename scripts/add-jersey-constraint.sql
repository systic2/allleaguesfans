-- Add unique constraint to prevent duplicate jersey numbers within teams
-- This constraint ensures that no two players on the same team can have the same jersey number

-- First, we need to handle the existing duplicates by setting them to NULL temporarily
-- This allows us to add the constraint, then fix the NULLs properly

DO $$
DECLARE 
    team_record RECORD;
    player_record RECORD;
    used_numbers INTEGER[];
    next_available INTEGER;
BEGIN
    -- Process each team to fix duplicates
    FOR team_record IN 
        SELECT DISTINCT team_id 
        FROM players 
        WHERE jersey_number IS NOT NULL
        ORDER BY team_id
    LOOP
        used_numbers := ARRAY[]::INTEGER[];
        
        -- Process players in this team, keeping first occurrence of each jersey number
        FOR player_record IN 
            SELECT id, jersey_number, position, name,
                   ROW_NUMBER() OVER (PARTITION BY team_id, jersey_number ORDER BY id) as rn
            FROM players 
            WHERE team_id = team_record.team_id 
              AND jersey_number IS NOT NULL
            ORDER BY jersey_number, id
        LOOP
            IF player_record.rn = 1 THEN
                -- Keep the first player with this jersey number
                used_numbers := used_numbers || player_record.jersey_number;
            ELSE
                -- Find next available jersey number for duplicate
                next_available := 1;
                WHILE next_available = ANY(used_numbers) LOOP
                    next_available := next_available + 1;
                    IF next_available > 99 THEN
                        EXIT; -- Safety limit
                    END IF;
                END LOOP;
                
                -- Update the duplicate player
                IF next_available <= 99 THEN
                    UPDATE players 
                    SET jersey_number = next_available 
                    WHERE id = player_record.id;
                    
                    used_numbers := used_numbers || next_available;
                    
                    RAISE NOTICE 'Team %: Updated player % (%) from jersey % to %', 
                        team_record.team_id, player_record.name, player_record.id, 
                        player_record.jersey_number, next_available;
                ELSE
                    -- Set to NULL if we can't find available number
                    UPDATE players 
                    SET jersey_number = NULL 
                    WHERE id = player_record.id;
                    
                    RAISE NOTICE 'Team %: Set player % (%) jersey to NULL (no available numbers)', 
                        team_record.team_id, player_record.name, player_record.id;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Now add the unique constraint
-- This will prevent future duplicate jersey numbers within teams
ALTER TABLE players 
ADD CONSTRAINT unique_jersey_per_team 
UNIQUE (team_id, jersey_number);

-- Add a check constraint to ensure jersey numbers are within reasonable range
ALTER TABLE players 
ADD CONSTRAINT valid_jersey_number 
CHECK (jersey_number IS NULL OR (jersey_number >= 1 AND jersey_number <= 99));

-- Create an index for better performance on team + jersey lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_team_jersey 
ON players (team_id, jersey_number) 
WHERE jersey_number IS NOT NULL;