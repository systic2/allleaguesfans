-- disable-rls.sql
-- 마지막 수단: RLS 완전 비활성화

-- events 테이블의 RLS 비활성화
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- fixture_events 테이블의 RLS 비활성화 (존재하는 경우)
ALTER TABLE fixture_events DISABLE ROW LEVEL SECURITY;

-- 확인
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('events', 'fixture_events');