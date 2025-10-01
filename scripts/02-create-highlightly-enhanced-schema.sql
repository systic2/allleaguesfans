-- Highlightly API Enhanced Events Schema
-- 목적: 기존 TheSportsDB events 테이블에 Highlightly API 데이터 보완

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.events_highlightly_enhanced CASCADE;

-- Create Highlightly enhanced events table
CREATE TABLE public.events_highlightly_enhanced (
    id SERIAL PRIMARY KEY,
    
    -- TheSportsDB events 테이블과의 연결
    "idEvent" TEXT NOT NULL, -- Foreign key to events table
    
    -- Highlightly API 식별자
    highlightly_event_id TEXT,
    highlightly_league_id TEXT,
    highlightly_match_id TEXT,
    
    -- 실시간 라이브 데이터
    live_status TEXT, -- 'live', 'finished', 'not_started', 'postponed'
    live_minute INTEGER, -- 경기 진행 시간 (분)
    live_period TEXT, -- '1H', '2H', 'HT', 'FT', 'ET', 'PEN'
    live_score_home INTEGER,
    live_score_away INTEGER,
    
    -- 향상된 경기 통계
    possession_home INTEGER, -- 점유율 (%)
    possession_away INTEGER,
    shots_home INTEGER, -- 슈팅 수
    shots_away INTEGER,
    shots_on_target_home INTEGER, -- 유효 슈팅
    shots_on_target_away INTEGER,
    corners_home INTEGER, -- 코너킥
    corners_away INTEGER,
    fouls_home INTEGER, -- 파울
    fouls_away INTEGER,
    offsides_home INTEGER, -- 오프사이드
    offsides_away INTEGER,
    
    -- 카드 정보
    yellow_cards_home INTEGER,
    yellow_cards_away INTEGER,
    red_cards_home INTEGER,
    red_cards_away INTEGER,
    
    -- 추가 고급 통계
    passes_total_home INTEGER, -- 총 패스 수
    passes_total_away INTEGER,
    passes_accurate_home INTEGER, -- 성공 패스 수
    passes_accurate_away INTEGER,
    pass_accuracy_home DECIMAL(5,2), -- 패스 성공률 (%)
    pass_accuracy_away DECIMAL(5,2),
    
    -- 공격 통계
    attacks_home INTEGER, -- 공격 수
    attacks_away INTEGER,
    dangerous_attacks_home INTEGER, -- 위험한 공격
    dangerous_attacks_away INTEGER,
    
    -- 수비 통계
    saves_home INTEGER, -- 세이브
    saves_away INTEGER,
    clearances_home INTEGER, -- 클리어링
    clearances_away INTEGER,
    
    -- 하프타임 스코어
    ht_score_home INTEGER,
    ht_score_away INTEGER,
    
    -- Highlightly 특화 데이터
    momentum INTEGER, -- 경기 모멘텀 (-100 to 100, positive = home advantage)
    intensity DECIMAL(3,1), -- 경기 강도 (0.0 to 10.0)
    
    -- API 메타데이터
    data_source TEXT DEFAULT 'highlightly',
    api_response JSONB, -- 원본 API 응답 저장 (디버깅용)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'error'
    sync_error TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign Key constraint
    FOREIGN KEY ("idEvent") REFERENCES public.events("idEvent") ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_events_highlightly_idEvent ON public.events_highlightly_enhanced("idEvent");
CREATE INDEX idx_events_highlightly_league_id ON public.events_highlightly_enhanced(highlightly_league_id);
CREATE INDEX idx_events_highlightly_live_status ON public.events_highlightly_enhanced(live_status);
CREATE INDEX idx_events_highlightly_last_updated ON public.events_highlightly_enhanced(last_updated);
CREATE INDEX idx_events_highlightly_sync_status ON public.events_highlightly_enhanced(sync_status);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_events_highlightly_unique ON public.events_highlightly_enhanced("idEvent");

-- Enable Row Level Security
ALTER TABLE public.events_highlightly_enhanced ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allow read access for all users)
CREATE POLICY "Allow read access for all users" ON public.events_highlightly_enhanced FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.events_highlightly_enhanced TO anon;
GRANT SELECT ON public.events_highlightly_enhanced TO authenticated;
GRANT ALL ON public.events_highlightly_enhanced TO service_role;

-- Add comments
COMMENT ON TABLE public.events_highlightly_enhanced IS 'Enhanced events data from Highlightly API - supplements TheSportsDB events with real-time and advanced statistics';
COMMENT ON COLUMN public.events_highlightly_enhanced."idEvent" IS 'Foreign key to events table (TheSportsDB event ID)';
COMMENT ON COLUMN public.events_highlightly_enhanced.highlightly_event_id IS 'Highlightly API event identifier';
COMMENT ON COLUMN public.events_highlightly_enhanced.live_status IS 'Real-time match status from Highlightly API';
COMMENT ON COLUMN public.events_highlightly_enhanced.live_minute IS 'Current match minute for live games';
COMMENT ON COLUMN public.events_highlightly_enhanced.possession_home IS 'Home team ball possession percentage';
COMMENT ON COLUMN public.events_highlightly_enhanced.momentum IS 'Match momentum indicator (-100 to 100, positive favors home team)';

-- Create enhanced events view that combines both tables
DROP VIEW IF EXISTS public.events_enhanced CASCADE;
CREATE VIEW public.events_enhanced AS
SELECT 
    e.*,
    -- Highlightly enhanced data
    eh.highlightly_event_id,
    eh.live_status,
    eh.live_minute,
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
    eh.last_updated as highlightly_last_updated,
    eh.sync_status as highlightly_sync_status,
    
    -- Calculate derived fields
    CASE 
        WHEN eh.live_status = 'live' THEN true
        ELSE false
    END as is_live,
    
    CASE 
        WHEN eh.possession_home IS NOT NULL AND eh.possession_away IS NOT NULL THEN
            eh.possession_home - eh.possession_away
        ELSE NULL
    END as possession_difference,
    
    CASE 
        WHEN eh.shots_on_target_home IS NOT NULL AND eh.shots_home IS NOT NULL AND eh.shots_home > 0 THEN
            ROUND((eh.shots_on_target_home::DECIMAL / eh.shots_home * 100), 1)
        ELSE NULL
    END as shot_accuracy_home,
    
    CASE 
        WHEN eh.shots_on_target_away IS NOT NULL AND eh.shots_away IS NOT NULL AND eh.shots_away > 0 THEN
            ROUND((eh.shots_on_target_away::DECIMAL / eh.shots_away * 100), 1)
        ELSE NULL
    END as shot_accuracy_away
    
FROM public.events e
LEFT JOIN public.events_highlightly_enhanced eh ON e."idEvent" = eh."idEvent";

-- Grant permissions on the view
GRANT SELECT ON public.events_enhanced TO anon;
GRANT SELECT ON public.events_enhanced TO authenticated;
GRANT SELECT ON public.events_enhanced TO service_role;

-- Add comment on view
COMMENT ON VIEW public.events_enhanced IS 'Combined view of TheSportsDB events with Highlightly API enhancements including real-time data and advanced statistics';

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_highlightly_enhanced_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_highlightly_enhanced_updated_at
    BEFORE UPDATE ON public.events_highlightly_enhanced
    FOR EACH ROW
    EXECUTE FUNCTION update_highlightly_enhanced_updated_at();