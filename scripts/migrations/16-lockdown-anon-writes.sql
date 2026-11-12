-- 16: anon/authenticated 쓰기 경로 차단 (2026-11-12 보안 점검)
--
-- 운영 DB 점검 결과:
--   - players_v2, events_highlightly_enhanced 는 RLS 가 꺼져 있고 anon 에 INSERT/UPDATE/DELETE 권한이 있어
--     공개(publishable) 키만으로 쓰기·삭제가 가능했다.
--   - upsert_player_stats 는 SECURITY DEFINER 인데 anon 이 실행 가능하고 search_path 가 고정되지 않아
--     RPC 로 RLS 를 우회해 player_statistics 를 쓸 수 있었다.
--   - top_scorers / top_assisters / v2_events_enhanced 뷰에도 anon 쓰기 권한이 부여돼 있었다.
--
-- 프론트엔드는 읽기(SELECT)만 하고, 모든 쓰기는 secret(service_role) 키를 쓰는 동기화 스크립트가 한다.
-- 따라서 anon/authenticated 에는 테이블·뷰 SELECT 만 남기고 나머지 권한을 모두 회수한다.
-- service_role 은 영향 없음. 여러 번 실행해도 안전하다.
--
-- 기본 권한(ALTER DEFAULT PRIVILEGES)은 이 스크립트를 실행한 역할(SQL Editor 에서는 postgres)이
-- 앞으로 만드는 객체에만 적용된다. 다른 역할이 만든 객체는 별도로 확인해야 한다.

BEGIN;

-- 1) RLS 가 꺼져 있던 테이블: RLS 를 켜고 공개 읽기만 허용
ALTER TABLE public.players_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_highlightly_enhanced ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on players_v2" ON public.players_v2;
CREATE POLICY "Allow public read access on players_v2"
  ON public.players_v2 FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on events_highlightly_enhanced" ON public.events_highlightly_enhanced;
CREATE POLICY "Allow public read access on events_highlightly_enhanced"
  ON public.events_highlightly_enhanced FOR SELECT USING (true);

-- 2) 테이블·뷰: anon/authenticated 는 SELECT 만
--    (INSERT/UPDATE/DELETE/TRUNCATE 뿐 아니라 REFERENCES/TRIGGER/MAINTAIN 도 회수)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- 3) 시퀀스: anon/authenticated 는 쓸 일이 없으므로 전부 회수 (nextval/setval 경로 차단)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 4) public 의 앱 함수(pg_trgm·unaccent 등 확장 소유 함수 제외): 외부 실행 권한 회수
--    SECURITY DEFINER 함수는 search_path 고정
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.prosecdef
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO service_role', f.sig);
    IF f.prosecdef THEN
      EXECUTE format('ALTER ROUTINE %s SET search_path = public, pg_temp', f.sig);
    END IF;
  END LOOP;
END $$;

-- 앞으로 만들 함수: PUBLIC 실행 권한은 스키마 단위가 아닌 전역 기본값이라 FOR ROLE 로 회수해야 한다
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON ROUTINES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO service_role;

COMMIT;

-- 검증 (모두 0행이어야 정상)
-- select c.relname from pg_class c
--   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and not c.relrowsecurity;
-- select c.relname, r.role, p.priv from pg_class c
--   cross join (values ('anon'),('authenticated')) r(role)
--   cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
--   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m')
--     and (has_table_privilege(r.role, c.oid, p.priv)
--          or (p.priv in ('INSERT','UPDATE','REFERENCES') and has_any_column_privilege(r.role, c.oid, p.priv)));
-- select c.relname from pg_class c
--   where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
--     and (has_sequence_privilege('anon', c.oid, 'USAGE') or has_sequence_privilege('anon', c.oid, 'UPDATE'));
-- select p.proname from pg_proc p
--   where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')
--     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
--                     and d.objid = p.oid and d.deptype = 'e');
