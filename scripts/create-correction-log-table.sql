-- 등번호 수정 로그 테이블 생성
CREATE TABLE IF NOT EXISTS jersey_correction_log (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT REFERENCES players(id),
    old_jersey INTEGER,
    new_jersey INTEGER,
    confidence DECIMAL(3,2),
    reason TEXT,
    corrected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    corrected_by TEXT DEFAULT 'auto-system',
    
    -- 추가 메타데이터
    team_id INTEGER,
    api_source TEXT DEFAULT 'api-football',
    validation_method TEXT DEFAULT 'name-matching',
    
    -- 인덱스를 위한 컬럼들
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_jersey_correction_log_player_id ON jersey_correction_log(player_id);
CREATE INDEX IF NOT EXISTS idx_jersey_correction_log_corrected_at ON jersey_correction_log(corrected_at);
CREATE INDEX IF NOT EXISTS idx_jersey_correction_log_team_id ON jersey_correction_log(team_id);

-- Row Level Security 정책
ALTER TABLE jersey_correction_log ENABLE ROW LEVEL SECURITY;

-- 읽기 정책 (모든 인증된 사용자)
CREATE POLICY "Jersey correction logs are viewable by authenticated users" ON jersey_correction_log
    FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 정책 (서비스 역할만)
CREATE POLICY "Jersey correction logs are insertable by service role" ON jersey_correction_log
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 함수: 테이블 생성 함수 (스크립트에서 호출용)
CREATE OR REPLACE FUNCTION create_jersey_correction_log_table()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 테이블이 이미 존재하는지 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'jersey_correction_log'
    ) THEN
        RETURN 'Table already exists';
    END IF;
    
    -- 테이블 생성 (위의 DDL과 동일)
    CREATE TABLE jersey_correction_log (
        id BIGSERIAL PRIMARY KEY,
        player_id BIGINT REFERENCES players(id),
        old_jersey INTEGER,
        new_jersey INTEGER,
        confidence DECIMAL(3,2),
        reason TEXT,
        corrected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        corrected_by TEXT DEFAULT 'auto-system',
        team_id INTEGER,
        api_source TEXT DEFAULT 'api-football',
        validation_method TEXT DEFAULT 'name-matching',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- 인덱스 생성
    CREATE INDEX idx_jersey_correction_log_player_id ON jersey_correction_log(player_id);
    CREATE INDEX idx_jersey_correction_log_corrected_at ON jersey_correction_log(corrected_at);
    CREATE INDEX idx_jersey_correction_log_team_id ON jersey_correction_log(team_id);
    
    -- RLS 활성화
    ALTER TABLE jersey_correction_log ENABLE ROW LEVEL SECURITY;
    
    -- 정책 생성
    CREATE POLICY "Jersey correction logs are viewable by authenticated users" ON jersey_correction_log
        FOR SELECT USING (auth.role() = 'authenticated');
        
    CREATE POLICY "Jersey correction logs are insertable by service role" ON jersey_correction_log
        FOR INSERT WITH CHECK (auth.role() = 'service_role');
    
    RETURN 'Table created successfully';
END;
$$;

-- 수정 히스토리 조회 뷰
CREATE OR REPLACE VIEW jersey_correction_summary AS
SELECT 
    jcl.id,
    p.name as player_name,
    t.name as team_name,
    jcl.old_jersey,
    jcl.new_jersey,
    jcl.confidence,
    jcl.reason,
    jcl.corrected_at,
    jcl.corrected_by
FROM jersey_correction_log jcl
JOIN players p ON jcl.player_id = p.id
LEFT JOIN teams t ON jcl.team_id = t.id
ORDER BY jcl.corrected_at DESC;

-- 통계 조회 함수
CREATE OR REPLACE FUNCTION get_jersey_correction_stats(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    total_corrections INTEGER,
    avg_confidence DECIMAL,
    corrections_by_team JSON,
    recent_corrections JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_corrections,
        ROUND(AVG(confidence), 3) as avg_confidence,
        (
            SELECT json_agg(
                json_build_object(
                    'team_id', team_id,
                    'count', count
                )
            )
            FROM (
                SELECT team_id, COUNT(*) as count
                FROM jersey_correction_log 
                WHERE corrected_at BETWEEN start_date AND end_date
                GROUP BY team_id
                ORDER BY count DESC
            ) team_stats
        ) as corrections_by_team,
        (
            SELECT json_agg(
                json_build_object(
                    'player_name', player_name,
                    'team_name', team_name,
                    'old_jersey', old_jersey,
                    'new_jersey', new_jersey,
                    'corrected_at', corrected_at
                )
            )
            FROM (
                SELECT *
                FROM jersey_correction_summary
                WHERE corrected_at BETWEEN start_date AND end_date
                ORDER BY corrected_at DESC
                LIMIT 10
            ) recent
        ) as recent_corrections
    FROM jersey_correction_log
    WHERE corrected_at BETWEEN start_date AND end_date;
END;
$$;