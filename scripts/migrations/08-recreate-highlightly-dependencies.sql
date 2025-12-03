-- migrations/08-recreate-highlightly-dependencies.sql
-- This script performs a full cleanup and recreation of Highlightly-related
-- dependencies to align with the new events_v2 table structure.

BEGIN;

-- == STEP 1: DROP OLD DEPENDENT OBJECTS ==

-- Drop the new view first to break any dependencies on 'events_highlightly_enhanced'
DROP VIEW IF EXISTS public.v2_events_enhanced;

-- Drop the old view that depends on the 'events' table
DROP VIEW IF EXISTS public.events_enhanced;

-- Drop the old highlightly table that depends on the 'events' table
DROP TABLE IF EXISTS public.events_highlightly_enhanced;

-- Finally, drop the old 'events' table itself
DROP TABLE IF EXISTS public.events;

-- == STEP 2: RE-CREATE 'events_highlightly_enhanced' WITH CORRECT FOREIGN KEY ==

CREATE TABLE public.events_highlightly_enhanced (
    id SERIAL PRIMARY KEY,
    
    -- Foreign key to the new events_v2 table
    "matchId" TEXT NOT NULL,
    
    -- Highlightly API identifiers
    highlightly_event_id TEXT,
    highlightly_league_id TEXT,
    highlightly_match_id TEXT,
    
    -- Live data
    live_status TEXT,
    live_minute INTEGER,
    live_period TEXT,
    live_score_home INTEGER,
    live_score_away INTEGER,
    
    -- Advanced stats
    possession_home INTEGER,
    possession_away INTEGER,
    shots_home INTEGER,
    shots_away INTEGER,
    shots_on_target_home INTEGER,
    shots_on_target_away INTEGER,
    corners_home INTEGER,
    corners_away INTEGER,
    fouls_home INTEGER,
    fouls_away INTEGER,
    yellow_cards_home INTEGER,
    yellow_cards_away INTEGER,
    red_cards_home INTEGER,
    red_cards_away INTEGER,
    ht_score_home INTEGER,
    ht_score_away INTEGER,
    
    -- Special metrics
    momentum INTEGER,
    intensity DECIMAL(3,1),
    
    -- Metadata
    highlightly_last_updated TIMESTAMP WITH TIME ZONE,
    highlightly_sync_status TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign Key constraint pointing to the new events_v2 table
    FOREIGN KEY ("matchId") REFERENCES public.events_v2("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_events_highlightly_unique_matchId ON public.events_highlightly_enhanced("matchId");
COMMENT ON TABLE public.events_highlightly_enhanced IS 'Enhanced events data from Highlightly API, linked to the events_v2 table.';
COMMENT ON COLUMN public.events_highlightly_enhanced."matchId" IS 'Foreign key to events_v2 table (TheSportsDB event ID)';

-- == STEP 3: RE-CREATE THE ENHANCED VIEW BASED ON 'events_v2' ==

CREATE OR REPLACE VIEW public.v2_events_enhanced AS
SELECT
    -- Select all columns from the new events_v2 table
    e.*,
    
    -- Select all columns from the new highlightly enhancement table
    eh.highlightly_event_id,
    eh.live_status,
    eh.live_minute,
    -- ... (include all other eh columns as before)
    eh.live_period,
    eh.live_score_home,
    eh.live_score_away,
    eh.possession_home,
    eh.possession_away,
    eh.shots_home,
    eh.shots_away,
    eh.shots_on_target_home,
    eh.shots_on_target_away,
    eh.corners_home,
    eh.corners_away,
    eh.fouls_home,
    eh.fouls_away,
    eh.yellow_cards_home,
    eh.yellow_cards_away,
    eh.red_cards_home,
    eh.red_cards_away,
    eh.ht_score_home,
    eh.ht_score_away,
    eh.momentum,
    eh.intensity,
    eh.highlightly_last_updated,
    eh.highlightly_sync_status,
    
    -- Derived fields
    (eh.live_status = 'live') AS is_live,
    (eh.possession_home - eh.possession_away) AS possession_difference,
    CASE WHEN eh.shots_home > 0 THEN (eh.shots_on_target_home::float / eh.shots_home::float) ELSE 0 END AS shot_accuracy_home,
    CASE WHEN eh.shots_away > 0 THEN (eh.shots_on_target_away::float / eh.shots_away::float) ELSE 0 END AS shot_accuracy_away

FROM 
    public.events_v2 e
LEFT JOIN 
    public.events_highlightly_enhanced eh ON e.id = eh."matchId";

COMMIT;
