-- create-fixture-events-table.sql
-- Supabase 대시보드에서 수동으로 실행해야 하는 SQL 스크립트

-- 1. 새로운 fixture_events 테이블 생성 (API-Football 구조에 맞춘 정규화된 구조)
CREATE TABLE IF NOT EXISTS fixture_events (
    id BIGSERIAL PRIMARY KEY,
    fixture_id BIGINT NOT NULL,
    team_id INTEGER,
    player_id INTEGER,
    assist_player_id INTEGER,
    elapsed_minutes INTEGER NOT NULL,
    extra_minutes INTEGER,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('Goal', 'Card', 'subst', 'Var')),
    event_detail VARCHAR(50),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 데이터 방지를 위한 유니크 제약조건 (핵심 개선사항)
    UNIQUE(fixture_id, player_id, event_type, elapsed_minutes, event_detail)
);

-- 2. 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_fixture_events_fixture_id ON fixture_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixture_events_player_id ON fixture_events(player_id);
CREATE INDEX IF NOT EXISTS idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fixture_events_goals ON fixture_events(fixture_id, event_type) WHERE event_type = 'Goal';

-- 3. RLS (Row Level Security) 정책 설정
ALTER TABLE fixture_events ENABLE ROW LEVEL SECURITY;

-- 익명 사용자 읽기 권한
CREATE POLICY "Allow anonymous read access" ON fixture_events
    FOR SELECT
    TO anon
    USING (true);

-- 인증된 사용자 모든 권한
CREATE POLICY "Allow authenticated all access" ON fixture_events
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 서비스 롤 모든 권한 (데이터 임포트용)
CREATE POLICY "Allow service role all access" ON fixture_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. 기본 외래 키 제약조건 (선택적 - 테이블이 존재할 경우에만 추가)
-- ALTER TABLE fixture_events ADD CONSTRAINT fk_fixture_events_fixture 
--     FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE;
-- ALTER TABLE fixture_events ADD CONSTRAINT fk_fixture_events_player 
--     FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

-- 5. 테이블 설명 및 컬럼 주석
COMMENT ON TABLE fixture_events IS 'API-Football 이벤트 데이터 정규화 테이블 - 중복 방지 제약조건 포함';
COMMENT ON COLUMN fixture_events.fixture_id IS '경기 ID (fixtures 테이블 참조)';
COMMENT ON COLUMN fixture_events.event_type IS '이벤트 유형: Goal, Card, subst, Var 등';
COMMENT ON COLUMN fixture_events.event_detail IS '세부 이벤트: Normal Goal, Yellow Card, Red Card 등';
COMMENT ON COLUMN fixture_events.elapsed_minutes IS '경기 진행 시간(분) - NULL 불가';
COMMENT ON COLUMN fixture_events.extra_minutes IS '추가 시간(분)';