-- League ID Mapping Table for TheSportsDB ↔ Highlightly API Integration
-- 목적: 두 API 간의 리그 ID 매핑 관리

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.league_id_mapping CASCADE;

-- Create league ID mapping table
CREATE TABLE public.league_id_mapping (
    id SERIAL PRIMARY KEY,
    thesportsdb_league_id TEXT NOT NULL,
    highlightly_league_id TEXT NOT NULL,
    league_name TEXT NOT NULL,
    league_name_kr TEXT, -- 한국어 리그명
    country TEXT DEFAULT 'South Korea',
    sport TEXT DEFAULT 'Soccer',
    season TEXT DEFAULT '2025',
    is_active BOOLEAN DEFAULT true,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 유니크 제약조건
    UNIQUE (thesportsdb_league_id, highlightly_league_id)
);

-- Insert K League mappings
INSERT INTO public.league_id_mapping (
    thesportsdb_league_id,
    highlightly_league_id,
    league_name,
    league_name_kr,
    country,
    sport,
    season
) VALUES 
    ('4689', '249276', 'K League 1', 'K리그1', 'South Korea', 'Soccer', '2025'),
    ('4822', '250127', 'K League 2', 'K리그2', 'South Korea', 'Soccer', '2025');

-- Create indexes for performance
CREATE INDEX idx_league_mapping_thesportsdb ON public.league_id_mapping(thesportsdb_league_id);
CREATE INDEX idx_league_mapping_highlightly ON public.league_id_mapping(highlightly_league_id);
CREATE INDEX idx_league_mapping_active ON public.league_id_mapping(is_active);

-- Enable Row Level Security
ALTER TABLE public.league_id_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allow read access for all users)
CREATE POLICY "Allow read access for all users" ON public.league_id_mapping FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.league_id_mapping TO anon;
GRANT SELECT ON public.league_id_mapping TO authenticated;
GRANT ALL ON public.league_id_mapping TO service_role;

-- Add comments
COMMENT ON TABLE public.league_id_mapping IS 'Mapping table between TheSportsDB and Highlightly API league IDs';
COMMENT ON COLUMN public.league_id_mapping.thesportsdb_league_id IS 'TheSportsDB league ID (4689=K League 1, 4822=K League 2)';
COMMENT ON COLUMN public.league_id_mapping.highlightly_league_id IS 'Highlightly API league ID (249276=K League 1, 250127=K League 2)';
COMMENT ON COLUMN public.league_id_mapping.league_name IS 'English league name';
COMMENT ON COLUMN public.league_id_mapping.league_name_kr IS 'Korean league name for UI display';

-- Create utility functions
CREATE OR REPLACE FUNCTION get_highlightly_league_id(thesportsdb_id TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT highlightly_league_id 
        FROM public.league_id_mapping 
        WHERE thesportsdb_league_id = thesportsdb_id 
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;