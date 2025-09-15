-- fix-rls-policies.sql
-- Supabase 대시보드에서 실행할 RLS 정책 수정 스크립트

-- 1. events 테이블의 RLS 정책 확인 및 수정
-- 기존 정책들 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'events';

-- 기존 제한적인 정책들 삭제 (필요시)
-- DROP POLICY IF EXISTS "restrictive_policy_name" ON events;

-- 익명 사용자(anon)에게 모든 권한 부여
DROP POLICY IF EXISTS "Allow anon all access" ON events;
CREATE POLICY "Allow anon all access" ON events
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 인증된 사용자에게 모든 권한 부여
DROP POLICY IF EXISTS "Allow authenticated all access" ON events;
CREATE POLICY "Allow authenticated all access" ON events
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 서비스 롤에게 모든 권한 부여
DROP POLICY IF EXISTS "Allow service role all access" ON events;
CREATE POLICY "Allow service role all access" ON events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. fixture_events 테이블의 RLS 정책 확인 및 수정 (이미 생성된 경우)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'fixture_events';

-- fixture_events 테이블의 정책들도 동일하게 수정
DROP POLICY IF EXISTS "Allow anon all access" ON fixture_events;
CREATE POLICY "Allow anon all access" ON fixture_events
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all access" ON fixture_events;
CREATE POLICY "Allow authenticated all access" ON fixture_events
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role all access" ON fixture_events;
CREATE POLICY "Allow service role all access" ON fixture_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. 정책 적용 확인
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('events', 'fixture_events')
ORDER BY tablename, policyname;

-- 4. 테스트용 쿼리 (정책이 제대로 작동하는지 확인)
-- INSERT 테스트 (간단한 테스트 레코드)
INSERT INTO events (fixture_id, team_id, player_id, type, detail, minute) 
VALUES (9999999, 2762, 12345, 'Goal', 'Normal Goal', 45)
ON CONFLICT DO NOTHING;

-- 테스트 레코드 삭제
DELETE FROM events WHERE fixture_id = 9999999;