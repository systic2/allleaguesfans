-- Simplified TheSportsDB Schema for Manual Execution

-- Create leagues table with TheSportsDB structure
CREATE TABLE public.leagues (
    -- Primary Key (TheSportsDB)
    "idLeague" TEXT PRIMARY KEY,
    
    -- Basic Information
    "strLeague" TEXT,
    "strLeagueAlternate" TEXT,
    "strSport" TEXT,
    "strCountry" TEXT,
    "strCurrentSeason" TEXT,
    "intFormedYear" TEXT,
    "dateFirstEvent" TEXT,
    "strGender" TEXT,
    "strWebsite" TEXT,
    "intDivision" TEXT,
    "idCup" TEXT,
    
    -- External API IDs
    "idSoccerXML" TEXT,
    "idAPIfootball" TEXT,
    "highlightly_id" BIGINT, -- Highlightly API mapping
    
    -- Social Media
    "strFacebook" TEXT,
    "strInstagram" TEXT,
    "strTwitter" TEXT,
    "strYoutube" TEXT,
    "strRSS" TEXT,
    
    -- Descriptions (Multi-language)
    "strDescriptionEN" TEXT,
    "strDescriptionDE" TEXT,
    "strDescriptionFR" TEXT,
    "strDescriptionIT" TEXT,
    "strDescriptionCN" TEXT,
    "strDescriptionJP" TEXT,
    "strDescriptionRU" TEXT,
    "strDescriptionES" TEXT,
    "strDescriptionPT" TEXT,
    "strDescriptionSE" TEXT,
    "strDescriptionNL" TEXT,
    "strDescriptionHU" TEXT,
    "strDescriptionNO" TEXT,
    "strDescriptionPL" TEXT,
    "strDescriptionIL" TEXT,
    
    -- Media Assets
    "strBadge" TEXT,
    "strLogo" TEXT,
    "strBanner" TEXT,
    "strPoster" TEXT,
    "strTrophy" TEXT,
    "strFanart1" TEXT,
    "strFanart2" TEXT,
    "strFanart3" TEXT,
    "strFanart4" TEXT,
    
    -- Other Fields
    "strTvRights" TEXT,
    "strNaming" TEXT,
    "strComplete" TEXT,
    "strLocked" TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table with TheSportsDB structure
CREATE TABLE public.teams (
    -- Primary Key (TheSportsDB)
    "idTeam" TEXT PRIMARY KEY,
    
    -- Basic Information
    "strTeam" TEXT,
    "strTeamAlternate" TEXT,
    "strTeamShort" TEXT,
    "intFormedYear" TEXT,
    "strSport" TEXT,
    "strCountry" TEXT,
    
    -- League Associations
    "strLeague" TEXT,
    "idLeague" TEXT REFERENCES public.leagues("idLeague"),
    "strLeague2" TEXT,
    "idLeague2" TEXT,
    "strLeague3" TEXT,
    "idLeague3" TEXT,
    "strLeague4" TEXT,
    "idLeague4" TEXT,
    
    -- External API IDs
    "idESPN" TEXT,
    "idAPIfootball" TEXT,
    "intLoved" TEXT,
    "highlightly_id" BIGINT, -- Highlightly API mapping
    
    -- Colors and Styling
    "strColour1" TEXT,
    "strColour2" TEXT,
    "strColour3" TEXT,
    "strColour4" TEXT,
    "strColour5" TEXT,
    "strColour6" TEXT,
    
    -- Media Assets
    "strBadge" TEXT,
    "strLogo" TEXT,
    "strBanner" TEXT,
    "strEquipment" TEXT,
    "strFanart1" TEXT,
    "strFanart2" TEXT,
    "strFanart3" TEXT,
    "strFanart4" TEXT,
    
    -- Stadium Information
    "strStadium" TEXT,
    "strStadiumThumb" TEXT,
    "strStadiumDescription" TEXT,
    "strStadiumLocation" TEXT,
    "intStadiumCapacity" TEXT,
    
    -- Descriptions (Multi-language)
    "strDescriptionEN" TEXT,
    "strDescriptionDE" TEXT,
    "strDescriptionFR" TEXT,
    "strDescriptionIT" TEXT,
    "strDescriptionCN" TEXT,
    "strDescriptionJP" TEXT,
    "strDescriptionRU" TEXT,
    "strDescriptionES" TEXT,
    "strDescriptionPT" TEXT,
    "strDescriptionSE" TEXT,
    "strDescriptionNL" TEXT,
    "strDescriptionHU" TEXT,
    "strDescriptionNO" TEXT,
    "strDescriptionPL" TEXT,
    "strDescriptionIL" TEXT,
    
    -- Social Media
    "strWebsite" TEXT,
    "strFacebook" TEXT,
    "strTwitter" TEXT,
    "strInstagram" TEXT,
    "strYoutube" TEXT,
    "strRSS" TEXT,
    
    -- Other Fields
    "strGender" TEXT,
    "strKeywords" TEXT,
    "strLocked" TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create minimal players table
CREATE TABLE public.players (
    "idPlayer" TEXT PRIMARY KEY,
    "strPlayer" TEXT,
    "strTeam" TEXT,
    "idTeam" TEXT REFERENCES public.teams("idTeam"),
    "strPosition" TEXT,
    "strNumber" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create minimal events table  
CREATE TABLE public.events (
    "idEvent" TEXT PRIMARY KEY,
    "strEvent" TEXT,
    "idLeague" TEXT REFERENCES public.leagues("idLeague"),
    "strHomeTeam" TEXT,
    "strAwayTeam" TEXT,
    "dateEvent" TEXT,
    "strStatus" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create standings table with Highlightly structure
CREATE TABLE public.standings (
    id SERIAL PRIMARY KEY,
    league_id BIGINT,
    "idLeague" TEXT REFERENCES public.leagues("idLeague"),
    season INTEGER,
    team_name TEXT,
    rank INTEGER,
    points INTEGER,
    total_games INTEGER,
    total_wins INTEGER,
    total_draws INTEGER,
    total_losses INTEGER,
    total_goals_for INTEGER,
    total_goals_against INTEGER,
    goal_difference INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON public.standings FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;