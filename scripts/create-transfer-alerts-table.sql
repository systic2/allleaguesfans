-- 이적 알림 및 감지 로그 테이블 생성
CREATE TABLE IF NOT EXISTS transfer_alerts (
    id BIGSERIAL PRIMARY KEY,
    
    -- 감지 정보
    detection_type VARCHAR(20) NOT NULL CHECK (detection_type IN ('departure', 'arrival', 'loan_out', 'loan_return', 'retirement')),
    player_name VARCHAR(255) NOT NULL,
    api_player_id INTEGER,
    
    -- 팀 정보
    from_team_id INTEGER,
    to_team_id INTEGER,
    from_team_name VARCHAR(255),
    to_team_name VARCHAR(255),
    
    -- 분석 결과
    confidence DECIMAL(3,2) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    evidence JSONB,
    recommended_action VARCHAR(20) NOT NULL CHECK (recommended_action IN ('flag', 'auto_update', 'manual_review')),
    detection_method VARCHAR(50),
    
    -- 처리 상태
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_detection_type ON transfer_alerts(detection_type);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_priority ON transfer_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_status ON transfer_alerts(status);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_created_at ON transfer_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_api_player_id ON transfer_alerts(api_player_id);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_confidence ON transfer_alerts(confidence);

-- 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_status_priority ON transfer_alerts(status, priority);
CREATE INDEX IF NOT EXISTS idx_transfer_alerts_detection_confidence ON transfer_alerts(detection_type, confidence);

-- Row Level Security 정책
ALTER TABLE transfer_alerts ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (인증된 사용자)
CREATE POLICY "Transfer alerts are viewable by authenticated users" ON transfer_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 정책 (서비스 역할)
CREATE POLICY "Transfer alerts are insertable by service role" ON transfer_alerts
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 업데이트 정책 (서비스 역할)
CREATE POLICY "Transfer alerts are updatable by service role" ON transfer_alerts
    FOR UPDATE USING (auth.role() = 'service_role');

-- 이적 통계 요약 뷰
CREATE OR REPLACE VIEW transfer_alerts_summary AS
SELECT 
    ta.id,
    ta.detection_type,
    ta.player_name,
    ta.from_team_name,
    ta.to_team_name,
    ta.confidence,
    ta.priority,
    ta.status,
    ta.recommended_action,
    ta.created_at,
    ta.reviewed_at,
    ta.reviewed_by,
    -- 증거 요약
    jsonb_array_length(ta.evidence) as evidence_count,
    -- 팀 정보 조인을 위한 필드
    ft.name as from_team_db_name,
    tt.name as to_team_db_name
FROM transfer_alerts ta
LEFT JOIN teams ft ON ta.from_team_id = ft.id
LEFT JOIN teams tt ON ta.to_team_id = tt.id
ORDER BY ta.created_at DESC;

-- 이적 동향 분석 함수
CREATE OR REPLACE FUNCTION get_transfer_trends(
    days_back INTEGER DEFAULT 30,
    min_confidence DECIMAL DEFAULT 0.7
)
RETURNS TABLE(
    detection_type VARCHAR,
    total_count BIGINT,
    high_priority_count BIGINT,
    avg_confidence DECIMAL,
    pending_count BIGINT,
    recent_activity JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.detection_type,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE ta.priority = 'high') as high_priority_count,
        ROUND(AVG(ta.confidence), 3) as avg_confidence,
        COUNT(*) FILTER (WHERE ta.status = 'pending') as pending_count,
        (
            SELECT json_agg(
                json_build_object(
                    'player_name', player_name,
                    'confidence', confidence,
                    'created_at', created_at,
                    'from_team', from_team_name,
                    'to_team', to_team_name
                )
            )
            FROM (
                SELECT player_name, confidence, created_at, from_team_name, to_team_name
                FROM transfer_alerts ta2
                WHERE ta2.detection_type = ta.detection_type
                  AND ta2.created_at >= NOW() - (days_back || ' days')::INTERVAL
                  AND ta2.confidence >= min_confidence
                ORDER BY ta2.created_at DESC
                LIMIT 5
            ) recent
        ) as recent_activity
    FROM transfer_alerts ta
    WHERE ta.created_at >= NOW() - (days_back || ' days')::INTERVAL
      AND ta.confidence >= min_confidence
    GROUP BY ta.detection_type
    ORDER BY total_count DESC;
END;
$$;

-- 고우선순위 알림 조회 함수
CREATE OR REPLACE FUNCTION get_high_priority_alerts(
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
    id BIGINT,
    detection_type VARCHAR,
    player_name VARCHAR,
    from_team VARCHAR,
    to_team VARCHAR,
    confidence DECIMAL,
    priority VARCHAR,
    evidence_summary TEXT,
    hours_since_detection INTERVAL,
    recommended_action VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.id,
        ta.detection_type,
        ta.player_name,
        COALESCE(ta.from_team_name, 'Unknown') as from_team,
        COALESCE(ta.to_team_name, 'Unknown') as to_team,
        ta.confidence,
        ta.priority,
        (
            SELECT string_agg(value::text, '; ')
            FROM jsonb_array_elements_text(ta.evidence)
        ) as evidence_summary,
        NOW() - ta.created_at as hours_since_detection,
        ta.recommended_action
    FROM transfer_alerts ta
    WHERE ta.status = 'pending'
      AND ta.priority = 'high'
      AND ta.confidence >= 0.8
    ORDER BY ta.created_at DESC
    LIMIT limit_count;
END;
$$;

-- 이적시장 활성도 분석 함수
CREATE OR REPLACE FUNCTION analyze_transfer_window_activity()
RETURNS TABLE(
    window_period TEXT,
    total_transfers INTEGER,
    departures INTEGER,
    arrivals INTEGER,
    avg_confidence DECIMAL,
    top_active_teams JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    summer_start DATE := DATE(EXTRACT(YEAR FROM current_date) || '-06-01');
    summer_end DATE := DATE(EXTRACT(YEAR FROM current_date) || '-08-31');
    winter_start DATE := DATE(EXTRACT(YEAR FROM current_date) || '-01-01');
    winter_end DATE := DATE(EXTRACT(YEAR FROM current_date) || '-01-31');
    window_start DATE;
    window_end DATE;
    window_name TEXT;
BEGIN
    -- 현재 이적시장 기간 결정
    IF current_date BETWEEN summer_start AND summer_end THEN
        window_start := summer_start;
        window_end := summer_end;
        window_name := 'Summer ' || EXTRACT(YEAR FROM current_date);
    ELSIF current_date BETWEEN winter_start AND winter_end THEN
        window_start := winter_start;
        window_end := winter_end;
        window_name := 'Winter ' || EXTRACT(YEAR FROM current_date);
    ELSE
        -- 가장 최근 이적시장 분석
        IF current_date > summer_end THEN
            window_start := summer_start;
            window_end := summer_end;
            window_name := 'Summer ' || EXTRACT(YEAR FROM current_date);
        ELSE
            window_start := winter_start;
            window_end := winter_end;
            window_name := 'Winter ' || EXTRACT(YEAR FROM current_date);
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        window_name as window_period,
        COUNT(*)::INTEGER as total_transfers,
        COUNT(*) FILTER (WHERE detection_type = 'departure')::INTEGER as departures,
        COUNT(*) FILTER (WHERE detection_type = 'arrival')::INTEGER as arrivals,
        ROUND(AVG(confidence), 3) as avg_confidence,
        (
            SELECT json_agg(
                json_build_object(
                    'team_name', team_name,
                    'activity_count', activity_count,
                    'avg_confidence', avg_conf
                )
            )
            FROM (
                SELECT 
                    COALESCE(from_team_name, to_team_name) as team_name,
                    COUNT(*) as activity_count,
                    ROUND(AVG(confidence), 2) as avg_conf
                FROM transfer_alerts
                WHERE created_at::DATE BETWEEN window_start AND window_end
                  AND (from_team_name IS NOT NULL OR to_team_name IS NOT NULL)
                GROUP BY COALESCE(from_team_name, to_team_name)
                ORDER BY activity_count DESC
                LIMIT 5
            ) team_activity
        ) as top_active_teams
    FROM transfer_alerts
    WHERE created_at::DATE BETWEEN window_start AND window_end;
END;
$$;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_transfer_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transfer_alerts_updated_at
    BEFORE UPDATE ON transfer_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_transfer_alerts_updated_at();

-- 알림 정리 함수 (오래된 resolved/dismissed 항목 정리)
CREATE OR REPLACE FUNCTION cleanup_old_transfer_alerts(
    days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM transfer_alerts
    WHERE status IN ('resolved', 'dismissed')
      AND updated_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;