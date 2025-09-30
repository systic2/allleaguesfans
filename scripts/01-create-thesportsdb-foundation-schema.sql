-- TheSportsDB Foundation Schema
-- 원본 JSON 키값을 그대로 컬럼명으로 사용하는 완전한 재설계

-- Drop existing tables
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.standings CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.leagues CASCADE;

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

-- Create players table with TheSportsDB structure
CREATE TABLE public.players (
    -- Primary Key (TheSportsDB)
    "idPlayer" TEXT PRIMARY KEY,
    
    -- Basic Information
    "strPlayer" TEXT,
    "strPlayerAlternate" TEXT,
    "strTeam" TEXT,
    "idTeam" TEXT REFERENCES public.teams("idTeam"),
    "strSport" TEXT,
    "strPosition" TEXT,
    "strNumber" TEXT,
    
    -- Personal Information
    "dateBorn" TEXT,
    "strBirthLocation" TEXT,
    "strNationality" TEXT,
    "strGender" TEXT,
    "strHeight" TEXT,
    "strWeight" TEXT,
    "strStatus" TEXT,
    
    -- Career Information
    "dateSigned" TEXT,
    "strSigning" TEXT,
    "strWage" TEXT,
    "strOutfitter" TEXT,
    "strKit" TEXT,
    "strAgent" TEXT,
    
    -- External API IDs
    "idAPIfootball" TEXT,
    "idPlayerManager" TEXT,
    "strLocked" TEXT,
    
    -- Media Assets
    "strThumb" TEXT,
    "strCutout" TEXT,
    "strRender" TEXT,
    "strBanner" TEXT,
    "strFanart1" TEXT,
    "strFanart2" TEXT,
    "strFanart3" TEXT,
    "strFanart4" TEXT,
    
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
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events (fixtures) table with TheSportsDB structure
CREATE TABLE public.events (
    -- Primary Key (TheSportsDB)
    "idEvent" TEXT PRIMARY KEY,
    
    -- Basic Information
    "strEvent" TEXT,
    "strEventAlternate" TEXT,
    "strSport" TEXT,
    "idLeague" TEXT REFERENCES public.leagues("idLeague"),
    "strLeague" TEXT,
    "strSeason" TEXT,
    
    -- Teams
    "idHomeTeam" TEXT REFERENCES public.teams("idTeam"),
    "idAwayTeam" TEXT REFERENCES public.teams("idTeam"),
    "strHomeTeam" TEXT,
    "strAwayTeam" TEXT,
    
    -- Scores
    "intHomeScore" TEXT,
    "intAwayScore" TEXT,
    "intHomeScoreET" TEXT,
    "intAwayScoreET" TEXT,
    "intHomeScorePen" TEXT,
    "intAwayScorePen" TEXT,
    
    -- Date and Time
    "dateEvent" TEXT,
    "dateEventLocal" TEXT,
    "strTime" TEXT,
    "strTimeLocal" TEXT,
    "strTimestamp" TEXT,
    
    -- Match Information
    "intRound" TEXT,
    "strResult" TEXT,
    "strVenue" TEXT,
    "strCountry" TEXT,
    "strCity" TEXT,
    "strPoster" TEXT,
    "strStatus" TEXT,
    "strPostponed" TEXT,
    
    -- External API IDs
    "idAPIfootball" TEXT,
    "strLocked" TEXT,
    
    -- Media Assets
    "strThumb" TEXT,
    "strBanner" TEXT,
    "strMap" TEXT,
    "strTweet1" TEXT,
    "strTweet2" TEXT,
    "strTweet3" TEXT,
    "strVideo" TEXT,
    
    -- Highlights (Highlightly API compatibility)
    "highlightly_id" BIGINT,
    "strHighlights" TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create standings table with Highlightly structure
CREATE TABLE public.standings (
    id SERIAL PRIMARY KEY,
    
    -- League Information
    league_id BIGINT, -- Highlightly league ID
    "idLeague" TEXT REFERENCES public.leagues("idLeague"), -- TheSportsDB mapping
    season INTEGER,
    group_name TEXT,
    
    -- Team Information
    team_id BIGINT, -- Highlightly team ID
    "idTeam" TEXT REFERENCES public.teams("idTeam"), -- TheSportsDB mapping
    team_name TEXT,
    team_logo TEXT,
    
    -- Standings Data
    rank INTEGER,
    points INTEGER,
    
    -- Home Stats
    home_wins INTEGER,
    home_draws INTEGER,
    home_losses INTEGER,
    home_games INTEGER,
    home_goals_for INTEGER,
    home_goals_against INTEGER,
    
    -- Away Stats
    away_wins INTEGER,
    away_draws INTEGER,
    away_losses INTEGER,
    away_games INTEGER,
    away_goals_for INTEGER,
    away_goals_against INTEGER,
    
    -- Total Stats
    total_wins INTEGER,
    total_draws INTEGER,
    total_losses INTEGER,
    total_games INTEGER,
    total_goals_for INTEGER,
    total_goals_against INTEGER,
    goal_difference INTEGER,
    
    -- Form
    form TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(league_id, season, team_id)
);

-- Create indexes for performance
CREATE INDEX idx_teams_idLeague ON public.teams("idLeague");
CREATE INDEX idx_players_idTeam ON public.players("idTeam");
CREATE INDEX idx_events_idLeague ON public.events("idLeague");
CREATE INDEX idx_events_date ON public.events("dateEvent");
CREATE INDEX idx_standings_league_season ON public.standings(league_id, season);
CREATE INDEX idx_leagues_highlightly ON public.leagues(highlightly_id);
CREATE INDEX idx_teams_highlightly ON public.teams(highlightly_id);

-- Enable Row Level Security
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow read access for all authenticated users)
CREATE POLICY "Allow read access for all users" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow read access for all users" ON public.standings FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;